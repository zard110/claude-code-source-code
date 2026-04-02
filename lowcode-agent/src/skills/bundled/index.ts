/**
 * Bundled Skills — 编译内置的技能注册
 *
 * Inspired by Claude Code's initBundledSkills():
 * - 每个技能在独立文件中定义
 * - 在此统一注册
 * - 新增技能只需：1) 创建文件 2) 在此添加一行
 */
import type { SkillRegistry } from '../registry.js'
import { registerSimplifySkill } from './simplify.js'
import { registerCreatePageSkill } from './create-page.js'

/**
 * Initialize all bundled skills into the registry.
 * Called at startup.
 */
export function initBundledSkills(registry: SkillRegistry): void {
  registerSimplifySkill(registry)
  registerCreatePageSkill(registry)
}
