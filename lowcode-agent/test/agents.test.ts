import { describe, it, expect, afterAll } from 'vitest'
import { AgentRegistry, loadFileAgents } from '../src/agents/registry.js'
import type { AgentDefinition } from '../src/agents/types.js'
import { initBundledAgents } from '../src/agents/bundled/index.js'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

describe('AgentRegistry', () => {
  it('should register and retrieve agents', () => {
    const registry = new AgentRegistry()
    const agent: AgentDefinition = {
      name: 'test-agent',
      description: 'A test agent',
      source: 'bundled',
      getSystemPrompt(prompt) { return `Test: ${prompt}` },
    }

    registry.register(agent)

    const retrieved = registry.get('test-agent')
    expect(retrieved).toBeDefined()
    expect(retrieved!.name).toBe('test-agent')
    expect(retrieved!.description).toBe('A test agent')
  })

  it('should return undefined for unknown agent', () => {
    const registry = new AgentRegistry()
    expect(registry.get('nonexistent')).toBeUndefined()
  })

  it('should list all agents', () => {
    const registry = new AgentRegistry()
    registry.register({
      name: 'agent-a',
      description: 'Agent A',
      source: 'bundled',
      getSystemPrompt(p) { return p },
    })
    registry.register({
      name: 'agent-b',
      description: 'Agent B',
      source: 'file',
      getSystemPrompt(p) { return p },
    })

    const all = registry.getAll()
    expect(all).toHaveLength(2)
    expect(all.map(a => a.name)).toContain('agent-a')
    expect(all.map(a => a.name)).toContain('agent-b')
  })

  it('should generate agent list text for system prompt', () => {
    const registry = new AgentRegistry()
    registry.register({
      name: 'page-writer',
      description: 'Writes page JSON',
      whenToUse: 'When creating pages',
      source: 'bundled',
      getSystemPrompt(p) { return p },
    })

    const text = registry.getAgentListText()
    expect(text).toContain('page-writer')
    expect(text).toContain('Writes page JSON')
    expect(text).toContain('When creating pages')
  })

  it('should return empty string for empty registry list text', () => {
    const registry = new AgentRegistry()
    expect(registry.getAgentListText()).toBe('')
  })
})

describe('Bundled Agents', () => {
  it('should register all bundled agents', () => {
    const registry = new AgentRegistry()
    initBundledAgents(registry)

    const all = registry.getAll()
    expect(all.length).toBeGreaterThanOrEqual(4)
    expect(registry.get('page-writer')).toBeDefined()
    expect(registry.get('api-writer')).toBeDefined()
    expect(registry.get('architect')).toBeDefined()
    expect(registry.get('requirements-analyzer')).toBeDefined()
  })

  it('should generate system prompts with task context', () => {
    const registry = new AgentRegistry()
    initBundledAgents(registry)

    const pageWriter = registry.get('page-writer')!
    const prompt = pageWriter.getSystemPrompt('Create a user list page')
    expect(prompt).toContain('user list page')
    expect(prompt).toContain('页面')
  })

  it('should have correct allowedTools for read-only agents', () => {
    const registry = new AgentRegistry()
    initBundledAgents(registry)

    const architect = registry.get('architect')!
    expect(architect.allowedTools).toBeDefined()
    expect(architect.allowedTools).not.toContain('write_json')
    expect(architect.allowedTools).toContain('list_files')
    expect(architect.allowedTools).toContain('read_json')
  })
})

describe('File-based Agent Loading', () => {
  const testDir = join(tmpdir(), `lowcode-agent-test-agents-${Date.now()}`)

  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  it('should load agents from .agents/ directory', async () => {
    // Create test agent file
    const agentDir = join(testDir, 'custom-writer')
    await mkdir(agentDir, { recursive: true })
    await writeFile(join(agentDir, 'AGENT.md'), `---
description: Custom writer agent
when_to_use: When you need custom writing
allowed_tools: list_files,read_json,write_json
max_iterations: 20
---

# Custom Writer

You are a custom writing agent.`)

    const registry = new AgentRegistry()
    const count = await loadFileAgents(testDir, registry)

    expect(count).toBe(1)
    const agent = registry.get('custom-writer')
    expect(agent).toBeDefined()
    expect(agent!.description).toBe('Custom writer agent')
    expect(agent!.whenToUse).toBe('When you need custom writing')
    expect(agent!.allowedTools).toEqual(['list_files', 'read_json', 'write_json'])
    expect(agent!.maxIterations).toBe(20)
    expect(agent!.source).toBe('file')

    const prompt = agent!.getSystemPrompt('Write something')
    expect(prompt).toContain('custom writing agent')
    expect(prompt).toContain('Write something')
  })

  it('should return 0 for non-existent directory', async () => {
    const registry = new AgentRegistry()
    const count = await loadFileAgents('/nonexistent/path', registry)
    expect(count).toBe(0)
    expect(registry.getAll()).toHaveLength(0)
  })

  it('should skip directories without AGENT.md', async () => {
    const emptyDir = join(testDir, 'no-agent-file')
    await mkdir(emptyDir, { recursive: true })

    const registry = new AgentRegistry()
    const count = await loadFileAgents(testDir, registry)
    // Should only count directories with AGENT.md
    expect(count).toBeGreaterThanOrEqual(1)
  })
})
