import type { SkillDefinition } from './types.js'
import type { ToolRegistry } from '../tools/registry.js'

/**
 * Skill Registry — manages loaded skills.
 *
 * Supports two skill modes:
 * - **Active skills** (has getPrompt): Listed in system prompt, invoked on demand
 * - **Passive skills** (has tools/systemPrompt): Always active
 */
export class SkillRegistry {
  private skills: Map<string, SkillDefinition> = new Map()

  register(skill: SkillDefinition): void {
    this.skills.set(skill.name, skill)
  }

  get(name: string): SkillDefinition | undefined {
    return this.skills.get(name)
  }

  getAll(): SkillDefinition[] {
    return Array.from(this.skills.values())
  }

  /** Active skills: have getPrompt, listed in system prompt */
  getActiveSkills(): SkillDefinition[] {
    return this.getAll().filter(s => s.getPrompt)
  }

  /** Passive skills: have tools or systemPrompt, always active */
  getPassiveSkills(): SkillDefinition[] {
    return this.getAll().filter(s => s.tools || s.systemPrompt)
  }

  /** Apply all passive skill tools to the tool registry */
  applyTools(toolRegistry: ToolRegistry): void {
    for (const skill of this.skills.values()) {
      if (skill.tools) {
        for (const tool of skill.tools) {
          toolRegistry.register(tool)
        }
      }
    }
  }
}
