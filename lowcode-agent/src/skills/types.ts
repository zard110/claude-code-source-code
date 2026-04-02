import type { Tool } from '../tools/types.js'

/**
 * Skill Definition — inspired by Claude Code's Command/PromptCommand pattern
 *
 * Two modes:
 * 1. **Active skill** (has getPrompt): On-demand, invoked via <tool name="skill">
 *    The prompt is injected into the conversation when called
 * 2. **Passive skill** (has tools/systemPrompt): Always active,
 *    injects tools into registry and fragments into system prompt
 */
export interface SkillDefinition {
  /** Unique skill name (e.g., "simplify", "create-page") */
  name: string
  /** Short description for LLM skill listing */
  description: string
  /** When to use this skill (shown in system prompt) */
  whenToUse?: string
  /** Active skill: prompt template injected on invocation */
  getPrompt?: (args: string) => Promise<string>
  /** Passive skill: tools added to the tool registry */
  tools?: Tool[]
  /** Passive skill: system prompt fragment always injected */
  systemPrompt?: string
  /** Whether users can invoke via /skill-name (default true) */
  userInvocable?: boolean
  /** Where this skill was loaded from */
  source?: 'bundled' | 'file'
}

/** Backwards-compatible alias */
export type Skill = SkillDefinition
