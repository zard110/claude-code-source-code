/**
 * Agent Definition — 子代理定义
 *
 * 灵感来自 Claude Code 的 AgentDefinition:
 * - 每个子代理有自己的 system prompt、工具子集、迭代预算
 * - 通过 <tool name="agent"> 调用，在独立对话中运行
 * - 结果作为 tool result 返回给父代理
 *
 * 与 Skill 的区别:
 * - Skill: 注入 prompt 到当前对话（同一上下文）
 * - Agent: 开启独立对话（隔离上下文），结果返回
 */

export interface AgentDefinition {
  /** 唯一代理名称 (e.g., "page-writer") */
  name: string
  /** 简短描述（显示在 system prompt 列表中） */
  description: string
  /** 详细使用场景说明 */
  whenToUse?: string
  /** 生成子代理的 system prompt */
  getSystemPrompt(prompt: string): string
  /** 可用工具白名单（不填=使用全部工具） */
  allowedTools?: string[]
  /** 最大迭代次数（默认 15） */
  maxIterations?: number
  /** 来源 */
  source?: 'bundled' | 'file'
}
