/**
 * LLM 通信日志 — 记录每次大模型请求和响应
 *
 * 每次启动自动清空，按时间戳记录：
 * - 请求 messages（完整发送给 LLM 的内容）
 * - 响应 fullText（LLM 完整输出）
 * - 工具调用和结果
 * - Token 用量
 */
import { appendFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'

const LOG_FILE = join(process.cwd(), 'logs', 'llm-debug.log')

/** 启动时清空日志文件 */
export async function initLogger(): Promise<void> {
  await mkdir(dirname(LOG_FILE), { recursive: true })
  await writeFile(LOG_FILE, '', 'utf-8')
}

/** 获取日志文件路径（方便用户查看） */
export function getLogFilePath(): string {
  return LOG_FILE
}

function timestamp(): string {
  return new Date().toISOString()
}

/** 记录发送给 LLM 的完整 messages */
export function logRequest(messages: Array<{ role: string; content: string }>): void {
  const entry = [
    '',
    '═══════════════════════════════════════════════════════════════',
    `📤 REQUEST  ${timestamp()}`,
    `消息数: ${messages.length}`,
    '───────────────────────────────────────────────────────────────',
  ]

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]
    const content = typeof msg.content === 'string'
      ? msg.content
      : JSON.stringify(msg.content, null, 2)
    entry.push(`[${i}] ${msg.role}:`)
    entry.push(content)
    entry.push('')
  }

  appendFile(LOG_FILE, entry.join('\n') + '\n').catch(() => {})
}

/** 记录 LLM 的完整响应文本 */
export function logResponse(fullText: string, usage?: { inputTokens: number; outputTokens: number }): void {
  const entry = [
    '',
    `📥 RESPONSE  ${timestamp()}`,
    `文本长度: ${fullText.length} 字符`,
  ]

  if (usage) {
    entry.push(`Token: ⬆️${usage.inputTokens} ⬇️${usage.outputTokens}`)
  }

  entry.push('───────────────────────────────────────────────────────────────')
  entry.push(fullText)
  entry.push('═══════════════════════════════════════════════════════════════')

  appendFile(LOG_FILE, entry.join('\n') + '\n').catch(() => {})
}

/** 记录工具调用 */
export function logToolCall(tool: string, input: unknown): void {
  const entry = [
    '',
    `🔧 TOOL_CALL  ${timestamp()}`,
    `工具: ${tool}`,
    `输入: ${JSON.stringify(input, null, 2)}`,
  ].join('\n')

  appendFile(LOG_FILE, entry + '\n').catch(() => {})
}

/** 记录工具结果 */
export function logToolResult(tool: string, success: boolean, message: string): void {
  const entry = [
    `🔧 TOOL_RESULT  ${timestamp()}`,
    `工具: ${tool}  ${success ? '✅' : '❌'}`,
    `结果: ${message}`,
  ].join('\n')

  appendFile(LOG_FILE, entry + '\n').catch(() => {})
}

/** 记录用户输入 */
export function logUserInput(input: string): void {
  const entry = [
    '',
    '═══════════════════════════════════════════════════════════════',
    `👤 USER  ${timestamp()}`,
    '───────────────────────────────────────────────────────────────',
    input,
  ].join('\n')

  appendFile(LOG_FILE, entry + '\n').catch(() => {})
}

/** 记录错误 */
export function logError(error: string): void {
  const entry = [
    `❌ ERROR  ${timestamp()}`,
    error,
  ].join('\n')

  appendFile(LOG_FILE, entry + '\n').catch(() => {})
}
