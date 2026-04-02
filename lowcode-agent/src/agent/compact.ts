/**
 * 上下文压缩 — 灵感来自 Claude Code 的 autoCompact 服务
 *
 * 核心思路：
 * 1. 当对话 token 数超过阈值时，触发压缩
 * 2. 保留最近 N 轮对话原文
 * 3. 将早期对话调用 LLM 生成摘要
 * 4. 摘要作为 system context 插入后续请求
 *
 * Claude Code 的 compact prompt 有 9 个结构化字段，
 * 我们简化为：用户意图 + 已完成操作 + 文件变更
 */

import type OpenAI from 'openai'
import type { Message } from './core.js'
import { estimateMessagesTokens, CONTEXT_WINDOW, KEEP_RECENT_TURNS } from '../utils/tokens.js'

/** 压缩后保留的消息 */
export interface CompactResult {
  /** 压缩摘要 */
  summary: string
  /** 保留的最近消息 */
  recentMessages: Message[]
  /** 被压缩掉的消息数 */
  compactedCount: number
}

/** 生成摘要的 prompt 模板 */
const COMPACT_PROMPT = `请总结以下对话历史的关键信息，用于后续对话的上下文。保留以下内容：

1. 用户的主要需求和意图
2. 已完成的操作（创建了什么文件、修改了什么配置）
3. 文件变更摘要（哪些文件被创建/修改/删除）
4. 用户提到的偏好或约束

忽略：工具调用的详细参数、中间推理过程、重复的确认对话

输出格式：简洁的中文摘要，不超过 300 字。

---

对话历史：

`

/** 调用 LLM 生成对话摘要 */
export async function generateSummary(
  llmClient: OpenAI,
  messages: Message[],
  model: string,
): Promise<string> {
  const conversationText = messages.map(m =>
    `[${m.role === 'user' ? '用户' : m.role === 'assistant' ? '助手' : '工具结果'}] ${m.content}`
  ).join('\n\n')

  const response = await llmClient.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: COMPACT_PROMPT },
      { role: 'user', content: conversationText },
    ],
    max_tokens: 500,
    stream: false,
  })

  return response.choices[0]?.message?.content?.trim() ?? '（摘要生成失败）'
}

/** 不调用 LLM 的快速本地摘要（fallback） */
export function localSummary(messages: Message[]): string {
  const files: string[] = []
  const actions: string[] = []

  for (const m of messages) {
    // 从工具结果中提取文件操作
    if (m.role === 'tool') {
      const fileMatch = m.content.match(/(?:文件|写入|修改|删除|创建)[：:]\s*"?([^"\n,，]+)/g)
      if (fileMatch) {
        files.push(...fileMatch)
      }
      if (m.content.includes('成功')) {
        actions.push(m.content.split('\n')[0])
      }
    }
    // 从用户消息提取意图
    if (m.role === 'user' && m.content.length < 50) {
      actions.push(`用户要求: ${m.content}`)
    }
  }

  const uniqueActions = [...new Set(actions)].slice(-10)
  if (uniqueActions.length === 0) {
    return '之前的对话已完成若干文件操作。'
  }
  return `之前的对话概要:\n${uniqueActions.join('\n')}`
}

/** 执行压缩：保留最近 N 条消息，早期消息生成摘要 */
export async function compactMessages(
  llmClient: OpenAI,
  messages: Message[],
  model: string,
  keepCount: number = KEEP_RECENT_TURNS * 2,
): Promise<CompactResult> {
  if (messages.length <= keepCount) {
    return {
      summary: '',
      recentMessages: [...messages],
      compactedCount: 0,
    }
  }

  const oldMessages = messages.slice(0, -keepCount)
  const recentMessages = messages.slice(-keepCount)

  let summary: string
  try {
    summary = await generateSummary(llmClient, oldMessages, model)
  } catch (err) {
    console.error('[compact] LLM 摘要生成失败，使用本地兜底:', err)
    summary = localSummary(oldMessages)
  }

  return {
    summary: `[之前的对话摘要]\n${summary}`,
    recentMessages,
    compactedCount: oldMessages.length,
  }
}

/** 粗估压缩后能省多少 token */
export function estimateCompactSavings(messages: Message[], keepCount: number): number {
  const beforeTokens = estimateMessagesTokens(messages)
  const recentTokens = estimateMessagesTokens(messages.slice(-keepCount))
  // 摘要大约 150 token
  return beforeTokens - recentTokens - 150
}
