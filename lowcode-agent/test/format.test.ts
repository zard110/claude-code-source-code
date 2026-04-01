import { describe, it, expect } from 'vitest'
import {
  toolBadge,
  highlightJson,
  formatDiff,
  truncate,
  previewBox,
  formatToolResult,
  formatToolInput,
} from '../src/utils/format.js'
import type { DiffEntry } from '../src/utils/format.js'

// stripAnsi for assertions
function stripAnsi(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*m/g, '')
}

describe('toolBadge', () => {
  it('已知工具返回彩色 badge', () => {
    const result = stripAnsi(toolBadge('read_json'))
    expect(result).toContain('read_json')
  })

  it('未知工具返回默认颜色 badge', () => {
    const result = stripAnsi(toolBadge('custom_tool'))
    expect(result).toContain('custom_tool')
  })

  it('每个 badge 都包含工具名', () => {
    const tools = ['read_json', 'write_json', 'modify_json', 'delete_file', 'list_files']
    for (const t of tools) {
      expect(stripAnsi(toolBadge(t))).toContain(t)
    }
  })
})

describe('highlightJson', () => {
  it('高亮 JSON key', () => {
    const json = '{"name": "test"}'
    const result = highlightJson(json)
    const plain = stripAnsi(result)
    expect(plain).toContain('"name"')
    expect(plain).toContain('"test"')
  })

  it('截断超过 maxLines 的内容', () => {
    const lines = Array.from({ length: 50 }, (_, i) => `"key${i}": "val${i}"`)
    const json = '{\n' + lines.join(',\n') + '\n}'
    const result = highlightJson(json, 10)
    const plain = stripAnsi(result)
    expect(plain).toContain('还有')
  })

  it('不截断短内容', () => {
    const json = '{"a": 1}'
    const result = highlightJson(json, 30)
    const plain = stripAnsi(result)
    expect(plain).not.toContain('还有')
  })
})

describe('formatDiff', () => {
  it('格式化 added 条目', () => {
    const entries: DiffEntry[] = [
      { path: 'name', oldValue: undefined, newValue: 'test', type: 'added' },
    ]
    const plain = stripAnsi(formatDiff(entries))
    expect(plain).toContain('+')
    expect(plain).toContain('name')
  })

  it('格式化 removed 条目', () => {
    const entries: DiffEntry[] = [
      { path: 'age', oldValue: 20, newValue: undefined, type: 'removed' },
    ]
    const plain = stripAnsi(formatDiff(entries))
    expect(plain).toContain('-')
    expect(plain).toContain('age')
  })

  it('格式化 changed 条目', () => {
    const entries: DiffEntry[] = [
      { path: 'title', oldValue: 'old', newValue: 'new', type: 'changed' },
    ]
    const plain = stripAnsi(formatDiff(entries))
    expect(plain).toContain('~')
    expect(plain).toContain('title')
  })

  it('多条目多行输出', () => {
    const entries: DiffEntry[] = [
      { path: 'a', oldValue: 1, newValue: 2, type: 'changed' },
      { path: 'b', oldValue: undefined, newValue: 'x', type: 'added' },
    ]
    const plain = stripAnsi(formatDiff(entries))
    const lines = plain.split('\n')
    expect(lines.length).toBe(2)
  })
})

describe('truncate', () => {
  it('短内容不截断', () => {
    expect(truncate('hello')).toBe('hello')
  })

  it('长内容截断到 maxLen', () => {
    const long = 'a'.repeat(300)
    const result = truncate(long, 200)
    const plain = stripAnsi(result)
    expect(plain.length).toBeLessThanOrEqual(250) // + some for ellipsis
  })
})

describe('previewBox', () => {
  it('生成带边框的预览框', () => {
    const result = previewBox('test', 'hello world')
    const plain = stripAnsi(result)
    expect(plain).toContain('┌')
    expect(plain).toContain('└')
    expect(plain).toContain('test')
    expect(plain).toContain('hello world')
  })

  it('长内容自动截断', () => {
    const content = Array.from({ length: 30 }, (_, i) => `line ${i}`).join('\n')
    const result = previewBox('box', content)
    const plain = stripAnsi(result)
    expect(plain).toContain('还有')
  })
})

describe('formatToolResult', () => {
  it('成功结果包含 ✓', () => {
    const result = stripAnsi(formatToolResult('read_json', true, 'file content'))
    expect(result).toContain('✓')
    expect(result).toContain('成功')
    expect(result).toContain('file content')
  })

  it('失败结果包含 ✗', () => {
    const result = stripAnsi(formatToolResult('read_json', false, 'not found'))
    expect(result).toContain('✗')
    expect(result).toContain('失败')
    expect(result).toContain('not found')
  })

  it('JSON 消息自动高亮', () => {
    const msg = JSON.stringify({ key: 'value' })
    const result = stripAnsi(formatToolResult('read_json', true, msg))
    expect(result).toContain('key')
  })
})

describe('formatToolInput', () => {
  it('显示 badge 和参数', () => {
    const result = stripAnsi(formatToolInput('read_json', { file_path: 'test.json' }))
    expect(result).toContain('read_json')
    expect(result).toContain('test.json')
  })
})
