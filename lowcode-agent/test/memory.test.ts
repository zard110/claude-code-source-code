import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { loadProjectMemory } from '../src/agent/memory.js'

describe('loadProjectMemory', () => {
  let tempDir: string

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'lowcode-memory-'))
  })

  afterAll(async () => {
    if (tempDir) await rm(tempDir, { recursive: true, force: true })
  })

  it('没有 AGENT.md 时返回 null', async () => {
    const memory = await loadProjectMemory(tempDir)
    expect(memory).toBeNull()
  })

  it('有 AGENT.md 时返回内容', async () => {
    await writeFile(
      join(tempDir, 'AGENT.md'),
      '# 项目约定\n\n- 文件名使用 kebab-case\n- 页面必须有 title 字段',
    )
    const memory = await loadProjectMemory(tempDir)
    expect(memory).toContain('项目约定')
    expect(memory).toContain('kebab-case')
  })

  it('空 AGENT.md 返回 null', async () => {
    const subDir = join(tempDir, 'empty-test')
    const { mkdir } = await import('node:fs/promises')
    await mkdir(subDir, { recursive: true })
    await writeFile(join(subDir, 'AGENT.md'), '   \n\n  ')
    const memory = await loadProjectMemory(subDir)
    expect(memory).toBeNull()
  })
})
