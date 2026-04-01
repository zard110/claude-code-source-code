/**
 * Token 估算 — 灵感来自 Claude Code 的 tokenCountWithEstimation
 *
 * 中英混合场景的简单 token 估算：
 * - 中文字符 ≈ 2 token
 * - 英文字符 ≈ 0.25 token（4 字符 ≈ 1 token）
 *
 * 不需要精确，只需粗估以判断是否需要压缩上下文。
 */

import type { Message } from '../agent/core.js'

/** 估算一段文本的 token 数 */
export function estimateTokens(text: string): number {
  let count = 0
  for (const char of text) {
    // CJK 字符、全角符号等 > 127
    count += char.charCodeAt(0) > 127 ? 2 : 0.25
  }
  return Math.ceil(count)
}

/** 估算消息列表的总 token 数 */
export function estimateMessagesTokens(messages: readonly Message[]): number {
  return messages.reduce((sum, m) => sum + estimateTokens(m.content), 0)
}

// ─── 上下文窗口常量 ──────────────────────────────────────

/** qwq 模型的上下文窗口大小 */
export const CONTEXT_WINDOW = 32_768

/** 触发自动压缩的阈值（上下文使用比例） */
export const COMPACT_THRESHOLD = 0.8

/** 压缩时保留最近几轮对话（每轮 = user + assistant，所以 *2） */
export const KEEP_RECENT_TURNS = 4

/** 判断是否需要压缩 */
export function shouldCompact(messages: readonly Message[]): boolean {
  const tokens = estimateMessagesTokens(messages)
  return tokens > CONTEXT_WINDOW * COMPACT_THRESHOLD
}
