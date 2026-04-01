import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { mkdtemp, rm, writeFile, readFile, mkdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { ToolContext } from '../src/tools/types.js'
import { createDefaultRegistry } from '../src/tools/registry.js'

// ─── 测试 fixtures ─────────────────────────────────────

const PAGE_JSON = {
  id: 'user-list',
  title: '用户列表',
  type: 'list',
  path: '/users',
  components: [
    {
      type: 'SearchBar',
      props: {
        fields: [
          { key: 'name', label: '姓名', type: 'text' },
        ],
      },
    },
    {
      type: 'Table',
      props: {
        dataSource: '/api/users',
        columns: [
          { key: 'id', label: 'ID', width: 80 },
          { key: 'name', label: '姓名' },
        ],
        actions: ['view', 'edit', 'delete'],
      },
    },
  ],
}

const API_JSON = {
  id: 'users-api',
  name: '用户接口',
  endpoints: [
    { path: '/api/users', method: 'GET', description: '获取用户列表' },
  ],
}

// ─── Helper ────────────────────────────────────────────

let tempDir: string
let toolCtx: ToolContext

function setupCtx(): ToolContext {
  return { workDir: tempDir, fileCache: new Map() }
}

// ─── Tests ─────────────────────────────────────────────

describe('list_files 工具', () => {
  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'lowcode-tools-'))
    await mkdir(join(tempDir, 'pages'), { recursive: true })
    await mkdir(join(tempDir, 'apis'), { recursive: true })
    await writeFile(join(tempDir, 'pages', 'list.json'), JSON.stringify(PAGE_JSON))
    await writeFile(join(tempDir, 'apis', 'users.json'), JSON.stringify(API_JSON))
    await writeFile(join(tempDir, 'ignore.txt'), 'not json')
  })

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  beforeEach(() => { toolCtx = setupCtx() })

  it('列出所有 JSON 文件', async () => {
    const registry = createDefaultRegistry()
    const tool = registry.get('list_files')!
    const result = await tool.handler({}, toolCtx)
    expect(result.success).toBe(true)
    expect(result.message).toContain('2 个文件')
    expect(result.message).toContain('list.json')
    expect(result.message).toContain('users.json')
  })

  it('按扩展名过滤', async () => {
    const registry = createDefaultRegistry()
    const tool = registry.get('list_files')!
    const result = await tool.handler({ extension: '.json' }, toolCtx)
    expect(result.success).toBe(true)
    expect(result.message).toContain('2 个文件')
  })

  it('按目录过滤', async () => {
    const registry = createDefaultRegistry()
    const tool = registry.get('list_files')!
    const result = await tool.handler({ directory: 'pages' }, toolCtx)
    expect(result.success).toBe(true)
    expect(result.message).toContain('list.json')
    expect(result.message).not.toContain('users.json')
  })

  it('空目录返回未找到', async () => {
    const emptyDir = await mkdtemp(join(tmpdir(), 'lowcode-empty-'))
    try {
      const ctx: ToolContext = { workDir: emptyDir, fileCache: new Map() }
      const registry = createDefaultRegistry()
      const tool = registry.get('list_files')!
      const result = await tool.handler({}, ctx)
      expect(result.success).toBe(true)
      expect(result.message).toContain('未找到')
    } finally {
      await rm(emptyDir, { recursive: true, force: true })
    }
  })
})

describe('read_json 工具', () => {
  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'lowcode-tools-'))
    await mkdir(join(tempDir, 'pages'), { recursive: true })
    await writeFile(join(tempDir, 'pages', 'detail.json'), JSON.stringify(PAGE_JSON, null, 2))
  })

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  beforeEach(() => { toolCtx = setupCtx() })

  it('读取存在的文件', async () => {
    const registry = createDefaultRegistry()
    const tool = registry.get('read_json')!
    const result = await tool.handler({ file_path: 'pages/detail.json' }, toolCtx)
    expect(result.success).toBe(true)
    expect(result.message).toContain('user-list')
    expect(result.message).toContain('detail.json')
  })

  it('缓存文件到 fileCache', async () => {
    const registry = createDefaultRegistry()
    const tool = registry.get('read_json')!
    await tool.handler({ file_path: 'pages/detail.json' }, toolCtx)
    const absPath = join(tempDir, 'pages', 'detail.json')
    expect(toolCtx.fileCache.has(absPath)).toBe(true)
  })

  it('读取不存在的文件返回失败', async () => {
    const registry = createDefaultRegistry()
    const tool = registry.get('read_json')!
    const result = await tool.handler({ file_path: 'nonexistent.json' }, toolCtx)
    expect(result.success).toBe(false)
    expect(result.message).toContain('失败')
  })

  it('使用绝对路径', async () => {
    const registry = createDefaultRegistry()
    const tool = registry.get('read_json')!
    const absPath = join(tempDir, 'pages', 'detail.json')
    const result = await tool.handler({ file_path: absPath }, toolCtx)
    expect(result.success).toBe(true)
  })
})

describe('write_json 工具', () => {
  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'lowcode-tools-'))
  })

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  beforeEach(() => { toolCtx = setupCtx() })

  it('创建新文件', async () => {
    const registry = createDefaultRegistry()
    const tool = registry.get('write_json')!
    const result = await tool.handler({
      file_path: 'pages/new-page.json',
      content: { id: 'new', title: '新页面' },
    }, toolCtx)
    expect(result.success).toBe(true)
    expect(result.message).toContain('已写入')

    // 验证文件确实被创建
    const content = await readFile(join(tempDir, 'pages', 'new-page.json'), 'utf-8')
    expect(JSON.parse(content)).toEqual({ id: 'new', title: '新页面' })
  })

  it('自动创建中间目录', async () => {
    const registry = createDefaultRegistry()
    const tool = registry.get('write_json')!
    const result = await tool.handler({
      file_path: 'deep/nested/dir/file.json',
      content: { test: true },
    }, toolCtx)
    expect(result.success).toBe(true)

    const content = await readFile(join(tempDir, 'deep', 'nested', 'dir', 'file.json'), 'utf-8')
    expect(JSON.parse(content)).toEqual({ test: true })
  })

  it('覆盖已有文件', async () => {
    await writeFile(join(tempDir, 'existing.json'), '{"old": true}')

    const registry = createDefaultRegistry()
    const tool = registry.get('write_json')!
    const result = await tool.handler({
      file_path: 'existing.json',
      content: { new: true },
    }, toolCtx)
    expect(result.success).toBe(true)

    const content = await readFile(join(tempDir, 'existing.json'), 'utf-8')
    expect(JSON.parse(content)).toEqual({ new: true })
  })

  it('JSON 格式化输出（缩进 2 空格）', async () => {
    const registry = createDefaultRegistry()
    const tool = registry.get('write_json')!
    await tool.handler({
      file_path: 'formatted.json',
      content: { a: 1, b: { c: 2 } },
    }, toolCtx)

    const content = await readFile(join(tempDir, 'formatted.json'), 'utf-8')
    expect(content).toBe('{\n  "a": 1,\n  "b": {\n    "c": 2\n  }\n}')
  })
})

describe('modify_json 工具', () => {
  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'lowcode-tools-'))
    await mkdir(join(tempDir, 'pages'), { recursive: true })
    await writeFile(join(tempDir, 'pages', 'list.json'), JSON.stringify(PAGE_JSON, null, 2))
  })

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  beforeEach(async () => {
    toolCtx = setupCtx()
    // 每次重置文件
    await writeFile(join(tempDir, 'pages', 'list.json'), JSON.stringify(PAGE_JSON, null, 2))
  })

  it('set 操作修改顶层字段', async () => {
    const registry = createDefaultRegistry()
    const tool = registry.get('modify_json')!
    const result = await tool.handler({
      file_path: 'pages/list.json',
      operation: 'set',
      path: 'title',
      new_value: '修改后的标题',
    }, toolCtx)
    expect(result.success).toBe(true)
    expect(result.message).toContain('已修改')

    const content = JSON.parse(await readFile(join(tempDir, 'pages', 'list.json'), 'utf-8'))
    expect(content.title).toBe('修改后的标题')
  })

  it('set 操作修改嵌套字段', async () => {
    const registry = createDefaultRegistry()
    const tool = registry.get('modify_json')!
    const result = await tool.handler({
      file_path: 'pages/list.json',
      operation: 'set',
      path: 'components[0].type',
      new_value: 'AdvancedSearch',
    }, toolCtx)
    expect(result.success).toBe(true)

    const content = JSON.parse(await readFile(join(tempDir, 'pages', 'list.json'), 'utf-8'))
    expect(content.components[0].type).toBe('AdvancedSearch')
  })

  it('set 操作新增字段', async () => {
    const registry = createDefaultRegistry()
    const tool = registry.get('modify_json')!
    const result = await tool.handler({
      file_path: 'pages/list.json',
      operation: 'set',
      path: 'description',
      new_value: '页面描述',
    }, toolCtx)
    expect(result.success).toBe(true)

    const content = JSON.parse(await readFile(join(tempDir, 'pages', 'list.json'), 'utf-8'))
    expect(content.description).toBe('页面描述')
  })

  it('delete 操作删除字段', async () => {
    const registry = createDefaultRegistry()
    const tool = registry.get('modify_json')!
    const result = await tool.handler({
      file_path: 'pages/list.json',
      operation: 'delete',
      path: 'path',
    }, toolCtx)
    expect(result.success).toBe(true)

    const content = JSON.parse(await readFile(join(tempDir, 'pages', 'list.json'), 'utf-8'))
    expect(content.path).toBeUndefined()
    expect(content.title).toBe('用户列表') // 其他字段保持
  })

  it('old_value 验证通过', async () => {
    const registry = createDefaultRegistry()
    const tool = registry.get('modify_json')!
    const result = await tool.handler({
      file_path: 'pages/list.json',
      operation: 'set',
      path: 'title',
      old_value: '用户列表',
      new_value: '新标题',
    }, toolCtx)
    expect(result.success).toBe(true)
  })

  it('old_value 验证失败', async () => {
    const registry = createDefaultRegistry()
    const tool = registry.get('modify_json')!
    const result = await tool.handler({
      file_path: 'pages/list.json',
      operation: 'set',
      path: 'title',
      old_value: '错误的旧值',
      new_value: '新标题',
    }, toolCtx)
    expect(result.success).toBe(false)
    expect(result.error).toBe('OLD_VALUE_MISMATCH')
    expect(result.message).toContain('不匹配')
  })

  it('修改不存在的文件返回失败', async () => {
    const registry = createDefaultRegistry()
    const tool = registry.get('modify_json')!
    const result = await tool.handler({
      file_path: 'nonexistent.json',
      operation: 'set',
      path: 'title',
      new_value: 'x',
    }, toolCtx)
    expect(result.success).toBe(false)
  })
})

describe('delete_file 工具', () => {
  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'lowcode-tools-'))
  })

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  beforeEach(() => { toolCtx = setupCtx() })

  it('删除存在的文件', async () => {
    await writeFile(join(tempDir, 'to-delete.json'), '{}')

    const registry = createDefaultRegistry()
    const tool = registry.get('delete_file')!
    const result = await tool.handler({ file_path: 'to-delete.json' }, toolCtx)
    expect(result.success).toBe(true)
    expect(result.message).toContain('已删除')

    // 确认文件不存在
    await expect(stat(join(tempDir, 'to-delete.json'))).rejects.toThrow()
  })

  it('从 cache 中删除', async () => {
    const absPath = join(tempDir, 'cached.json')
    await writeFile(absPath, '{}')
    toolCtx.fileCache.set(absPath, {})

    const registry = createDefaultRegistry()
    const tool = registry.get('delete_file')!
    await tool.handler({ file_path: 'cached.json' }, toolCtx)
    expect(toolCtx.fileCache.has(absPath)).toBe(false)
  })

  it('删除不存在的文件返回失败', async () => {
    const registry = createDefaultRegistry()
    const tool = registry.get('delete_file')!
    const result = await tool.handler({ file_path: 'no-such-file.json' }, toolCtx)
    expect(result.success).toBe(false)
    expect(result.message).toContain('失败')
  })
})

describe('工具 inputSchema 验证', () => {
  it('read_json 要求 file_path', () => {
    const registry = createDefaultRegistry()
    const tool = registry.get('read_json')!
    const result = tool.inputSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('write_json 要求 file_path 和 content', () => {
    const registry = createDefaultRegistry()
    const tool = registry.get('write_json')!
    const result = tool.inputSchema.safeParse({ file_path: 'test.json' })
    expect(result.success).toBe(false)
  })

  it('modify_json operation 枚举值验证', () => {
    const registry = createDefaultRegistry()
    const tool = registry.get('modify_json')!
    const result = tool.inputSchema.safeParse({
      file_path: 'test.json',
      operation: 'invalid',
      path: 'a',
      new_value: 'b',
    })
    expect(result.success).toBe(false)
  })

  it('modify_json 正确输入通过验证', () => {
    const registry = createDefaultRegistry()
    const tool = registry.get('modify_json')!
    const result = tool.inputSchema.safeParse({
      file_path: 'test.json',
      operation: 'set',
      path: 'title',
      new_value: '新标题',
    })
    expect(result.success).toBe(true)
  })
})
