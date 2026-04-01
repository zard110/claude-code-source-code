import type { Skill } from './types.js'
import type { ToolRegistry } from '../tools/registry.js'

/**
 * Skill Registry — manages loaded skills and applies them
 * to the tool registry and system prompt.
 */
export class SkillRegistry {
  private skills: Map<string, Skill> = new Map()

  register(skill: Skill): void {
    this.skills.set(skill.name, skill)
  }

  getAll(): Skill[] {
    return Array.from(this.skills.values())
  }

  /** Apply all skill tools to the tool registry */
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
