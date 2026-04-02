import { describe, it, expect, vi } from 'vitest'
import { compactMessages, localSummary, estimateCompactSavings, microCompact, MICRO_COMPACT_PLACEHOLDER } from '../src/agent/compact.js'
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

describe('microCompact', () => {
  it('清理旧工具结果，保留最近的', () => {
    const messages: Message[] = [
      { role: 'user', content: '请求1' },
      { role: 'assistant', content: '好的1' },
      { role: 'tool', content: '工具结果1（很长很长的JSON内容）' },
      { role: 'assistant', content: '继续' },
      { role: 'tool', content: '工具结果2（很长很长的JSON内容）' },
      { role: 'assistant', content: '继续' },
      { role: 'tool', content: '工具结果3（很长很长的JSON内容）' },
      { role: 'assistant', content: '继续' },
      { role: 'tool', content: '工具结果4（很长很长的JSON内容）' },
      { role: 'user', content: '请求2' },
    ]

    const result = microCompact(messages, 2)
    // 应该保留最后 2 条工具结果，清理前 2 条
    expect(result.clearedCount).toBe(2)
    expect(result.tokensSaved).toBeGreaterThan(0)

    // 第 1、2 条工具结果被替换为占位文本
    expect(result.messages[2].content).toBe(MICRO_COMPACT_PLACEHOLDER)
    expect(result.messages[4].content).toBe(MICRO_COMPACT_PLACEHOLDER)

    // 最后 2 条工具结果保持不变
    expect(result.messages[6].content).toBe('工具结果3（很长很长的JSON内容）')
    expect(result.messages[8].content).toBe('工具结果4（很长很长的JSON内容）')

    // user/assistant 消息不变
    expect(result.messages[0].content).toBe('请求1')
    expect(result.messages[1].content).toBe('好的1')
  })

  it('工具结果不足 keepRecent 时不清理', () => {
    const messages: Message[] = [
      { role: 'user', content: '请求' },
      { role: 'tool', content: '工具结果1' },
      { role: 'tool', content: '工具结果2' },
    ]

    const result = microCompact(messages, 5)
    expect(result.clearedCount).toBe(0)
    expect(result.tokensSaved).toBe(0)
    expect(result.messages[1].content).toBe('工具结果1')
    expect(result.messages[2].content).toBe('工具结果2')
  })

  it('没有工具结果时不清理', () => {
    const messages: Message[] = [
      { role: 'user', content: '你好' },
      { role: 'assistant', content: '你好！' },
      { role: 'user', content: '再见' },
    ]

    const result = microCompact(messages, 2)
    expect(result.clearedCount).toBe(0)
    expect(result.tokensSaved).toBe(0)
  })

  it('不修改原始数组', () => {
    const messages: Message[] = [
      { role: 'tool', content: '原始内容A' },
      { role: 'tool', content: '原始内容B' },
      { role: 'tool', content: '原始内容C' },
    ]

    const result = microCompact(messages, 1)
    expect(result.clearedCount).toBe(2)
    // 原始数组不变
    expect(messages[0].content).toBe('原始内容A')
    expect(messages[1].content).toBe('原始内容B')
  })

  it('tokensSaved 计算正确', () => {
    const longContent = 'A'.repeat(1000) // 1000 * 0.25 = 250 tokens
    const messages: Message[] = [
      { role: 'tool', content: longContent },
      { role: 'tool', content: longContent },
      { role: 'tool', content: '短内容' },
    ]

    const result = microCompact(messages, 1)
    expect(result.clearedCount).toBe(2)
    // 每条长内容约 250 tokens，占位符约 10 tokens
    // 省约 (250 - 10) * 2 = 480
    expect(result.tokensSaved).toBeGreaterThan(400)
  })
})
