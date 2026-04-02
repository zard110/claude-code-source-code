/**
 * Terminal UI — 终端显示层
 *
 * 职责：
 * - 管理 readline 用户输入
 * - 渲染 agent 事件（spinner、thinking、tool badge、结果）
 * - 用户确认流程
 *
 * 不包含任何 Agent 逻辑，只消费 AgentEvent
 */
import * as readline from 'node:readline'
import chalk from 'chalk'
import type { AgentEvent, ConfirmFn, TokenUsage, AskUserFn, AskUserInput } from '../agent/core.js'
import { SpinnerManager } from '../utils/spinner.js'
import { formatToolInput, formatToolResult, highlightJson, previewBox } from '../utils/format.js'
import { formatPlanSummary } from '../agent/plan.js'

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

export class TerminalUI {
  private spinner = new SpinnerManager()
  private rl: readline.Interface

  constructor(
    private input: NodeJS.ReadableStream = process.stdin,
    private output: NodeJS.WritableStream = process.stdout,
  ) {
    this.rl = readline.createInterface({
      input: this.input as any,
      output: this.output as any,
    })
  }

  /** 等待用户输入 */
  promptUser(): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(chalk.green.bold('> '), (answer) => resolve(answer.trim()))
    })
  }

  /** 显示欢迎信息 */
  showWelcome(workDir: string): void {
    this.write(chalk.cyan.bold('\n  低代码 JSON Agent'))
    this.write(chalk.gray(`  工作目录: ${workDir}`))
    this.write(chalk.gray('  输入需求，Enter 发送。输入 exit 退出。\n'))
  }

  /** 显示告别 */
  showGoodbye(): void {
    this.write(chalk.gray('\n  再见！'))
    this.rl.close()
  }

  /** 获取确认回调函数（注入到 AgentCore） */
  getConfirmFn(): ConfirmFn {
    return async (tool: string, description: string, preview?: string) => {
      this.spinner.stop()
      this.write('')
      this.write(chalk.yellow(`  ⚠ 需要确认: ${description}`))

      if (preview) {
        this.write(previewBox(tool, highlightJson(preview, 15)))
      }

      const confirmed = await this.askConfirm('确认执行?')
      this.write(confirmed ? chalk.green('  ✓ 已确认') : chalk.red('  ✗ 已拒绝'))
      this.write('')
      return confirmed
    }
  }

  /** 获取工具执行进度回调函数（注入到 AgentCore） */
  getProgressFn(): (message: string) => void {
    return (message: string) => {
      this.spinner.update(message)
    }
  }

  /** 获取用户提问回调函数（注入到 AgentCore） */
  getAskUserFn(): AskUserFn {
    return async (question: AskUserInput): Promise<string> => {
      this.spinner.stop()
      this.write('')
      this.write(chalk.cyan.bold(`  ❓ ${question.question}`))

      question.options.forEach((opt, i) => {
        this.write(chalk.white(`    ${i + 1}. ${opt}`))
      })

      if (question.allow_custom) {
        this.write(chalk.gray('    0. 自定义输入'))
      }

      const answer = await new Promise<string>((resolve) => {
        this.rl.question(chalk.green('  请选择: '), (input) => {
          const choice = input.trim()
          const num = parseInt(choice, 10)

          if (!isNaN(num)) {
            if (num >= 1 && num <= question.options.length) {
              resolve(question.options[num - 1])
            } else if (num === 0 && question.allow_custom) {
              this.rl.question(chalk.green('  请输入: '), (custom) => {
                resolve(custom.trim() || question.options[0])
              })
            } else {
              resolve(choice)
            }
          } else {
            resolve(choice)
          }
        })
      })

      this.write(chalk.green(`  ✓ 已选择: ${answer}`))
      this.write('')
      return answer
    }
  }

  /** 渲染一个 agent 事件的完整循环 */
  renderEvent(event: AgentEvent, ctx: RenderContext): void {
    switch (event.type) {
      case 'thinking': {
        if (ctx.lastEventType !== 'thinking') {
          ctx.thinkingStart = Date.now()
          ctx.tokenCount = 0
          this.spinner.startThinking()
        }
        // 粗略估算 thinking token（按字符数）
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
        // 粗略估算输出 token
        ctx.tokenCount += text.length

        if (ctx.displayBuffer.includes('<tool')) {
          ctx.hasToolTag = true
        } else if (ctx.hasToolTag) {
          if (text.trim()) {
            process.stdout.write(chalk.white(text))
          }
        } else {
          process.stdout.write(chalk.white(text))
        }
        break
      }

      case 'tool_call': {
        this.spinner.stop()
        if (ctx.lastEventType === 'thinking') {
          const elapsed = formatElapsed(Date.now() - ctx.thinkingStart)
          this.writeLine(chalk.dim(`  💭 思考完成 (${elapsed})`))
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

      case 'ask_user': {
        this.spinner.stop()
        this.writeLine('')
        this.writeLine(chalk.cyan.bold(`  ❓ ${event.question.question}`))
        event.question.options.forEach((opt, i) => {
          this.writeLine(chalk.white(`    ${i + 1}. ${opt}`))
        })
        if (event.question.allow_custom) {
          this.writeLine(chalk.gray('    0. 自定义输入'))
        }
        this.writeLine('')
        break
      }

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

  /** 渲染循环结束的尾部处理 */
  renderTail(ctx: RenderContext): void {
    this.spinner.stop()
    if (ctx.lastEventType === 'assistant_text') {
      process.stdout.write('\n')
    }
    if (ctx.lastEventType === 'thinking') {
      const elapsed = formatElapsed(Date.now() - ctx.thinkingStart)
      this.writeLine(chalk.dim(`  💭 思考完成 (${elapsed})`))
    }
    this.writeLine('')
  }

  /** 创建新的渲染上下文 */
  createRenderContext(): RenderContext {
    return {
      lastEventType: '',
      thinkingStart: 0,
      displayBuffer: '',
      hasToolTag: false,
      tokenCount: 0,
    }
  }

  /** 停止 spinner */
  stopSpinner(): void {
    this.spinner.stop()
  }

  // ─── 内部方法 ──────────────────────────────────────────

  private write(text: string): void {
    this.output.write(text + '\n')
  }

  /** 输出一行文本 */
  writeLine(text: string): void {
    this.output.write(text + '\n')
  }

  private askConfirm(question: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.rl.question(chalk.yellow(`  ${question} (y/n): `), (answer) => {
        resolve(answer.trim().toLowerCase() === 'y')
      })
    })
  }
}

export interface RenderContext {
  lastEventType: string
  thinkingStart: number
  displayBuffer: string
  hasToolTag: boolean
  /** 当前轮次累计输出 token 估算（按字符数粗算） */
  tokenCount: number
}
