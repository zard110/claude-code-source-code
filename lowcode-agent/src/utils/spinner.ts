/**
 * Spinner 管理器 — Claude Code 风格
 *
 * 效果:
 *   ✱ Computing... (2m 7s · ↓ 1.8k tokens)
 *   Tip: 你可以随时输入 /help 查看帮助
 *
 * 特性:
 * - ✱ 旋转动画
 * - 人类可读的经过时间 (2m 7s)
 * - 流式 token 计数
 * - 随机提示行
 * - Stalled 检测 (5s 无更新 → 标记)
 */

// ─── ✱ 旋转动画帧 ──────────────────────────────────────

const SPINNER_FRAMES = ['✱', '✵', '✶', '✷', '✸', '✹', '✺', '✻']

// ─── 颜色 ──────────────────────────────────────────────

const BOLD_RED = '\x1b[1;31m'    // thinking 状态：红色
const BOLD_CYAN = '\x1b[1;36m'   // 工具执行状态：青色
const DIM = '\x1b[2m'
const RESET = '\x1b[0m'
const DARK_GRAY = '\x1b[38;5;240m'

// ─── 状态文本 ──────────────────────────────────────────

const THINKING_VERBS = ['思考中', '分析中', '推理中', '生成中']
const TOOL_VERBS: Record<string, string> = {
  write_json: '写入文件',
  write_files: '批量写入',
  read_json: '读取文件',
  modify_json: '修改文件',
  delete_file: '删除文件',
  delete_files: '批量删除',
  list_files: '列出文件',
  move_file: '移动文件',
  plan_create: '制定计划',
  ask_user: '询问用户',
}
const DEFAULT_TOOL_VERB = '执行中'

// ─── 随机提示 ──────────────────────────────────────────

const TIPS = [
  '输入 help 查看可用命令',
  '修改文件前会先读取，确保安全',
  '支持批量创建系统，先计划再执行',
  '可以用自然语言描述你的需求',
  '所有文件操作都会先询问确认',
  '输入 exit 可以退出程序',
  '支持移动和重命名文件',
  '支持精确修改 JSON 的指定节点',
]

let tipIndex = Math.floor(Math.random() * TIPS.length)

function nextTip(): string {
  const tip = TIPS[tipIndex % TIPS.length]
  tipIndex++
  return tip
}

// ─── 工具函数 ──────────────────────────────────────────

/** 格式化经过时间为人类可读格式 */
function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  if (totalSec < 60) return `${totalSec}s`

  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  if (min < 60) return `${min}m ${sec}s`

  const hr = Math.floor(min / 60)
  const remainMin = min % 60
  return `${hr}h ${remainMin}m`
}

/** 格式化 token 数量 */
function formatTokens(count: number): string {
  if (count < 1000) return `${count}`
  if (count < 10000) return `${(count / 1000).toFixed(1)}k`
  return `${Math.round(count / 1000)}k`
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

// ─── SpinnerManager ────────────────────────────────────

export class SpinnerManager {
  private frameIdx = 0
  private timer: ReturnType<typeof setInterval> | null = null
  private label = ''
  private startTime = 0
  private lastTokenTime = 0
  private streamingTokens = 0
  private tip = ''
  private mode: 'thinking' | 'tool' = 'thinking'

  start(label: string, mode: 'thinking' | 'tool' = 'thinking'): void {
    this.stop()
    this.label = label
    this.mode = mode
    this.startTime = Date.now()
    this.lastTokenTime = Date.now()
    this.frameIdx = 0
    this.streamingTokens = 0
    this.tip = nextTip()
    this.timer = setInterval(() => this.render(), 80)
  }

  startThinking(): void {
    this.start(randomItem(THINKING_VERBS) + '...', 'thinking')
  }

  startTool(toolName: string): void {
    const verb = TOOL_VERBS[toolName] ?? DEFAULT_TOOL_VERB
    this.start(`${verb}...`, 'tool')
  }

  /** 收到一个流式 token */
  addToken(count: number = 1): void {
    this.streamingTokens += count
    this.lastTokenTime = Date.now()
  }

  update(label?: string): void {
    this.lastTokenTime = Date.now()
    if (label) this.label = label
  }

  stop(finalMessage?: string): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    process.stdout.write('\r\x1b[K')
    if (finalMessage) {
      process.stdout.write(finalMessage + '\n')
    }
  }

  getElapsed(): number {
    return this.startTime > 0 ? (Date.now() - this.startTime) / 1000 : 0
  }

  private render(): void {
    const frame = SPINNER_FRAMES[this.frameIdx % SPINNER_FRAMES.length]
    this.frameIdx++

    const elapsedMs = Date.now() - this.startTime
    const elapsed = formatElapsed(elapsedMs)
    const stalled = Date.now() - this.lastTokenTime > 5000

    // 构建状态行
    let tokenPart = ''
    if (this.streamingTokens > 0) {
      tokenPart = ` · ↓ ${formatTokens(this.streamingTokens)} tokens`
    }

    // thinking 用红色，工具执行用青色
    const frameColor = this.mode === 'tool' ? BOLD_CYAN : BOLD_RED
    const stallMark = stalled ? ' ⚠' : ''
    const line = `${frameColor}${frame}${RESET} ${this.label} (${DIM}${elapsed}${RESET}${tokenPart})${stallMark}`

    // 提示行
    const tipLine = `${DARK_GRAY}  Tip: ${this.tip}${RESET}`

    // \r 回到行首, \x1b[K 清除到行尾, \x1b[1A 上移一行
    // 先清除上一帧的两行，再写入新内容
    process.stdout.write(`\r\x1b[K${line}\n\x1b[K${tipLine}\r\x1b[1A`)
  }
}
