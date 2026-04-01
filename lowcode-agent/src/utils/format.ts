/**
 * 终端格式化工具 — 灵感来自 Claude Code 的 AssistantToolUseMessage 组件
 *
 * 特性:
 * - JSON 语法高亮
 * - Diff 格式化
 * - 工具名称彩色 badge
 * - 截断长内容
 */

import chalk from 'chalk'

// ─── 工具 Badge 颜色映射 ────────────────────────────────

const TOOL_COLORS: Record<string, { bg: string; fg: string }> = {
  read_json:    { bg: '\x1b[44m', fg: '\x1b[37m' },  // blue bg, white fg
  write_json:   { bg: '\x1b[42m', fg: '\x1b[30m' },  // green bg, black fg
  modify_json:  { bg: '\x1b[43m', fg: '\x1b[30m' },  // yellow bg, black fg
  delete_file:  { bg: '\x1b[41m', fg: '\x1b[37m' },  // red bg, white fg
  list_files:   { bg: '\x1b[46m', fg: '\x1b[30m' },  // cyan bg, black fg
}

export function toolBadge(name: string): string {
  const colors = TOOL_COLORS[name] ?? { bg: '\x1b[45m', fg: '\x1b[37m' } // default magenta
  const reset = '\x1b[0m'
  return `${colors.bg}${colors.fg} ${name} ${reset}`
}

// ─── JSON 语法高亮 ─────────────────────────────────────

export function highlightJson(json: string, maxLines = 30): string {
  const lines = json.split('\n')
  const truncated = lines.length > maxLines

  const highlighted = lines.slice(0, maxLines).map(line => {
    return line
      // keys
      .replace(/"([^"]+)"(\s*:)/g, `${chalk.cyan('"$1"')}$2`)
      // string values
      .replace(/:\s*"([^"]*)"/g, `: ${chalk.green('"$1"')}`)
      // number values
      .replace(/:\s*(\d+\.?\d*)/g, `: ${chalk.yellow('$1')}`)
      // boolean values
      .replace(/:\s*(true|false)/g, `: ${chalk.magenta('$1')}`)
      // null
      .replace(/:\s*(null)/g, `: ${chalk.gray('$1')}`)
  }).join('\n')

  if (truncated) {
    const remaining = lines.length - maxLines
    return highlighted + chalk.gray(`\n  ... 还有 ${remaining} 行`)
  }
  return highlighted
}

// ─── Diff 格式化 ────────────────────────────────────────

export interface DiffEntry {
  path: string
  oldValue: unknown
  newValue: unknown
  type: 'added' | 'removed' | 'changed'
}

export function formatDiff(entries: DiffEntry[]): string {
  return entries.map(e => {
    const arrow = chalk.dim('→')
    switch (e.type) {
      case 'added':
        return `  ${chalk.green('+')} ${chalk.cyan(e.path)} ${arrow} ${chalk.green(JSON.stringify(e.newValue))}`
      case 'removed':
        return `  ${chalk.red('-')} ${chalk.cyan(e.path)} ${arrow} ${chalk.red.strikethrough(JSON.stringify(e.oldValue))}`
      case 'changed':
        return `  ${chalk.yellow('~')} ${chalk.cyan(e.path)} ${arrow} ${chalk.red(JSON.stringify(e.oldValue))} → ${chalk.green(JSON.stringify(e.newValue))}`
    }
  }).join('\n')
}

// ─── 预览框 ────────────────────────────────────────────

export function previewBox(title: string, content: string, maxWidth = 50): string {
  const contentLines = content.split('\n')
  // 截取前 15 行
  const displayLines = contentLines.slice(0, 15)
  const truncated = contentLines.length > 15

  const innerWidth = Math.min(maxWidth, Math.max(title.length + 4, ...displayLines.map(l => stripAnsi(l).length)) + 2)

  const top = chalk.dim('┌' + '─'.repeat(innerWidth) + '┐')
  const bottom = chalk.dim('└' + '─'.repeat(innerWidth) + '┘')
  const side = chalk.dim('│')

  const titleLine = side + chalk.bold(` ${title} `) + ' '.repeat(Math.max(0, innerWidth - stripAnsi(title).length - 2)) + side
  const separator = chalk.dim('├' + '─'.repeat(innerWidth) + '┤')

  const bodyLines = displayLines.map(line => {
    const plainLen = stripAnsi(line).length
    const padding = ' '.repeat(Math.max(0, innerWidth - plainLen - 2))
    return `${side} ${line}${padding} ${side}`
  })

  if (truncated) {
    const remaining = contentLines.length - 15
    bodyLines.push(`${side}${chalk.gray(`  ... 还有 ${remaining} 行`)}${' '.repeat(Math.max(0, innerWidth - 12))}${side}`)
  }

  return [top, titleLine, separator, ...bodyLines, bottom].join('\n')
}

// ─── 截断长内容 ─────────────────────────────────────────

export function truncate(str: string, maxLen = 200): string {
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen - 3) + chalk.dim('...')
}

// ─── 工具结果格式化 ─────────────────────────────────────

export function formatToolResult(tool: string, success: boolean, message: string): string {
  const icon = success ? chalk.green('✓') : chalk.red('✗')
  const badge = toolBadge(tool)
  const statusText = success ? chalk.green('成功') : chalk.red('失败')

  let output = `  ${icon} ${badge} ${statusText}`

  if (message) {
    // 如果消息是 JSON，高亮显示
    if (message.trim().startsWith('{') || message.trim().startsWith('[')) {
      try {
        const parsed = JSON.parse(message)
        const formatted = JSON.stringify(parsed, null, 2)
        output += '\n' + highlightJson(formatted, 20)
      } catch {
        output += '\n  ' + truncate(message, 300)
      }
    } else {
      output += '\n  ' + truncate(message, 300)
    }
  }

  return output
}

// ─── 工具输入预览 ───────────────────────────────────────

export function formatToolInput(tool: string, input: unknown): string {
  const badge = toolBadge(tool)
  const inputStr = truncate(JSON.stringify(input), 120)
  return `  ${badge} ${chalk.gray(inputStr)}`
}

// ─── 辅助 ──────────────────────────────────────────────

function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '')
}
