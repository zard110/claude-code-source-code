import { describe, it, expect } from 'vitest'
import { askUserSchema } from '../src/agent/core.js'
import type { AskUserInput } from '../src/agent/core.js'

describe('askUserSchema', () => {
  it('接受有效输入', () => {
    const result = askUserSchema.safeParse({
      question: '使用什么布局？',
      options: ['表格', '卡片'],
    })
    expect(result.success).toBe(true)
  })

  it('allow_custom 默认为 false', () => {
    const result = askUserSchema.safeParse({
      question: '布局？',
      options: ['表格', '卡片'],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.allow_custom).toBe(false)
    }
  })

  it('allow_custom 可设为 true', () => {
    const result = askUserSchema.safeParse({
      question: '布局？',
      options: ['表格', '卡片'],
      allow_custom: true,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.allow_custom).toBe(true)
    }
  })

  it('拒绝少于 2 个选项', () => {
    const result = askUserSchema.safeParse({
      question: '布局？',
      options: ['只有一个'],
    })
    expect(result.success).toBe(false)
  })

  it('拒绝超过 4 个选项', () => {
    const result = askUserSchema.safeParse({
      question: '布局？',
      options: ['a', 'b', 'c', 'd', 'e'],
    })
    expect(result.success).toBe(false)
  })

  it('接受恰好 4 个选项', () => {
    const result = askUserSchema.safeParse({
      question: '布局？',
      options: ['表格', '卡片', '列表', '网格'],
    })
    expect(result.success).toBe(true)
  })

  it('拒绝缺少 question', () => {
    const result = askUserSchema.safeParse({
      options: ['a', 'b'],
    })
    expect(result.success).toBe(false)
  })

  it('拒绝缺少 options', () => {
    const result = askUserSchema.safeParse({
      question: '布局？',
    })
    expect(result.success).toBe(false)
  })
})

describe('AskUserInput type', () => {
  it('携带结构化问题数据', () => {
    const q: AskUserInput = {
      question: '使用什么布局？',
      options: ['表格', '卡片'],
      allow_custom: true,
    }
    expect(q.options).toHaveLength(2)
    expect(q.allow_custom).toBe(true)
  })
})
