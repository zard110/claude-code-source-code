/**
 * SDK — 无 UI 的编程接口
 *
 * 直接调用 Agent Core，适合：
 * - 自动化脚本
 * - 测试
 * - Web API 后端
 * - CI/CD 集成
 *
 * 灵感来自 Claude Code 的 entrypoints/agentSdkTypes.ts
 */
import { config } from 'dotenv'
import { resolve } from 'node:path'

config({ path: resolve(import.meta.dirname, '..', '.env.local') })

import { AgentLoop, Conversation } from './agent/core.js'
import type { AgentEvent, ConfirmFn, LlmConfig, AgentOptions, Message, AskUserFn, AskUserInput } from './agent/core.js'
import { createDefaultRegistry } from './tools/registry.js'
import { buildProjectContext, createToolContext } from './agent/context.js'
import { SkillRegistry } from './skills/registry.js'

export type { AgentEvent, ConfirmFn, LlmConfig, AgentOptions, Message, AskUserFn, AskUserInput }

/**
 * SDK 调用结果
 */
export interface SDKResult {
  /** 所有事件 */
  events: AgentEvent[]
  /** 最终文本回复 */
  text: string
  /** 工具调用记录 */
  toolCalls: Array<{ tool: string; input: unknown }>
  /** 工具执行结果 */
  toolResults: Array<{ tool: string; success: boolean; message: string }>
  /** 错误 */
  errors: Array<{ error: string }>
  /** 是否有 thinking */
  hadThinking: boolean
}

/**
 * 创建 SDK 实例
 */
export function createSDK(deps?: {
  workDir?: string
  skills?: Array<{ name: string; description: string; systemPrompt?: string }>
  options?: AgentOptions
}) {
  const workDir = resolve(deps?.workDir || '.')
  const skillRegistry = new SkillRegistry()
  for (const s of deps?.skills ?? []) {
    skillRegistry.register(s)
  }

  const toolRegistry = createDefaultRegistry()
  skillRegistry.applyTools(toolRegistry)
  const toolCtx = createToolContext(workDir)

  return {
    /**
     * 发送消息，收集所有事件后返回
     */
    async query(input: string, options?: { history?: Message[] }): Promise<SDKResult> {
      const projectCtx = await buildProjectContext(workDir)
      const history = options?.history ?? []
      const conversation = new Conversation(history, projectCtx)

      const loop = new AgentLoop({
        conversation,
        toolRegistry,
        toolCtx,
        skills: skillRegistry.getAll(),
        options: deps?.options,
      })

      const result: SDKResult = {
        events: [],
        text: '',
        toolCalls: [],
        toolResults: [],
        errors: [],
        hadThinking: false,
      }

      for await (const event of loop.sendMessage(input)) {
        result.events.push(event)

        switch (event.type) {
          case 'thinking':
            result.hadThinking = true
            break
          case 'assistant_text':
            result.text += event.text
            break
          case 'tool_call':
            result.toolCalls.push({ tool: event.tool, input: event.input })
            break
          case 'tool_result':
            result.toolResults.push({ tool: event.tool, success: event.success, message: event.message })
            break
          case 'error':
            result.errors.push({ error: event.error })
            break
          case 'ask_user':
            break
        }
      }

      // 同步回 history 数组（如果外部传入了）
      if (options?.history) {
        options.history.length = 0
        options.history.push(...conversation.getMessages())
      }

      return result
    },

    /**
     * 发送消息，流式返回事件
     */
    async *stream(input: string, options?: { history?: Message[] }): AsyncGenerator<AgentEvent> {
      const projectCtx = await buildProjectContext(workDir)
      const history = options?.history ?? []
      const conversation = new Conversation(history, projectCtx)

      const loop = new AgentLoop({
        conversation,
        toolRegistry,
        toolCtx,
        skills: skillRegistry.getAll(),
        options: deps?.options,
      })

      for await (const event of loop.sendMessage(input)) {
        yield event
      }

      // 同步回 history
      if (options?.history) {
        options.history.length = 0
        options.history.push(...conversation.getMessages())
      }
    },
  }
}
