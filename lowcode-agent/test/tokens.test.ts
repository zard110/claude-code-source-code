import { describe, it, expect } from 'vitest'
import {
  estimateTokens,
  estimateMessagesTokens,
  shouldCompact,
  shouldCompactByUsage,
  getContextWindow,
  COMPACT_THRESHOLD,
} from '../src/utils/tokens.js'
import type { Message } from '../src/agent/core.js'

describe('estimateTokens', () => {
  it('纯英文估算', () => {
    // "hello" = 5 chars, 5 * 0.25 = 1.25 → ceil = 2
    const tokens = estimateTokens('hello')
    expect(tokens).toBe(2)
  })

  it('纯中文估算', () => {
    // "你好" = 2 chars, 2 * 2 = 4
    const tokens = estimateTokens('你好')
    expect(tokens).toBe(4)
  })

  it('中英混合估算', () => {
    // "hello你好" = 5 english chars (5*0.25=1.25) + 2 chinese chars (2*2=4) = 5.25 → ceil = 6
    const tokens = estimateTokens('hello你好')
    expect(tokens).toBe(6)
  })

  it('空字符串为 0', () => {
    expect(estimateTokens('')).toBe(0)
  })

  it('长文本估算合理', () => {
    const longText = 'a'.repeat(1000) // 250 tokens
    expect(estimateTokens(longText)).toBe(250)

    const longChinese = '中'.repeat(100) // 200 tokens
    expect(estimateTokens(longChinese)).toBe(200)
  })
})

describe('estimateMessagesTokens', () => {
  it('空消息列表为 0', () => {
    expect(estimateMessagesTokens([])).toBe(0)
  })

  it('计算多条消息的 token 总和', () => {
    const messages: Message[] = [
      { role: 'user', content: '你好' },       // 4 tokens
      { role: 'assistant', content: 'hello' },  // 2 tokens
    ]
    expect(estimateMessagesTokens(messages)).toBe(6)
  })

  it('计算含 tool 结果的消息', () => {
    const messages: Message[] = [
      { role: 'user', content: '请读取文件' },   // 8 tokens
      { role: 'tool', content: '文件内容如下' }, // 12 tokens
    ]
    const tokens = estimateMessagesTokens(messages)
    expect(tokens).toBeGreaterThan(0)
  })
})

describe('shouldCompact', () => {
  it('少量消息不需要压缩', () => {
    const messages: Message[] = [
      { role: 'user', content: '你好' },
      { role: 'assistant', content: '你好！' },
    ]
    expect(shouldCompact(messages)).toBe(false)
  })

  it('接近阈值时需要压缩', () => {
    // 构造一个超过阈值的对话
    const window = getContextWindow('qwq-32b')
    const longContent = '中'.repeat(Math.ceil(window * COMPACT_THRESHOLD))
    const messages: Message[] = [
      { role: 'user', content: longContent },
    ]
    expect(shouldCompact(messages, 'qwq-32b')).toBe(true)
  })

  it('消息条数超过阈值时需要压缩', () => {
    // 即使每条消息很短，超过 100 条也触发压缩
    const messages: Message[] = Array.from({ length: 101 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as Message['role'],
      content: 'hi',
    }))
    expect(shouldCompact(messages)).toBe(true)
  })

  it('消息条数未超阈值且 token 未超阈值时不压缩', () => {
    const messages: Message[] = Array.from({ length: 40 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as Message['role'],
      content: 'hi',
    }))
    expect(shouldCompact(messages)).toBe(false)
  })
})

describe('shouldCompactByUsage', () => {
  it('真实用量低于阈值不压缩', () => {
    expect(shouldCompactByUsage(10_000, 'qwq-32b')).toBe(false)
  })

  it('真实用量超过阈值触发压缩', () => {
    const window = getContextWindow('qwq-32b')
    expect(shouldCompactByUsage(Math.ceil(window * 0.85), 'qwq-32b')).toBe(true)
  })
})

describe('getContextWindow', () => {
  it('gpt-4o 返回 128k', () => {
    expect(getContextWindow('gpt-4o')).toBe(128_000)
  })

  it('模糊匹配 qwen/qwq-32b', () => {
    expect(getContextWindow('qwen/qwq-32b')).toBe(131_072)
  })

  it('未知模型返回默认值', () => {
    expect(getContextWindow('unknown-model')).toBe(128_000)
  })
})
