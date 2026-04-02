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

// ─── 上下文窗口 ──────────────────────────────────────────

/** 按模型名查上下文窗口大小 */
const MODEL_WINDOWS: Record<string, number> = {
  'gpt-4o': 128_000,
  'gpt-4o-mini': 128_000,
  'gpt-4': 8_192,
  'qwq': 131_072,
  'qwen': 131_072,
  'glm-5': 128_000,
  'glm-4': 128_000,
  'kimi': 128_000,
  'MiniMax': 1_000_000,
}

const DEFAULT_WINDOW = 128_000

export function getContextWindow(model: string): number {
  // 模糊匹配：model 可能是 "qwq-32b" 或 "qwen/qwq-32b" 等
  for (const [key, window] of Object.entries(MODEL_WINDOWS)) {
    if (model.includes(key)) return window
  }
  return DEFAULT_WINDOW
}

/** 触发自动压缩的阈值（上下文使用比例） */
export const COMPACT_THRESHOLD = 0.8

/** 触发 micro-compact 的轻量阈值（上下文使用比例） */
export const MICRO_COMPACT_THRESHOLD = 0.6

/** 触发自动压缩的消息条数阈值（条数兜底，避免估算不准时遗漏） */
export const COMPACT_MESSAGE_COUNT = 100

/** 压缩时保留最近几轮对话（每轮 = user + assistant，所以 *2） */
export const KEEP_RECENT_TURNS = 4

/** 判断是否需要压缩 */
export function shouldCompact(messages: readonly Message[], model?: string): boolean {
  // 条件1：消息条数过多（估算可能不准，用条数兜底）
  if (messages.length > COMPACT_MESSAGE_COUNT) return true
  // 条件2：估算 token 超过窗口阈值
  const tokens = estimateMessagesTokens(messages)
  const window = model ? getContextWindow(model) : DEFAULT_WINDOW
  return tokens > window * COMPACT_THRESHOLD
}

/**
 * 根据 API 返回的真实 token 用量判断是否需要压缩
 * 当真实用量接近窗口上限时立即触发
 */
export function shouldCompactByUsage(inputTokens: number, model?: string): boolean {
  const window = model ? getContextWindow(model) : DEFAULT_WINDOW
  return inputTokens > window * COMPACT_THRESHOLD
}

/**
 * 根据 API 返回的真实 token 用量判断是否需要 micro-compact
 * 比 auto-compact 阈值更低（0.6 vs 0.8），更早触发
 */
export function shouldMicroCompactByUsage(inputTokens: number, model?: string): boolean {
  const window = model ? getContextWindow(model) : DEFAULT_WINDOW
  return inputTokens > window * MICRO_COMPACT_THRESHOLD
}
