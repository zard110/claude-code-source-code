/**
 * Terminal UI — 终端显示层
 *
 * 职责：
 * - 用户输入（clack text + autocomplete，模型名提示符）
 * - 渲染 agent 事件（spinner、thinking、tool badge、结果）
 * - Markdown 渲染（表格、粗体、列表等）
 * - 用户确认/选择流程（clack）
 *
 * 不包含任何 Agent 逻辑，只消费 AgentEvent
 */
import * as readline from 'node:readline'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import chalk from 'chalk'
import * as clack from '@clack/prompts'
import type { AgentEvent, ConfirmFn, AskUserFn, AskUserInput } from '../agent/core.js'
import { SpinnerManager } from '../utils/spinner.js'
import { formatToolInput, formatToolResult, highlightJson, previewBox } from '../utils/format.js'
import { formatPlanSummary } from '../agent/plan.js'
import { renderMarkdown } from '../utils/markdown.js'

/** 格式化经过时间 */
function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  if (totalSec < 60) return `${totalSec}s`
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  if (min < 60) return `${min}m ${sec}s`
  const hr = Math.floor(min / 60)
  return `${hr}h ${min % 60}m`
}

// ─── 命令补全项 ──────────────────────────────────────────

export interface CompletionItem {
  name: string
  description: string
}

// ─── TerminalUI ─────────────────────────────────────────

export class TerminalUI {
  private spinner = new SpinnerManager()
  private completionItems: CompletionItem[] = []
  private inputHistory: string[] = []
  private modelName = ''
  private historyFile = ''
  private ctrlCCount = 0
  private ctrlCTimer: ReturnType<typeof setTimeout> | null = null

  constructor(
    private input: NodeJS.ReadableStream = process.stdin,
    private output: NodeJS.WritableStream = process.stdout,
  ) {}

  /** 设置补全候选 */
  setCompletions(items: CompletionItem[]): void {
    this.completionItems = items
  }

  /** 设置当前模型名 */
  setModelName(name: string): void {
    this.modelName = name
  }

  /** 加载历史文件 */
  async initHistory(filePath: string): Promise<void> {
    this.historyFile = filePath
    try {
      await mkdir(dirname(filePath), { recursive: true })
      const content = await readFile(filePath, 'utf-8')
      if (content.trim()) {
        this.inputHistory = content.split('\n').filter(l => l.trim()).reverse()
      }
    } catch {
      this.inputHistory = []
    }
  }

  /** 保存历史到文件 */
  async saveHistory(): Promise<void> {
    if (!this.historyFile) return
    try {
      await mkdir(dirname(this.historyFile), { recursive: true })
      const lines = this.inputHistory.slice().reverse().join('\n')
      await writeFile(this.historyFile, lines, 'utf-8')
    } catch { /* silent */ }
  }

  /** 提示符文本 */
  private promptMsg(): string {
    return this.modelName ? `> [${this.modelName}]` : '>'
  }

  /**
   * 等待用户输入
   *
   * 使用 clack.text 做普通输入，clack.autocomplete 做 / 命令补全。
   * 所有 raw mode / ANSI 处理由 clack 负责，不自己造轮子。
   */
  async promptUser(): Promise<string> {
    while (true) {
      const result = await clack.text({
        message: this.promptMsg(),
        placeholder: '输入消息，/ 查看命令',
        validate: (v) => {
          if (v === '__exit__') return ''
          return undefined
        },
      })

      // Ctrl+C 处理
      if (clack.isCancel(result)) {
        this.ctrlCCount++
        if (this.ctrlCCount >= 2) {
          this.ctrlCCount = 0
          if (this.ctrlCTimer) clearTimeout(this.ctrlCTimer)
          return ''  // 退出
        }
        clack.log.warn('再按一次 Ctrl+C 退出（或输入 exit）')
        if (this.ctrlCTimer) clearTimeout(this.ctrlCTimer)
        this.ctrlCTimer = setTimeout(() => { this.ctrlCCount = 0 }, 2000)
        continue
      }

      this.ctrlCCount = 0

      let input = (result as string).trim()

      // 空输入 → 继续
      if (!input) continue

      // / 命令 → 用 autocomplete 让用户选择
      if (input.startsWith('/')) {
        // 先看看是不是直接匹配某个命令
        const directMatch = this.completionItems.find(
          c => c.name === input || c.name === input.split(' ')[0]
        )
        if (directMatch) {
          // 直接匹配，保留完整输入（可能带参数）
          this.pushHistory(input)
          return input
        }

        // 不完整命令 → 弹出 autocomplete
        const slashResult = await clack.autocomplete({
          message: '选择命令',
          options: this.completionItems.map(c => ({
            label: c.name,
            value: c.name,
            hint: c.description,
          })),
          initialValue: input,
        })

        if (clack.isCancel(slashResult)) continue

        const selected = slashResult as string
        // 可能还有后续参数
        const parts = input.split(' ')
        const extraArgs = parts.length > 1 ? ' ' + parts.slice(1).join(' ') : ''
        const finalInput = selected + extraArgs
        this.pushHistory(finalInput)
        return finalInput
      }

      // 普通输入
      this.pushHistory(input)
      return input
    }
  }

  private pushHistory(item: string): void {
    this.inputHistory = [item, ...this.inputHistory.filter(h => h !== item)].slice(0, 200)
  }

  /** 显示欢迎信息 */
  showWelcome(workDir: string): void {
    this.write(chalk.cyan.bold('\n  低代码 JSON Agent'))
    this.write(chalk.gray(`  工作目录: ${workDir}`))
    this.write(chalk.gray('  输入需求，Enter 发送。/ 查看命令，exit 退出。\n'))
  }

  /** 显示告别 */
  showGoodbye(): void {
    this.write(chalk.gray('\n  再见！'))
  }

  /** 获取确认回调函数 */
  getConfirmFn(): ConfirmFn {
    return async (tool: string, description: string, preview?: string) => {
      this.spinner.stop()
      if (preview) {
        this.writeLine('')
        this.writeLine(previewBox(tool, highlightJson(preview, 15)))
      }
      const result = await clack.confirm({ message: `⚠ ${description}` })
      if (clack.isCancel(result)) return false
      return result as boolean
    }
  }

  /** 获取进度回调 */
  getProgressFn(): (message: string) => void {
    return (message: string) => { this.spinner.update(message) }
  }

  /** 获取用户提问回调 */
  getAskUserFn(): AskUserFn {
    return async (question: AskUserInput): Promise<string> => {
      this.spinner.stop()
      const options = question.options.map((opt) => ({ label: opt, value: opt }))
      if (question.allow_custom) {
        options.push({ label: '自定义输入...', value: '__custom__' })
      }
      const result = await clack.select({ message: question.question, options })
      if (clack.isCancel(result)) return question.options[0] ?? ''
      if (result === '__custom__') {
        const custom = await clack.text({ message: '请输入' })
        if (clack.isCancel(custom)) return question.options[0] ?? ''
        return custom as string
      }
      return result as string
    }
  }

  /** 渲染 agent 事件 */
  renderEvent(event: AgentEvent, ctx: RenderContext): void {
    switch (event.type) {
      case 'thinking': {
        if (ctx.lastEventType !== 'thinking') {
          ctx.thinkingStart = Date.now()
          ctx.tokenCount = 0
          this.spinner.startThinking()
        }
        ctx.tokenCount += event.text.length
        this.spinner.addToken(event.text.length)
        break
      }
      case 'assistant_text': {
        if (ctx.lastEventType === 'thinking') {
          this.spinner.stop()
          const elapsed = ((Date.now() - ctx.thinkingStart) / 1000).toFixed(1)
          this.writeLine(chalk.dim(`  💭 思考完成 (${elapsed}s)`))
          this.writeLine('')
        }
        const text = event.text
        ctx.displayBuffer += text
        ctx.tokenCount += text.length
        if (ctx.displayBuffer.includes('<tool')) {
          ctx.hasToolTag = true
          this.spinner.update('生成工具调用...')
        } else if (ctx.hasToolTag) {
          // skip
        } else {
          ctx.streamedLength += text.length
          if (ctx.streamedLength <= text.length + 1) {
            this.spinner.startOutput()
          }
        }
        break
      }
      case 'system_notice': {
        this.spinner.stop()
        this.writeLine(chalk.dim(`  ✻ ${event.text}`))
        break
      }
      case 'tool_call': {
        if (event.tool === 'ask_user') break
        this.spinner.stop()
        if (ctx.displayBuffer && !ctx.hasToolTag) {
          this.writeLine(renderMarkdown(ctx.displayBuffer))
          ctx.displayBuffer = ''
        }
        if (ctx.lastEventType === 'thinking') {
          this.writeLine(chalk.dim(`  💭 思考完成 (${formatElapsed(Date.now() - ctx.thinkingStart)})`))
        }
        if (ctx.lastEventType === 'assistant_text' || ctx.lastEventType === 'thinking') {
          process.stdout.write('\n')
        }
        ctx.hasToolTag = false
        ctx.displayBuffer = ''
        this.writeLine('')
        this.writeLine(formatToolInput(event.tool, event.input))
        this.spinner.startTool(event.tool)
        break
      }
      case 'tool_result': {
        this.spinner.stop()
        this.writeLine(formatToolResult(event.tool, event.success, event.message))
        this.writeLine('')
        break
      }
      case 'plan_summary': {
        this.spinner.stop()
        this.writeLine('')
        this.writeLine(chalk.cyan(formatPlanSummary(event.plan)))
        this.writeLine(chalk.yellow('  等待确认...'))
        this.writeLine('')
        break
      }
      case 'ask_user': break
      case 'error': {
        this.spinner.stop()
        this.writeLine(chalk.red(`  ⚠ ${event.error}`))
        this.writeLine('')
        break
      }
      case 'turn_end': {
        if (event.usage) {
          const { inputTokens, outputTokens } = event.usage
          this.writeLine(chalk.dim(`  ⬆️ ${inputTokens} ⬇️ ${outputTokens} tokens`))
          this.writeLine('')
        }
        break
      }
    }
    ctx.lastEventType = event.type
  }

  renderTail(ctx: RenderContext): void {
    this.spinner.stop()
    if (ctx.displayBuffer && !ctx.hasToolTag) {
      this.writeLine(renderMarkdown(ctx.displayBuffer))
      ctx.displayBuffer = ''
    }
    if (ctx.lastEventType === 'thinking') {
      this.writeLine(chalk.dim(`  💭 思考完成 (${formatElapsed(Date.now() - ctx.thinkingStart)})`))
    }
    this.writeLine('')
  }

  createRenderContext(): RenderContext {
    return { lastEventType: '', thinkingStart: 0, displayBuffer: '', hasToolTag: false, tokenCount: 0, streamedLength: 0 }
  }

  stopSpinner(): void { this.spinner.stop() }

  private write(text: string): void { this.output.write(text + '\n') }
  writeLine(text: string): void { this.output.write(text + '\n') }
}

export interface RenderContext {
  lastEventType: string
  thinkingStart: number
  displayBuffer: string
  hasToolTag: boolean
  tokenCount: number
  streamedLength: number
}
