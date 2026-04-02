/**
 * File-based Skill Loader — scans .skills/ directory for SKILL.md files.
 *
 * Inspired by Claude Code's loadSkillsDir:
 * - Each skill is a directory: .skills/skill-name/SKILL.md
 * - Frontmatter: description, when_to_use
 * - Markdown body: prompt template (supports $ARGUMENTS placeholder)
 */
import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { SkillDefinition } from './types.js'
import { SkillRegistry } from './registry.js'

interface FrontmatterResult {
  description: string
  whenToUse?: string
  body: string
}

/** Parse YAML-like frontmatter from markdown content */
function parseFrontmatter(content: string): FrontmatterResult {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/)
  if (!match) {
    return { description: '', body: content.trim() }
  }

  const frontmatter = match[1]!
  const body = match[2]!.trim()

  let description = ''
  let whenToUse: string | undefined

  for (const line of frontmatter.split('\n')) {
    const descMatch = line.match(/^description:\s*(.+)$/i)
    if (descMatch) {
      description = descMatch[1]!.trim()
      continue
    }
    const whenMatch = line.match(/^when_to_use:\s*(.+)$/i)
    if (whenMatch) {
      whenToUse = whenMatch[1]!.trim()
    }
  }

  return { description, whenToUse, body }
}

/** Load skills from a .skills/ directory */
export async function loadFileSkills(
  skillsDir: string,
  registry: SkillRegistry,
): Promise<number> {
  let entries
  try {
    entries = await readdir(skillsDir, { withFileTypes: true })
  } catch {
    // Directory doesn't exist — not an error
    return 0
  }

  let loaded = 0
  for (const entry of entries) {
    if (!entry.isDirectory()) continue

    const skillDir = join(skillsDir, entry.name)
    const skillFile = join(skillDir, 'SKILL.md')

    let content: string
    try {
      content = await readFile(skillFile, 'utf-8')
    } catch {
      // SKILL.md doesn't exist in this directory, skip
      continue
    }

    const parsed = parseFrontmatter(content)
    const skillName = entry.name

    const skill: SkillDefinition = {
      name: skillName,
      description: parsed.description || `Skill: ${skillName}`,
      whenToUse: parsed.whenToUse,
      source: 'file',
      async getPrompt(args: string) {
        let prompt = parsed.body
        if (args) {
          prompt = prompt.replace(/\$ARGUMENTS/g, args)
        }
        return prompt
      },
    }

    registry.register(skill)
    loaded++
    console.error(`[Skills] Loaded file skill: ${skillName}`)
  }

  return loaded
}
