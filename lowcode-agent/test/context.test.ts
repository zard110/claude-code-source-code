import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildProjectContext, createToolContext } from '../src/agent/context.js'
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

describe('createToolContext', () => {
  it('创建带 workDir 和 fileCache 的上下文', () => {
    const ctx = createToolContext('/tmp/test')
    expect(ctx.workDir).toBe('/tmp/test')
    expect(ctx.fileCache).toBeInstanceOf(Map)
    expect(ctx.fileCache.size).toBe(0)
  })
})

describe('buildProjectContext', () => {
  let tempDir: string

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'lowcode-test-'))
    // 创建测试文件结构
    await mkdir(join(tempDir, 'pages'), { recursive: true })
    await mkdir(join(tempDir, 'apis'), { recursive: true })
    await writeFile(join(tempDir, 'pages', 'home.json'), JSON.stringify({ id: 'home', title: '首页' }))
    await writeFile(join(tempDir, 'apis', 'users.json'), JSON.stringify({ id: 'users-api' }))
    // 非 JSON 文件应该被忽略
    await writeFile(join(tempDir, 'readme.txt'), 'not json')
  })

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  it('扫描出所有 JSON 文件', async () => {
    const ctx = await buildProjectContext(tempDir)
    expect(ctx.files).toHaveLength(2)
    const paths = ctx.files.map(f => f.path.replace(/\\/g, '/')).sort()
    expect(paths).toEqual(['apis/users.json', 'pages/home.json'])
  })

  it('文件信息包含 path, size, modified', async () => {
    const ctx = await buildProjectContext(tempDir)
    for (const f of ctx.files) {
      expect(f.path).toBeTruthy()
      expect(f.size).toBeGreaterThan(0)
      expect(f.modified).toBeTruthy()
    }
  })

  it('summary 包含文件数量', async () => {
    const ctx = await buildProjectContext(tempDir)
    expect(ctx.summary).toContain('2')
    expect(ctx.summary).toContain('JSON')
  })

  it('workDir 被正确设置', async () => {
    const ctx = await buildProjectContext(tempDir)
    expect(ctx.workDir).toBe(tempDir)
  })

  it('空目录返回空文件列表', async () => {
    const emptyDir = await mkdtemp(join(tmpdir(), 'lowcode-empty-'))
    try {
      const ctx = await buildProjectContext(emptyDir)
      expect(ctx.files).toHaveLength(0)
      expect(ctx.summary).toContain('暂无')
    } finally {
      await rm(emptyDir, { recursive: true, force: true })
    }
  })
})
