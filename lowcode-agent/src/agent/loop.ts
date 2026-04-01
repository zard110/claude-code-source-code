/**
 * Agent Loop — 向后兼容层
 *
 * 保留原有 runAgentLoop 函数签名，内部委托给新的 AgentLoop + Conversation。
 * 新代码应直接使用 core.ts 中的类。
 */
import type { ToolRegistry } from '../tools/registry.js'
import type { ToolContext } from '../tools/types.js'
import type { ProjectContext } from './context.js'
import type { Skill } from '../skills/types.js'
import {
  AgentLoop as CoreLoop,
  Conversation,
} from './core.js'
import type { Message, AgentEvent, ConfirmFn, AskUserFn } from './core.js'

// Re-export for backward compat
export { extractToolCalls, cleanToolTags } from './tool-parser.js'
export type { Message, AgentEvent, ConfirmFn, AskUserFn } from './core.js'

import OpenAI from 'openai'

export function createClient(): OpenAI {
  return new OpenAI({
    baseURL: process.env.CENTIT_BASE_URL,
    apiKey: process.env.CENTIT_API_KEY,
  })
}

export function getModel(): string {
  return process.env.CENTIT_PLANNER_MODEL || process.env.CENTIT_MODELS || 'gpt-4o'
}

/**
 * 向后兼容的 runAgentLoop — 推荐迁移到 core.ts 的 AgentLoop
 */
export async function* runAgentLoop(
  userInput: string,
  conversationHistory: Message[],
  projectCtx: ProjectContext,
  toolRegistry: ToolRegistry,
  toolCtx: ToolContext,
  skills: Skill[] = [],
  confirmFn?: ConfirmFn,
  askUserFn?: AskUserFn,
): AsyncGenerator<AgentEvent> {
  const conversation = new Conversation(conversationHistory, projectCtx)
  const loop = new CoreLoop({
    conversation,
    toolRegistry,
    toolCtx,
    skills,
    options: { confirmFn, askUserFn },
  })

  // 同步 conversationHistory（外部数组引用保持一致）
  for await (const event of loop.sendMessage(userInput)) {
    yield event
  }

  // 把 conversation 里的消息同步回外部数组
  conversationHistory.length = 0
  conversationHistory.push(...conversation.getMessages())
}
