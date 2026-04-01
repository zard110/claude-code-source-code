import { describe, it, expect } from 'vitest'
import { ToolRegistry, createDefaultRegistry } from '../src/tools/registry.js'

describe('ToolRegistry', () => {
  it('注册和获取工具', () => {
    const registry = new ToolRegistry()
    const mockTool = {
      name: 'test_tool',
      description: 'A test',
      inputSchema: {} as any,
      isReadOnly: true,
      handler: async () => ({ success: true, message: 'ok' }),
    }
    registry.register(mockTool)
    expect(registry.get('test_tool')).toBe(mockTool)
  })

  it('获取未注册的工具返回 undefined', () => {
    const registry = new ToolRegistry()
    expect(registry.get('nonexistent')).toBeUndefined()
  })

  it('getAll 返回所有工具', () => {
    const registry = new ToolRegistry()
    registry.register({ name: 'a', description: '', inputSchema: {} as any, isReadOnly: true, handler: async () => ({ success: true, message: '' }) })
    registry.register({ name: 'b', description: '', inputSchema: {} as any, isReadOnly: true, handler: async () => ({ success: true, message: '' }) })
    expect(registry.getAll()).toHaveLength(2)
  })

  it('toApiTools 转换格式', () => {
    const registry = new ToolRegistry()
    registry.register({
      name: 'my_tool',
      description: 'desc',
      inputSchema: {} as any,
      isReadOnly: true,
      handler: async () => ({ success: true, message: '' }),
    })
    const apiTools = registry.toApiTools()
    expect(apiTools).toHaveLength(1)
    // toApiTool returns name, description, input_schema
    expect((apiTools[0] as any).name).toBe('my_tool')
  })
})

describe('createDefaultRegistry', () => {
  it('注册了 8 个内置工具', () => {
    const registry = createDefaultRegistry()
    const tools = registry.getAll()
    expect(tools).toHaveLength(8)
    const names = tools.map(t => t.name).sort()
    expect(names).toEqual(['delete_file', 'delete_files', 'list_files', 'modify_json', 'move_file', 'read_json', 'write_files', 'write_json'])
  })

  it('所有工具都有 name 和 description', () => {
    const registry = createDefaultRegistry()
    for (const tool of registry.getAll()) {
      expect(tool.name).toBeTruthy()
      expect(tool.description).toBeTruthy()
    }
  })

  it('只读工具标记正确', () => {
    const registry = createDefaultRegistry()
    const readOnly = registry.getAll().filter(t => t.isReadOnly).map(t => t.name).sort()
    const writeOps = registry.getAll().filter(t => !t.isReadOnly).map(t => t.name).sort()
    expect(readOnly).toEqual(['list_files', 'read_json'])
    expect(writeOps).toEqual(['delete_file', 'delete_files', 'modify_json', 'move_file', 'write_files', 'write_json'])
  })
})
