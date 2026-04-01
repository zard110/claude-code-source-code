import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Conversation } from '../src/agent/core.js'
import type { Message } from '../src/agent/core.js'
import type { ProjectContext } from '../src/agent/context.js'

const mockProjectCtx: ProjectContext = {
  workDir: '/tmp/test',
  files: [],
  summary: '测试项目',
}

describe('Conversation', () => {
  let conversation: Conversation

  beforeEach(() => {
    conversation = new Conversation([], mockProjectCtx)
  })

  it('初始状态为空', () => {
    expect(conversation.length).toBe(0)
    expect(conversation.getMessages()).toEqual([])
  })

  it('addUser 添加用户消息', () => {
    conversation.addUser('你好')
    expect(conversation.length).toBe(1)
    const msgs = conversation.getMessages()
    expect(msgs[0]).toEqual({ role: 'user', content: '你好' })
  })

  it('addAssistant 添加助手消息', () => {
    conversation.addAssistant('回复')
    expect(conversation.length).toBe(1)
    expect(conversation.getMessages()[0]).toEqual({ role: 'assistant', content: '回复' })
  })

  it('addToolResult 添加工具结果', () => {
    conversation.addToolResult('文件内容')
    expect(conversation.length).toBe(1)
    expect(conversation.getMessages()[0]).toEqual({ role: 'tool', content: '文件内容' })
  })

  it('getRecentMessages 返回最近 N 条', () => {
    conversation.addUser('a')
    conversation.addAssistant('b')
    conversation.addUser('c')
    conversation.addAssistant('d')
    expect(conversation.getRecentMessages(2)).toEqual([
      { role: 'user', content: 'c' },
      { role: 'assistant', content: 'd' },
    ])
  })

  it('getMessages 返回副本（不可变）', () => {
    conversation.addUser('test')
    const msgs = conversation.getMessages()
    msgs.push({ role: 'user', content: 'hack' })
    expect(conversation.length).toBe(1) // 原始不受影响
  })

  it('支持初始消息', () => {
    const initial: Message[] = [
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'second' },
    ]
    const conv = new Conversation(initial, mockProjectCtx)
    expect(conv.length).toBe(2)
  })

  it('projectContext 可访问', () => {
    expect(conversation.projectContext).toBe(mockProjectCtx)
  })

  it('完整对话流程', () => {
    conversation.addUser('列出文件')
    conversation.addAssistant('[调用工具: list_files]')
    conversation.addToolResult('找到 3 个文件')
    conversation.addUser('读取第一个')
    conversation.addAssistant('这是文件内容')

    expect(conversation.length).toBe(5)
    const recent = conversation.getRecentMessages(3)
    expect(recent).toEqual([
      { role: 'tool', content: '找到 3 个文件' },
      { role: 'user', content: '读取第一个' },
      { role: 'assistant', content: '这是文件内容' },
    ])
  })

  it('getEstimatedTokens 返回估算 token 数', () => {
    conversation.addUser('你好')
    conversation.addAssistant('你好！')
    const tokens = conversation.getEstimatedTokens()
    expect(tokens).toBeGreaterThan(0)
  })

  it('needsCompact 少量消息时返回 false', () => {
    conversation.addUser('你好')
    expect(conversation.needsCompact()).toBe(false)
  })

  it('compact 压缩历史消息', async () => {
    // 添加 10 条消息
    for (let i = 0; i < 10; i++) {
      conversation.addUser(`消息 ${i}`)
      conversation.addAssistant(`回复 ${i}`)
    }
    expect(conversation.length).toBe(20)

    // Mock LLM client
    const mockClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: '用户要求创建多个页面' } }],
          }),
        },
      },
    }

    const compacted = await conversation.compact(mockClient as any, 'test-model', 4)
    expect(compacted).toBe(16)
    expect(conversation.length).toBe(4) // 保留最近 4 条
    expect(conversation.getSummary()).toContain('用户要求创建多个页面')
  })

  it('compact 消息少于保留数时不压缩', async () => {
    conversation.addUser('你好')
    const mockClient = {
      chat: { completions: { create: vi.fn() } },
    }
    const compacted = await conversation.compact(mockClient as any, 'test-model', 10)
    expect(compacted).toBe(0)
    expect(mockClient.chat.completions.create).not.toHaveBeenCalled()
  })

  it('getSummary 初始为空', () => {
    expect(conversation.getSummary()).toBe('')
  })
})

describe('AgentEvent 类型', () => {
  it('thinking 事件', () => {
    const event = { type: 'thinking' as const, text: '推理内容' }
    expect(event.type).toBe('thinking')
    expect(event.text).toBe('推理内容')
  })

  it('assistant_text 事件', () => {
    const event = { type: 'assistant_text' as const, text: '回复' }
    expect(event.type).toBe('assistant_text')
  })

  it('tool_call 事件', () => {
    const event = { type: 'tool_call' as const, tool: 'read_json', input: { file_path: 'test.json' } }
    expect(event.tool).toBe('read_json')
    expect(event.input).toEqual({ file_path: 'test.json' })
  })

  it('tool_result 事件', () => {
    const event = { type: 'tool_result' as const, tool: 'read_json', success: true, message: '内容' }
    expect(event.success).toBe(true)
  })

  it('error 事件', () => {
    const event = { type: 'error' as const, error: '出错' }
    expect(event.error).toBe('出错')
  })
})
