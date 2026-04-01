/**
 * Agent Core — 纯 Agent 逻辑，不依赖任何 UI
 *
 * 灵感来自 Claude Code 的:
 * - query() 是独立的 AsyncGenerator<AgentEvent>
 * - UI 和 Agent 通过事件流解耦
 * - Conversation 单独管理对话历史
 * - confirmFn 回调注入确认逻辑（非硬编码在 Agent 中）
 *
 * 架构:
 *   AgentLoop → yield AgentEvent → UI/SDK 消费
 *   Conversation 管理历史 → AgentLoop 读写
 *   confirmFn 由外部注入 → AgentLoop 通过回调暂停
 */
import OpenAI from 'openai'
import type { ChatCompletionMessageParam, ChatCompletionChunk } from 'openai/resources/chat/completions.js'
import { z } from 'zod'
import type { ToolRegistry } from '../tools/registry.js'
import type { ToolContext } from '../tools/types.js'
import type { ProjectContext } from './context.js'
import { buildProjectContext } from './context.js'
import { buildSystemPrompt } from './prompt.js'
import type { Skill } from '../skills/types.js'
import { extractToolCalls, cleanToolTags } from './tool-parser.js'
import { shouldCompact, estimateMessagesTokens, KEEP_RECENT_TURNS } from '../utils/tokens.js'
import { compactMessages } from './compact.js'
import { loadProjectMemory } from './memory.js'
import { PlanState, planCreateSchema, buildBatchExecutionPrompt } from './plan.js'
import type { Plan } from './plan.js'
import { logRequest, logResponse, logToolCall, logToolResult, logError as logLlmError } from '../utils/logger.js'

// ─── 事件类型（Agent 不知道 UI 的存在）──────────────────────

// ─── ask_user 工具 Schema ────────────────────────────────────

export const askUserSchema = z.object({
  question: z.string().describe('向用户提出的问题'),
  options: z.array(z.string()).min(2).max(4).describe('2-4 个选项供用户选择'),
  allow_custom: z.boolean().optional().default(false).describe('是否允许用户输入自定义答案'),
})

export type AskUserInput = z.infer<typeof askUserSchema>

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
}

export type AgentEvent =
  | { type: 'thinking'; text: string }
  | { type: 'assistant_text'; text: string }
  | { type: 'tool_call'; tool: string; input: unknown }
  | { type: 'tool_result'; tool: string; success: boolean; message: string }
  | { type: 'plan_summary'; plan: Plan }
  | { type: 'ask_user'; question: AskUserInput }
  | { type: 'error'; error: string }
  | { type: 'turn_end'; usage?: TokenUsage }

/** 确认回调 — 由 UI/SDK 注入，AgentCore 通过它暂停等待用户确认 */
export type ConfirmFn = (tool: string, description: string, preview?: string) => Promise<boolean>

/** 用户提问回调 — 由 UI/SDK 注入，AgentLoop 通过它暂停等待用户回答 */
export type AskUserFn = (question: AskUserInput) => Promise<string>

/** LLM 配置 */
export interface LlmConfig {
  baseURL: string
  apiKey: string
  model: string
}

/** Agent 选项 */
export interface AgentOptions {
  maxIterations?: number
  maxTokens?: number
  llmConfig?: LlmConfig
  stream?: boolean
  /** 写操作确认回调 */
  confirmFn?: ConfirmFn
  /** 用户提问回调 */
  askUserFn?: AskUserFn
  /** 项目记忆内容（来自 AGENT.md） */
  projectMemory?: string
}

// ─── 消息类型 ──────────────────────────────────────────────

export interface Message {
  role: 'user' | 'assistant' | 'tool'
  content: string
}

// ─── Conversation 管理类 ────────────────────────────────────

export class Conversation {
  private messages: Message[] = []
  projectContext: ProjectContext
  private summary: string = ''

  constructor(initialMessages: Message[], projectContext: ProjectContext) {
    this.messages = [...initialMessages]
    this.projectContext = projectContext
  }

  get length(): number {
    return this.messages.length
  }

  getMessages(): ReadonlyArray<Message> {
    return [...this.messages]
  }

  /** 获取上下文摘要（如果有） */
  getSummary(): string {
    return this.summary
  }

  /** 刷新项目上下文（重新扫描文件列表） */
  async refreshProjectContext(): Promise<void> {
    const ctx = await buildProjectContext(this.projectContext.workDir)
    this.projectContext = ctx
  }

  addUser(content: string): void {
    this.messages.push({ role: 'user', content })
  }

  addAssistant(content: string): void {
    this.messages.push({ role: 'assistant', content })
  }

  addToolResult(content: string): void {
    this.messages.push({ role: 'tool', content })
  }

  /** 获取最近 N 条消息 */
  getRecentMessages(count: number): Message[] {
    return this.messages.slice(-count)
  }

  /** 估算当前消息的 token 数 */
  getEstimatedTokens(): number {
    return estimateMessagesTokens(this.messages)
  }

  /** 是否需要压缩 */
  needsCompact(): boolean {
    return shouldCompact(this.messages)
  }

  /**
   * 压缩对话历史：保留最近 N 条，早期消息替换为摘要
   * 返回压缩掉的消息数
   */
  async compact(llmClient: OpenAI, model: string, keepCount?: number): Promise<number> {
    const keep = keepCount ?? KEEP_RECENT_TURNS * 2
    if (this.messages.length <= keep) return 0

    const result = await compactMessages(llmClient, this.messages, model, keep)
    if (result.compactedCount === 0) return 0

    this.summary = result.summary
    this.messages = result.recentMessages
    console.error(`[Conversation] 压缩完成: ${result.compactedCount} 条消息 → 摘要 (${this.summary.length} 字)`)
    return result.compactedCount
  }
}

// ─── LLM 客户端工厂 ──────────────────────────────────────

export function createLlmClient(config?: Partial<LlmConfig>): OpenAI {
  return new OpenAI({
    baseURL: config?.baseURL || process.env.CENTIT_BASE_URL,
    apiKey: config?.apiKey || process.env.CENTIT_API_KEY,
  })
}

export function getDefaultModel(): string {
  return process.env.CENTIT_PLANNER_MODEL || process.env.CENTIT_MODELS|| 'gpt-4o'
}

// ─── AgentLoop — 核心循环 ──────────────────────────────────

export class AgentLoop {
  private conversation: Conversation
  private llmClient: OpenAI
  private model: string
  private systemPrompt: string
  private toolRegistry: ToolRegistry
  private toolCtx: ToolContext
  private skills: Skill[]
  private options: AgentOptions
  private confirmFn?: ConfirmFn
  private askUserFn?: AskUserFn
  private maxIterations: number
  private maxTokens: number
  private currentIteration = 0
  private planState = new PlanState()

  constructor(deps: {
    conversation: Conversation
    toolRegistry: ToolRegistry
    toolCtx: ToolContext
    skills?: Skill[]
    options?: AgentOptions
  }) {
    this.conversation = deps.conversation
    this.llmClient = createLlmClient(deps.options?.llmConfig)
    this.model = deps.options?.llmConfig?.model ?? getDefaultModel()
    this.skills = deps.skills ?? []
    this.systemPrompt = buildSystemPrompt(
      deps.conversation.projectContext,
      this.skills,
      deps.options?.projectMemory,
    )
    this.toolRegistry = deps.toolRegistry
    this.toolCtx = deps.toolCtx
    this.options = deps.options ?? {}
    this.confirmFn = deps.options?.confirmFn
    this.askUserFn = deps.options?.askUserFn
    this.maxIterations = deps.options?.maxIterations ?? 30
    this.maxTokens = deps.options?.maxTokens ?? 4096
  }

  /** 重建 system prompt（project context 变化时调用） */
  rebuildSystemPrompt(): void {
    this.systemPrompt = buildSystemPrompt(
      this.conversation.projectContext,
      this.skills,
    )
  }

  /** 获取底层 Conversation（供外部读取状态） */
  getConversation(): Conversation {
    return this.conversation
  }

  /** 发送用户消息，启动 agent 循环 */
  async *sendMessage(input: string): AsyncGenerator<AgentEvent> {
    this.currentIteration = 0
    this.conversation.addUser(input)

    // 自动压缩：发送前检查上下文是否超限
    if (this.conversation.needsCompact()) {
      console.error('[AgentLoop] 上下文接近窗口上限，触发自动压缩...')
      try {
        const compacted = await this.conversation.compact(this.llmClient, this.model)
        if (compacted > 0) {
          yield { type: 'assistant_text', text: `\n[系统] 上下文已自动压缩（${compacted} 条历史消息被摘要替代）\n\n` }
        }
      } catch (err) {
        console.error('[AgentLoop] 自动压缩失败:', err)
      }
    }

    let lastUsage: TokenUsage | undefined

    while (this.currentIteration < this.maxIterations) {
      this.currentIteration++
      console.error(`[AgentLoop] === 迭代 #${this.currentIteration} ===`)

      try {
        const messages = this.buildMessages()
        console.error(`[AgentLoop] 发送 ${messages.length} 条消息`)

        logRequest(messages as Array<{ role: string; content: string }>)

        const response = await this.llmClient.chat.completions.create({
          model: this.model,
          messages,
          max_tokens: this.maxTokens,
          stream: this.options.stream ?? true,
          stream_options: { include_usage: true },
        })

        // stream=true 时返回 AsyncIterable<ChatCompletionChunk>
        const stream = response as AsyncIterable<ChatCompletionChunk>

        let fullText = ''
        let thinkingCount = 0
        let contentCount = 0

        for await (const chunk of stream) {
          // 提取 usage（在最后一个 chunk 中）
          const usage = chunk.usage
          if (usage) {
            lastUsage = {
              inputTokens: usage.prompt_tokens ?? 0,
              outputTokens: usage.completion_tokens ?? 0,
            }
          }

          const delta = chunk.choices?.[0]?.delta
          if (!delta) continue

          const reasoning = (delta as any).reasoning_content
          if (reasoning) {
            thinkingCount++
            yield { type: 'thinking', text: reasoning }
          }

          if (delta.content) {
            contentCount++
            fullText += delta.content
            yield { type: 'assistant_text', text: delta.content }
          }
        }

        console.error(`[AgentLoop] 流结束: thinking=${thinkingCount}chunks content=${contentCount}chunks fullText=${fullText.length}字符 usage=${lastUsage ? `${lastUsage.inputTokens}/${lastUsage.outputTokens}` : 'N/A'}`)

        logResponse(fullText, lastUsage)

        const calls = extractToolCalls(fullText)

        // 检测不完整的 <tool 标签（qwq 模型常见：输出了 <tool 但没闭合）
        const hasUnclosedTool = fullText.includes('<tool') && calls.length === 0
        if (hasUnclosedTool) {
          console.error(`[AgentLoop] 检测到不完整的 <tool 标签，请求模型继续`)
          // 把不完整的标签清理掉，存入历史，然后继续循环让模型补全
          const cleaned = fullText.replace(/<tool[^>]*>?\s*$/s, '').trim()
          this.conversation.addAssistant(cleaned || '[正在调用工具...]')
          this.conversation.addToolResult('工具调用格式不完整，请重新输出完整的 <tool name="...">JSON</tool> 格式。')
          // 继续循环让模型重试
          continue
        }

        if (calls.length > 0) {
          console.error(`[AgentLoop] 找到 ${calls.length} 个工具调用: ${calls.map(c => c.name).join(', ')}`)

          const cleanText = cleanToolTags(fullText, calls)
          this.conversation.addAssistant(cleanText)

          // 执行每个工具
          for (const tc of calls) {
            // ─── plan_create 特殊处理 ──────────────────────────
            if (tc.name === 'plan_create') {
              console.error('[AgentLoop] 检测到 plan_create 调用')
              logToolCall(tc.name, tc.input)
              yield { type: 'tool_call', tool: tc.name, input: tc.input }

              const parsed = planCreateSchema.safeParse(tc.input)
              if (!parsed.success) {
                const errMsg = `计划格式错误: ${parsed.error.message}`
                yield { type: 'error', error: errMsg }
                this.conversation.addToolResult(`错误: ${errMsg}`)
                continue
              }

              const plan = parsed.data as Plan
              yield { type: 'plan_summary', plan }

              // 请求用户审批整个计划
              const itemCount = plan.items.length
              const desc = `创建「${plan.title}」系统（共 ${itemCount} 项）`
              const summaryLines = plan.items
                .map((item, i) => `  ${i + 1}. [${item.type === 'page' ? '页面' : '接口'}] ${item.description} → ${item.filePath}`)
                .join('\n')

              let approved = false
              if (this.confirmFn) {
                approved = await this.confirmFn('plan_create', desc, summaryLines)
              } else {
                approved = true // 无确认函数时自动批准
              }

              if (approved) {
                this.planState.setPlan(plan)
                this.planState.approve()
                console.error(`[AgentLoop] 计划已批准: ${plan.title} (${itemCount} 项)`)

                yield {
                  type: 'tool_result',
                  tool: tc.name,
                  success: true,
                  message: `计划已批准，共 ${itemCount} 项。正在批量执行...`,
                }

                // 注入批量执行指令到对话历史
                const batchPrompt = buildBatchExecutionPrompt(plan)
                this.conversation.addToolResult(
                  `计划已批准。\n\n${batchPrompt}`,
                )
              } else {
                this.planState.reject()
                console.error('[AgentLoop] 计划被拒绝')
                yield {
                  type: 'tool_result',
                  tool: tc.name,
                  success: false,
                  message: '用户拒绝此计划',
                }
                this.conversation.addToolResult('用户拒绝了此计划。请重新规划或询问用户需要调整什么。')
              }
              continue
            }

            // ─── ask_user 特殊处理 ──────────────────────────
            if (tc.name === 'ask_user') {
              console.error('[AgentLoop] 检测到 ask_user 调用')
              logToolCall(tc.name, tc.input)
              yield { type: 'tool_call', tool: tc.name, input: tc.input }

              const parsed = askUserSchema.safeParse(tc.input)
              if (!parsed.success) {
                const errMsg = `提问格式错误: ${parsed.error.message}`
                yield { type: 'error', error: errMsg }
                this.conversation.addToolResult(`错误: ${errMsg}`)
                continue
              }

              const askData = parsed.data
              yield { type: 'ask_user', question: askData }

              let answer: string
              if (this.askUserFn) {
                answer = await this.askUserFn(askData)
              } else {
                answer = '(无回答回调，默认继续)'
              }

              yield {
                type: 'tool_result',
                tool: tc.name,
                success: true,
                message: answer,
              }
              this.conversation.addToolResult(`用户回答: ${answer}`)
              continue
            }

            // ─── 常规工具处理 ──────────────────────────────────
            yield { type: 'tool_call', tool: tc.name, input: tc.input }
            logToolCall(tc.name, tc.input)

            const tool = this.toolRegistry.get(tc.name)
            if (!tool) {
              const errMsg = `未知工具: ${tc.name}`
              yield { type: 'error', error: errMsg }
              this.conversation.addToolResult(`错误: ${errMsg}。请使用正确的工具名称。`)
              continue
            }

            const parsedInput = tool.inputSchema.safeParse(tc.input)
            if (!parsedInput.success) {
              const errMsg = `输入验证失败: ${parsedInput.error.message}`
              yield { type: 'error', error: errMsg }
              this.conversation.addToolResult(`错误: ${errMsg}`)
              continue
            }

            // 写操作确认（批量模式下跳过单个确认）
            const isWriteOp = !tool.isReadOnly
            if (isWriteOp && this.confirmFn && !this.planState.isBatchMode()) {
              const desc = tc.name === 'delete_file'
                ? `删除文件 ${(parsedInput.data as any).file_path ?? (parsedInput.data as any).path}`
                : tc.name === 'write_json'
                  ? `写入文件 ${(parsedInput.data as any).file_path}`
                  : tc.name === 'modify_json'
                    ? `修改文件 ${(parsedInput.data as any).file_path}`
                    : tc.name === 'move_file'
                      ? `移动文件 ${(parsedInput.data as any).source_path} → ${(parsedInput.data as any).target_path}`
                      : `执行 ${tc.name}`
              const preview = tc.name === 'write_json'
                ? (parsedInput.data as any).content
                  ? JSON.stringify((parsedInput.data as any).content, null, 2)
                  : undefined
                : undefined

              const confirmed = await this.confirmFn(tc.name, desc, preview)
              if (!confirmed) {
                yield { type: 'tool_result', tool: tc.name, success: false, message: '用户拒绝执行' }
                this.conversation.addToolResult('用户拒绝执行此操作，请重新规划。')
                continue
              }
            }

            const result = await tool.handler(parsedInput.data, this.toolCtx)
            yield {
              type: 'tool_result',
              tool: tc.name,
              success: result.success,
              message: result.message,
            }
            logToolResult(tc.name, result.success, result.message)
            this.conversation.addToolResult(
              result.success
                ? result.message
                : `执行失败: ${result.error || result.message}`,
            )

            // 文件变更操作成功后，刷新项目上下文和系统提示词
            if (result.success && isWriteOp) {
              try {
                await this.conversation.refreshProjectContext()
                this.rebuildSystemPrompt()
                console.error(`[AgentLoop] 项目上下文已刷新: ${this.conversation.projectContext.files.length} 个文件`)
              } catch (err) {
                console.error('[AgentLoop] 刷新项目上下文失败:', err)
              }
            }
          }

          // 有工具调用 → 继续循环
        } else {
          console.error(`[AgentLoop] 无工具调用，结束循环`)
          this.conversation.addAssistant(fullText)
          break
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        console.error(`[AgentLoop] 异常: ${errorMsg}`)
        logLlmError(errorMsg)
        yield { type: 'error', error: errorMsg }
        break
      }
    }

    if (this.currentIteration >= this.maxIterations) {
      yield { type: 'error', error: '达到最大迭代次数限制' }
    }

    // 每轮对话结束时 yield turn_end 携带 token 统计
    yield { type: 'turn_end', usage: lastUsage }
  }

  /** 构建 OpenAI API 消息列表 */
  private buildMessages(): ChatCompletionMessageParam[] {
    let systemContent = this.systemPrompt

    // 如果有压缩摘要，注入到 system prompt
    const summary = this.conversation.getSummary()
    if (summary) {
      systemContent += `\n\n## 之前的对话摘要\n\n${summary}`
    }

    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: systemContent },
    ]
    for (const msg of this.conversation.getMessages()) {
      if (msg.role === 'tool') {
        messages.push({ role: 'user', content: msg.content })
      } else {
        messages.push({ role: msg.role as 'user' | 'assistant', content: msg.content })
      }
    }
    return messages
  }
}
