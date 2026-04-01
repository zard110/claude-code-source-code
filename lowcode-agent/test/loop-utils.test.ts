import { describe, it, expect } from 'vitest'
import { extractToolCalls, cleanToolTags } from '../src/agent/loop.js'

describe('extractToolCalls', () => {
  it('提取单个工具调用', () => {
    const text = '让我来读取文件。<tool name="read_json">{"file_path": "test.json"}</tool>'
    const calls = extractToolCalls(text)
    expect(calls).toHaveLength(1)
    expect(calls[0].name).toBe('read_json')
    expect(calls[0].input).toEqual({ file_path: 'test.json' })
  })

  it('提取多个工具调用', () => {
    const text =
      '<tool name="read_json">{"file_path": "a.json"}</tool> 然后修改 <tool name="modify_json">{"file_path":"b.json","operation":"set","path":"title","new_value":"新标题"}</tool>'
    const calls = extractToolCalls(text)
    expect(calls).toHaveLength(2)
    expect(calls[0].name).toBe('read_json')
    expect(calls[1].name).toBe('modify_json')
  })

  it('无工具调用返回空数组', () => {
    expect(extractToolCalls('普通文本')).toEqual([])
    expect(extractToolCalls('')).toEqual([])
  })

  it('未闭合标签被忽略', () => {
    const text = '<tool name="read_json">{"file_path": "test.json"}'
    expect(extractToolCalls(text)).toEqual([])
  })

  it('无效 JSON 降级为 raw', () => {
    const text = '<tool name="read_json">not valid json</tool>'
    const calls = extractToolCalls(text)
    expect(calls).toHaveLength(1)
    expect(calls[0].input).toEqual({ raw: 'not valid json' })
  })

  it('正确计算 start 和 end 位置', () => {
    const prefix = '一些文字 '
    const tag = '<tool name="read_json">{"a":1}</tool>'
    const text = prefix + tag + ' 后续'
    const calls = extractToolCalls(text)
    expect(calls).toHaveLength(1)
    expect(calls[0].start).toBe(prefix.length)
    expect(calls[0].end).toBe(prefix.length + tag.length)
  })

  it('支持单引号属性', () => {
    const text = "<tool name='read_json'>{}</tool>"
    const calls = extractToolCalls(text)
    expect(calls).toHaveLength(1)
    expect(calls[0].name).toBe('read_json')
  })
})

describe('cleanToolTags', () => {
  it('删除单个工具标签', () => {
    const text = '读取文件 <tool name="read_json">{"file_path":"a.json"}</tool> 完成'
    const calls = extractToolCalls(text)
    const clean = cleanToolTags(text, calls)
    expect(clean).not.toContain('<tool')
    expect(clean).not.toContain('[调用工具')
    expect(clean).toContain('读取文件')
    expect(clean).toContain('完成')
  })

  it('删除多个工具标签', () => {
    const text = '<tool name="list_files">{}</tool>然后<tool name="read_json">{"file_path":"x"}</tool>'
    const calls = extractToolCalls(text)
    const clean = cleanToolTags(text, calls)
    expect(clean).toContain('然后')
    expect(clean).not.toContain('<tool')
    expect(clean).not.toContain('[调用工具')
  })

  it('无工具调用时原文返回', () => {
    const text = '普通文本没有工具'
    const clean = cleanToolTags(text, [])
    expect(clean).toBe(text.trim())
  })
})
