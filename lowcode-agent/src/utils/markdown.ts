/**
 * Terminal Markdown Renderer — 轻量级终端 Markdown 渲染
 *
 * 将 LLM 输出的 markdown 渲染为带颜色的终端文本。
 * 不依赖外部库，只处理 LLM 常用的几种格式：
 * - 表格（| col | col |）
 * - 粗体（**text**）
 * - 标题（## text）
 * - 列表（- item / 1. item）
 * - 行内代码（`code`）
 * - 分隔线（---）
 */
import chalk from 'chalk'

/**
 * 渲染完整的 markdown 文本
 * 逐行处理，返回带 ANSI 颜色码的字符串
 */
export function renderMarkdown(text: string): string {
  const lines = text.split('\n')
  const result: string[] = []
  let inTable = false
  let tableRows: string[][] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!

    // ─── 表格处理 ────────────────────────────────
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      // 检查是否是分隔行（|---|---|）
      if (/^\|[\s\-:|]+\|$/.test(line.trim())) {
        // 跳过分隔行，不输出
        continue
      }

      // 解析表格行
      const cells = parseTableRow(line)
      // 如果还没开始表格，这是第一行（表头）
      if (!inTable) {
        inTable = true
        tableRows = []
      }
      tableRows.push(cells)
      continue
    }

    // 遇到非表格行，先把之前积累的表格输出
    if (inTable) {
      result.push(renderTable(tableRows))
      result.push('')
      inTable = false
      tableRows = []
    }

    // ─── 分隔线 ────────────────────────────────
    if (/^-{3,}$/.test(line.trim()) || /^_{3,}$/.test(line.trim())) {
      result.push(chalk.dim('  ─'.repeat(20)))
      continue
    }

    // ─── 标题 ────────────────────────────────
    const headingMatch = line.match(/^(#{1,4})\s+(.+)/)
    if (headingMatch) {
      const level = headingMatch[1]!.length
      const title = headingMatch[2]!
      const rendered = renderInline(title)
      if (level === 1) {
        result.push('')
        result.push(chalk.cyan.bold(`  ${rendered}`))
        result.push(chalk.dim('  ─'.repeat(20)))
      } else if (level === 2) {
        result.push('')
        result.push(chalk.cyan(`  ${rendered}`))
      } else {
        result.push(chalk.cyan.dim(`  ${rendered}`))
      }
      continue
    }

    // ─── 列表 ────────────────────────────────
    const unorderedMatch = line.match(/^(\s*)([-*•])\s+(.+)/)
    if (unorderedMatch) {
      const indent = unorderedMatch[1]!.length
      const content = renderInline(unorderedMatch[3]!)
      const padding = '  '.repeat(Math.floor(indent / 2))
      result.push(`${padding}  ${chalk.dim('•')} ${content}`)
      continue
    }

    const orderedMatch = line.match(/^(\s*)(\d+)[.)]\s+(.+)/)
    if (orderedMatch) {
      const indent = orderedMatch[1]!.length
      const num = orderedMatch[2]!
      const content = renderInline(orderedMatch[3]!)
      const padding = '  '.repeat(Math.floor(indent / 2))
      result.push(`${padding}  ${chalk.dim(num + '.')} ${content}`)
      continue
    }

    // ─── 空行 ────────────────────────────────
    if (line.trim() === '') {
      result.push('')
      continue
    }

    // ─── 普通文本 ────────────────────────────────
    result.push(`  ${renderInline(line)}`)
  }

  // 文件末尾如果有未输出的表格
  if (inTable) {
    result.push(renderTable(tableRows))
  }

  return result.join('\n')
}

/** 渲染行内格式：粗体、代码、链接 */
function renderInline(text: string): string {
  let result = text

  // 粗体 **text** 或 __text__
  result = result.replace(/\*\*(.+?)\*\*/g, (_, content) => chalk.bold.white(content))
  result = result.replace(/__(.+?)__/g, (_, content) => chalk.bold.white(content))

  // 斜体 *text* 或 _text_（注意不要匹配已经被粗体处理过的）
  result = result.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, (_, content) => chalk.italic(content))

  // 行内代码 `code`
  result = result.replace(/`([^`]+)`/g, (_, code) => chalk.bgBlackBright.white(` ${code} `))

  // 删除线 ~~text~~
  result = result.replace(/~~(.+?)~~/g, (_, content) => chalk.dim.strikethrough(content))

  // checkbox [x] 和 [ ]
  result = result.replace(/\[x\]/gi, chalk.green('✓'))
  result = result.replace(/\[ \]/g, chalk.dim('○'))

  // ❌ → 红色
  result = result.replace(/❌/g, chalk.red('✗'))
  // ✅ → 绿色
  result = result.replace(/✅/g, chalk.green('✓'))

  return result
}

/** 解析表格行为单元格数组 */
function parseTableRow(line: string): string[] {
  return line
    .trim()
    .slice(1, -1) // 去掉首尾 |
    .split('|')
    .map(cell => cell.trim())
}

/** 渲染表格 */
function renderTable(rows: string[][]): string {
  if (rows.length === 0) return ''

  // 计算每列最大宽度
  const colCount = Math.max(...rows.map(r => r.length))
  const colWidths: number[] = []
  for (let col = 0; col < colCount; col++) {
    let maxW = 0
    for (const row of rows) {
      const cell = row[col] ?? ''
      // 去掉 ANSI 转义码来计算宽度
      const plain = cell.replace(/\x1b\[[0-9;]*m/g, '')
      maxW = Math.max(maxW, plainLength(plain))
    }
    colWidths.push(maxW)
  }

  const lines: string[] = []

  // 表头
  if (rows.length > 0) {
    lines.push(renderTableRow(rows[0]!, colWidths, chalk.bold))
  }

  // 分隔线
  const sep = colWidths.map(w => chalk.dim('─'.repeat(w + 2))).join(chalk.dim('┼'))
  lines.push(`  ${chalk.dim('─').repeat(1)}${sep}${chalk.dim('─'.repeat(1))}`)

  // 数据行
  for (let i = 1; i < rows.length; i++) {
    lines.push(renderTableRow(rows[i]!, colWidths))
  }

  return lines.join('\n')
}

/** 渲染一行表格 */
function renderTableRow(
  cells: string[],
  colWidths: number[],
  style: (s: string) => string = (s) => s,
): string {
  const parts = cells.map((cell, i) => {
    const content = renderInline(cell ?? '')
    const plain = content.replace(/\x1b\[[0-9;]*m/g, '')
    const pad = colWidths[i]! - plainLength(plain)
    return style(` ${content}${' '.repeat(Math.max(0, pad))} `)
  })
  return `  ${chalk.dim('│')}${parts.join(chalk.dim('│'))}${chalk.dim('│')}`
}

/** 计算纯文本的显示宽度（考虑 CJK 字符） */
function plainLength(text: string): number {
  let len = 0
  for (const ch of text) {
    // CJK 字符占 2 列
    len += ch.charCodeAt(0) > 0x7f ? 2 : 1
  }
  return len
}
