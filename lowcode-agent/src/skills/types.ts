import type { Tool } from '../tools/types.js'

/**
 * Skill interface — an extension point for adding domain-specific
 * tools and knowledge to the agent.
 *
 * Inspired by Claude Code's Skill system:
 * - A skill can add new tools to the registry
 * - A skill can inject domain-specific instructions into the system prompt
 *
 * Example usage (future):
 *   PageSkill: adds tools for creating low-code pages + page JSON format docs
 *   ApiSkill: adds tools for creating API configs + API JSON format docs
 */
export interface Skill {
  /** Unique skill name */
  name: string
  /** Human-readable description */
  description: string
  /** Tools provided by this skill */
  tools?: Tool[]
  /** System prompt fragment injected into the LLM's system prompt */
  systemPrompt?: string
}
