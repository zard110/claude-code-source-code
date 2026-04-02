/**
 * Agent Registry — 子代理注册表
 *
 * 管理所有可用的子代理定义，支持：
 * - Bundled agents（TypeScript 编译内置）
 * - File-based agents（.agents/name/AGENT.md）
 */
import type { AgentDefinition } from './types.js'

export class AgentRegistry {
  private agents: Map<string, AgentDefinition> = new Map()

  register(agent: AgentDefinition): void {
    this.agents.set(agent.name, agent)
  }

  get(name: string): AgentDefinition | undefined {
    return this.agents.get(name)
  }

  getAll(): AgentDefinition[] {
    return Array.from(this.agents.values())
  }

  /** 获取可被模型调用的代理列表描述 */
  getAgentListText(): string {
    const agents = this.getAll()
    if (agents.length === 0) return ''

    return agents
      .map(a => {
        let entry = `- **${a.name}**: ${a.description}`
        if (a.whenToUse) entry += `\n  适用场景: ${a.whenToUse}`
        return entry
      })
      .join('\n')
  }
}

// ─── File-based Agent Loader ─────────────────────────────

interface AgentFrontmatter {
  description: string
  whenToUse?: string
  allowedTools?: string[]
  maxIterations?: number
}

/** Parse YAML-like frontmatter from agent markdown */
function parseAgentFrontmatter(content: string): { frontmatter: AgentFrontmatter; body: string } {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/)
  if (!match) {
    return { frontmatter: { description: '' }, body: content.trim() }
  }

  const fm = match[1]!
  const body = match[2]!.trim()

  let description = ''
  let whenToUse: string | undefined
  let allowedTools: string[] | undefined
  let maxIterations: number | undefined

  for (const line of fm.split('\n')) {
    const descMatch = line.match(/^description:\s*(.+)$/i)
    if (descMatch) { description = descMatch[1]!.trim(); continue }

    const whenMatch = line.match(/^when_to_use:\s*(.+)$/i)
    if (whenMatch) { whenToUse = whenMatch[1]!.trim(); continue }

    const toolsMatch = line.match(/^allowed_tools:\s*(.+)$/i)
    if (toolsMatch) {
      allowedTools = toolsMatch[1]!.split(',').map(t => t.trim()).filter(Boolean)
      continue
    }

    const iterMatch = line.match(/^max_iterations:\s*(\d+)$/i)
    if (iterMatch) { maxIterations = parseInt(iterMatch[1]!, 10) }
  }

  return {
    frontmatter: { description, whenToUse, allowedTools, maxIterations },
    body,
  }
}

/** Load agents from a .agents/ directory */
export async function loadFileAgents(
  agentsDir: string,
  registry: AgentRegistry,
): Promise<number> {
  const { readdir, readFile } = await import('node:fs/promises')
  const { join } = await import('node:path')

  let entries
  try {
    entries = await readdir(agentsDir, { withFileTypes: true })
  } catch {
    return 0
  }

  let loaded = 0
  for (const entry of entries) {
    if (!entry.isDirectory()) continue

    const agentDir = join(agentsDir, entry.name)
    const agentFile = join(agentDir, 'AGENT.md')

    let content: string
    try {
      content = await readFile(agentFile, 'utf-8')
    } catch {
      continue
    }

    const { frontmatter, body } = parseAgentFrontmatter(content)
    const agentName = entry.name

    // Use a closure to capture body for getSystemPrompt
    const capturedBody = body
    const agent: AgentDefinition = {
      name: agentName,
      description: frontmatter.description || `Agent: ${agentName}`,
      whenToUse: frontmatter.whenToUse,
      allowedTools: frontmatter.allowedTools,
      maxIterations: frontmatter.maxIterations,
      source: 'file',
      getSystemPrompt(prompt: string) {
        return `${capturedBody}\n\n## 任务\n\n${prompt}`
      },
    }

    registry.register(agent)
    loaded++
    console.error(`[Agents] Loaded file agent: ${agentName}`)
  }

  return loaded
}
