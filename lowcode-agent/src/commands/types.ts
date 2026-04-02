/**
 * Command Types — Slash 命令定义
 *
 * 仿 Claude Code 的命令系统：
 * - 每个命令是一个 CommandDefinition 对象
 * - 通过 CommandRegistry 统一注册和分发
 * - 支持内置命令 + 可扩展
 */
import type { TerminalUI } from '../ui/terminal.js'
import type { Message, LlmConfig } from '../agent/core.js'
import type { Conversation } from '../agent/core.js'
import type { SkillRegistry } from '../skills/registry.js'
import type { AgentRegistry } from '../agents/registry.js'

/** 命令上下文 — handler 接收的参数 */
export interface CommandContext {
  /** 命令参数（命令名之后的部分） */
  args: string
  /** 终端 UI */
  ui: TerminalUI
  /** 对话历史（可修改） */
  history: Message[]
  /** 当前 LLM 配置（可修改，如 /model 切换） */
  llmConfig: Partial<LlmConfig>
  /** 工作目录 */
  workDir: string
  /** 技能注册表 */
  skillRegistry: SkillRegistry
  /** 子代理注册表 */
  agentRegistry: AgentRegistry
  /** 当前会话（用于 /compact） */
  conversation: Conversation
  /** 所有已注册的命令（由 dispatch 自动注入） */
  commands: CommandDefinition[]
}

/** 命令定义 */
export interface CommandDefinition {
  /** 命令名（不含 /），如 "model"、"help" */
  name: string
  /** 一句话描述 */
  description: string
  /** 用法提示，如 "/model <name>" */
  usage?: string
  /** 分类（用于 /help 分组显示） */
  category: 'session' | 'model' | 'info'
  /** 命令处理函数 */
  handler: (ctx: CommandContext) => Promise<void>
}
