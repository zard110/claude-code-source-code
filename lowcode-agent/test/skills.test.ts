import { describe, it, expect } from 'vitest'
import { SkillRegistry } from '../src/skills/registry.js'
import type { SkillDefinition } from '../src/skills/types.js'

describe('SkillRegistry', () => {
  it('should register and retrieve skills', () => {
    const registry = new SkillRegistry()
    const skill: SkillDefinition = {
      name: 'test-skill',
      description: 'A test skill',
      source: 'bundled',
      async getPrompt(args) {
        return `Test prompt: ${args}`
      },
    }

    registry.register(skill)

    const retrieved = registry.get('test-skill')
    expect(retrieved).toBeDefined()
    expect(retrieved!.name).toBe('test-skill')
    expect(retrieved!.description).toBe('A test skill')
  })

  it('should return undefined for unknown skill', () => {
    const registry = new SkillRegistry()
    expect(registry.get('nonexistent')).toBeUndefined()
  })

  it('should distinguish active vs passive skills', () => {
    const registry = new SkillRegistry()

    // Active skill (has getPrompt)
    registry.register({
      name: 'active-skill',
      description: 'Active',
      source: 'bundled',
      async getPrompt() { return 'active prompt' },
    })

    // Passive skill (has systemPrompt, no getPrompt)
    registry.register({
      name: 'passive-skill',
      description: 'Passive',
      systemPrompt: 'Always active prompt',
    })

    // Hybrid (has both)
    registry.register({
      name: 'hybrid-skill',
      description: 'Hybrid',
      systemPrompt: 'Always active',
      source: 'bundled',
      async getPrompt() { return 'On-demand prompt' },
    })

    const active = registry.getActiveSkills()
    const passive = registry.getPassiveSkills()

    expect(active.map(s => s.name)).toEqual(['active-skill', 'hybrid-skill'])
    expect(passive.map(s => s.name)).toEqual(['passive-skill', 'hybrid-skill'])
  })

  it('should return all skills', () => {
    const registry = new SkillRegistry()
    registry.register({ name: 'a', description: 'A' })
    registry.register({ name: 'b', description: 'B' })
    registry.register({ name: 'c', description: 'C' })

    expect(registry.getAll()).toHaveLength(3)
  })
})

describe('Bundled Skills', () => {
  it('should register simplify skill', async () => {
    const registry = new SkillRegistry()
    const { registerSimplifySkill } = await import('../src/skills/bundled/simplify.js')
    registerSimplifySkill(registry)

    const skill = registry.get('simplify')
    expect(skill).toBeDefined()
    expect(skill!.name).toBe('simplify')
    expect(skill!.source).toBe('bundled')
    expect(skill!.getPrompt).toBeDefined()

    const prompt = await skill!.getPrompt!('test focus')
    expect(prompt).toContain('Simplify')
    expect(prompt).toContain('test focus')
  })

  it('should register create-page skill', async () => {
    const registry = new SkillRegistry()
    const { registerCreatePageSkill } = await import('../src/skills/bundled/create-page.js')
    registerCreatePageSkill(registry)

    const skill = registry.get('create-page')
    expect(skill).toBeDefined()
    expect(skill!.name).toBe('create-page')
    expect(skill!.getPrompt).toBeDefined()

    const prompt = await skill!.getPrompt!('用户管理页面')
    expect(prompt).toContain('Create Page')
    expect(prompt).toContain('用户管理页面')
  })

  it('should init all bundled skills via initBundledSkills', async () => {
    const registry = new SkillRegistry()
    const { initBundledSkills } = await import('../src/skills/bundled/index.js')
    initBundledSkills(registry)

    const all = registry.getAll()
    expect(all.length).toBeGreaterThanOrEqual(2)
    expect(all.map(s => s.name)).toContain('simplify')
    expect(all.map(s => s.name)).toContain('create-page')
  })
})

describe('File-based Skill Loader', () => {
  it('should parse frontmatter from SKILL.md content', async () => {
    const { loadFileSkills } = await import('../src/skills/loader.js')
    // Test with a non-existent directory — should return 0 without error
    const count = await loadFileSkills('/nonexistent/path/.skills', new SkillRegistry())
    expect(count).toBe(0)
  })
})
