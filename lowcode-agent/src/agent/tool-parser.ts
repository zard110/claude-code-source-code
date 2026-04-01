/**
 * 工具标签解析器 — 从 LLM 输出文本中提取 <tool> 标签
 *
 * 独立模块，方便测试和复用
 */

/**
 * 从文本中提取 <tool name="xxx">JSON</tool> 调用
 */
export function extractToolCalls(text: string) {
  const calls: { name: string; input: unknown; start: number; end: number }[] = []
  const regex = /<tool\s+name=["']([^"']+)["']\s*>/g
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    const name = match[1]
    const contentStart = match.index + match[0].length
    const closeIdx = text.indexOf('</tool>', contentStart)
    if (closeIdx === -1) continue

    const jsonStr = text.substring(contentStart, closeIdx).trim()
    let input: unknown
    try {
      input = JSON.parse(jsonStr)
    } catch {
      input = { raw: jsonStr }
    }

    calls.push({
      name,
      input,
      start: match.index,
      end: closeIdx + '</tool>'.length,
    })
  }

  return calls
}

/**
 * 清理文本中的 <tool> 标签，返回干净的描述
 */
export function cleanToolTags(text: string, calls: ReturnType<typeof extractToolCalls>): string {
  let clean = text
  // 从后往前删除，避免 index 偏移
  for (let i = calls.length - 1; i >= 0; i--) {
    const c = calls[i]
    // 直接删除工具标签，不替换为任何文本
    // 之前用 [调用工具: xxx] 会导致模型模仿输出纯文本而非 <tool> 标签
    clean = clean.substring(0, c.start) + clean.substring(c.end)
  }
  return clean.trim()
}
