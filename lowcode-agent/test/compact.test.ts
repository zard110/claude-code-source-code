import { describe, it, expect, vi } from 'vitest'
import { compactMessages, localSummary, estimateCompactSavings } from '../src/agent/compact.js'
import type { Message } from '../src/agent/core.js'

describe('localSummary', () => {
  it('空消息列表返回默认摘要', () => {
    const summary = localSummary([])
    expect(summary).toContain('之前的对话')
  })

  it('提取工具操作摘要', () => {
    const messages: Message[] = [
      { role: 'user', content: '创建页面' },
      { role: 'assistant', content: '好的' },
      { role: 'tool', content: '成功写入文件 pages/test.json' },
    ]
    const summary = localSummary(messages)
    expect(summary).toContain('用户要求')
  })

  it('多个操作去重', () => {
    const messages: Message[] = [
      { role: 'user', content: '列表页面' },
      { role: 'user', content: '列表页面' },
    ]
    const summary = localSummary(messages)
    // 去重后应该只有一条
    expect(summary).toContain('列表页面')
  })
})

describe('compactMessages', () => {
  it('消息少于保留数时不压缩', async () => {
    const messages: Message[] = [
      { role: 'user', content: '你好' },
      { role: 'assistant', content: '你好！' },
    ]
    // keepCount = 10 > messages.length
    const result = await compactMessages({} as any, messages, 'test-model', 10)
    expect(result.compactedCount).toBe(0)
    expect(result.recentMessages).toHaveLength(2)
    expect(result.summary).toBe('')
  })

  it('消息多于保留数时压缩并保留最近的', async () => {
    const messages: Message[] = Array.from({ length: 10 }, (_, i) => ({
      role: 'user' as const,
      content: `消息 ${i}`,
    }))

    // Mock LLM client
    const mockClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: '这是压缩后的摘要' } }],
          }),
        },
      },
    }

    const result = await compactMessages(mockClient as any, messages, 'test-model', 4)
    expect(result.compactedCount).toBe(6)
    expect(result.recentMessages).toHaveLength(4)
    expect(result.summary).toContain('压缩后的摘要')
    // 保留的应该是最后 4 条
    expect(result.recentMessages[0].content).toBe('消息 6')
    expect(result.recentMessages[3].content).toBe('消息 9')
  })

  it('LLM 调用失败时用本地摘要兜底', async () => {
    const messages: Message[] = Array.from({ length: 10 }, (_, i) => ({
      role: 'user' as const,
      content: `消息 ${i}`,
    }))

    const mockClient = {
      chat: {
        completions: {
          create: vi.fn().mockRejectedValue(new Error('API error')),
        },
      },
    }

    const result = await compactMessages(mockClient as any, messages, 'test-model', 4)
    expect(result.compactedCount).toBe(6)
    expect(result.summary.length).toBeGreaterThan(0)
  })
})

describe('estimateCompactSavings', () => {
  it('估算节省的 token 数', () => {
    const messages: Message[] = Array.from({ length: 10 }, () => ({
      role: 'user' as const,
      content: '这是一段比较长的消息内容用于测试',
    }))
    const savings = estimateCompactSavings(messages, 4)
    // 应该大于 0
    expect(savings).toBeGreaterThan(0)
  })

  it('不压缩时节省为负（摘要开销）', () => {
    const messages: Message[] = [
      { role: 'user', content: '你好' },
    ]
    const savings = estimateCompactSavings(messages, 4)
    // keepCount > messages.length, savings should be negative (summary overhead)
    expect(savings).toBeLessThan(0)
  })
})
