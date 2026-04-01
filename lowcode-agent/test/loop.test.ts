import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runAgentLoop } from '../src/agent/loop.js'
import type { Message } from '../src/agent/loop.js'
import { createDefaultRegistry } from '../src/tools/registry.js'
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { ToolContext } from '../src/tools/types.js'

/**
 * Mock OpenAI — 替换 createClient 返回的 client
 *
 * 策略：用 vi.mock 拦截 openai 模块，控制 chat.completions.create 的返回值
 */

// 存储每次 mock 返回的流数据
let mockStreams: Array<Array<Record<string, unknown>>> = []

// 下一次调用是否应该抛错
let nextError: Error | null = null

// 追踪发送的消息
let capturedMessages: Array<unknown> = []

function setMockStreams(streams: Array<Array<Record<string, unknown>>>) {
  mockStreams = streams
  capturedMessages = []
  nextError = null
}

function setMockError(error: Error) {
  nextError = error
  mockStreams = []
  capturedMessages = []
}

vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: vi.fn(async ({ messages }: { messages: Array<unknown> }) => {
            capturedMessages.push([...messages])

            if (nextError) {
              const err = nextError
              nextError = null
              throw err
            }

            const streamData = mockStreams.shift()
            if (!streamData) {
              // 默认：无工具调用的纯文本回复
              return createMockStream([{
                choices: [{ delta: { content: '好的，我明白了。' } }]
              }])
            }

            return createMockStream(streamData)
          }),
        },
      }
    },
  }
})

/** 创建模拟可迭代流 */
function createMockStream(chunks: Array<Record<string, unknown>>) {
  let index = 0
  return {
    [Symbol.asyncIterator]() {
      return {
        async next() {
          if (index < chunks.length) {
            return { value: chunks[index++], done: false }
          }
          return { value: undefined, done: true }
        },
      }
    },
  }
}

// ─── Tests ─────────────────────────────────────────────

describe('runAgentLoop (mock)', () => {
  let tempDir: string
  let toolCtx: ToolContext

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'lowcode-loop-'))
    await mkdir(join(tempDir, 'pages'), { recursive: true })
    await writeFile(join(tempDir, 'pages', 'test.json'), JSON.stringify({ id: 'test', title: '测试' }))
    toolCtx = { workDir: tempDir, fileCache: new Map() }
    vi.clearAllMocks()
  })

  async function cleanup() {
    await rm(tempDir, { recursive: true, force: true })
  }

  it('纯文本回复（无工具调用）', async () => {
    setMockStreams([
      // 迭代 1：直接回复，无工具
      [{
        choices: [{ delta: { content: '这是回复文本' } }]
      }],
    ])

    const registry = createDefaultRegistry()
    const history: Message[] = []
    const events = []

    for await (const event of runAgentLoop(
      '你好',
      history,
      { workDir: tempDir, files: [], summary: '测试' },
      registry,
      toolCtx,
    )) {
      events.push(event)
    }

    // 应该有 assistant_text 事件
    const textEvents = events.filter(e => e.type === 'assistant_text')
    expect(textEvents.length).toBeGreaterThan(0)
    expect((textEvents[0] as any).text).toBe('这是回复文本')

    // 不应该有 tool_call 事件
    expect(events.some(e => e.type === 'tool_call')).toBe(false)

    await cleanup()
  })

  it('thinking + 文本回复', async () => {
    setMockStreams([
      [
        { choices: [{ delta: { reasoning_content: '让我想想...' } }] },
        { choices: [{ delta: { content: '回答内容' } }] },
      ],
    ])

    const registry = createDefaultRegistry()
    const history: Message[] = []
    const events = []

    for await (const event of runAgentLoop(
      '问题',
      history,
      { workDir: tempDir, files: [], summary: '测试' },
      registry,
      toolCtx,
    )) {
      events.push(event)
    }

    const thinking = events.filter(e => e.type === 'thinking')
    const text = events.filter(e => e.type === 'assistant_text')
    expect(thinking.length).toBeGreaterThan(0)
    expect(text.length).toBeGreaterThan(0)

    await cleanup()
  })

  it('工具调用 → 执行 → 继续回复', async () => {
    setMockStreams([
      // 迭代 1：调用 list_files
      [{
        choices: [{ delta: { content: '让我列出文件。<tool name="list_files">{}</tool>' } }]
      }],
      // 迭代 2：基于工具结果回复
      [{
        choices: [{ delta: { content: '找到了一些文件。' } }]
      }],
    ])

    const registry = createDefaultRegistry()
    const history: Message[] = []
    const events = []

    for await (const event of runAgentLoop(
      '列出文件',
      history,
      { workDir: tempDir, files: [], summary: '测试' },
      registry,
      toolCtx,
    )) {
      events.push(event)
    }

    // 应该有 tool_call 和 tool_result
    const toolCalls = events.filter(e => e.type === 'tool_call')
    const toolResults = events.filter(e => e.type === 'tool_result')
    expect(toolCalls.length).toBe(1)
    expect(toolResults.length).toBe(1)
    expect((toolCalls[0] as any).tool).toBe('list_files')
    expect((toolResults[0] as any).success).toBe(true)

    // 历史应该包含所有轮次
    expect(history.length).toBeGreaterThan(1)

    await cleanup()
  })

  it('未知工具名返回错误', async () => {
    setMockStreams([
      [{
        choices: [{ delta: { content: '<tool name="unknown_tool">{}</tool>' } }]
      }],
      [{
        choices: [{ delta: { content: '抱歉，没有这个工具。' } }]
      }],
    ])

    const registry = createDefaultRegistry()
    const history: Message[] = []
    const events = []

    for await (const event of runAgentLoop(
      '测试',
      history,
      { workDir: tempDir, files: [], summary: '测试' },
      registry,
      toolCtx,
    )) {
      events.push(event)
    }

    const errors = events.filter(e => e.type === 'error')
    expect(errors.length).toBe(1)
    expect((errors[0] as any).error).toContain('未知工具')

    await cleanup()
  })

  it('写操作触发确认流程（用户确认）', async () => {
    setMockStreams([
      // 迭代 1：调用 write_json
      [{
        choices: [{ delta: { content: '<tool name="write_json">{"file_path":"pages/new.json","content":{"id":"new"}}</tool>' } }]
      }],
      // 迭代 2：确认后继续
      [{
        choices: [{ delta: { content: '文件已创建。' } }]
      }],
    ])

    const registry = createDefaultRegistry()
    const history: Message[] = []
    const events: Array<any> = []

    // confirmFn：自动确认
    const confirmFn = async () => true

    for await (const event of runAgentLoop(
      '创建新页面',
      history,
      { workDir: tempDir, files: [], summary: '测试' },
      registry,
      toolCtx,
      [],
      confirmFn,
    )) {
      events.push(event)
    }

    const toolResults = events.filter(e => e.type === 'tool_result')
    expect(toolResults.length).toBe(1)
    expect(toolResults[0].success).toBe(true)

    await cleanup()
  })

  it('写操作触发确认流程（用户拒绝）', async () => {
    setMockStreams([
      // 迭代 1：调用 write_json
      [{
        choices: [{ delta: { content: '<tool name="write_json">{"file_path":"pages/reject.json","content":{"id":"reject"}}</tool>' } }]
      }],
      // 迭代 2：拒绝后重新规划
      [{
        choices: [{ delta: { content: '好的，不执行了。' } }]
      }],
    ])

    const registry = createDefaultRegistry()
    const history: Message[] = []
    const events: Array<any> = []

    // confirmFn：自动拒绝
    const confirmFn = async () => false

    for await (const event of runAgentLoop(
      '创建页面',
      history,
      { workDir: tempDir, files: [], summary: '测试' },
      registry,
      toolCtx,
      [],
      confirmFn,
    )) {
      events.push(event)
    }

    // 应该有 tool_result 表示失败
    const toolResults = events.filter(e => e.type === 'tool_result')
    expect(toolResults.length).toBe(1)
    expect(toolResults[0].success).toBe(false)
    expect(toolResults[0].message).toContain('拒绝')

    // 文件不应该被创建
    try {
      const { stat } = await import('node:fs/promises')
      await stat(join(tempDir, 'pages', 'reject.json'))
      expect.unreachable('文件不应该存在')
    } catch {
      // 预期：文件不存在
    }

    await cleanup()
  })

  it('只读工具不需要确认', async () => {
    setMockStreams([
      [{
        choices: [{ delta: { content: '<tool name="read_json">{"file_path":"pages/test.json"}</tool>' } }]
      }],
      [{
        choices: [{ delta: { content: '已读取。' } }]
      }],
    ])

    const registry = createDefaultRegistry()
    const history: Message[] = []
    const events: Array<any> = []

    // confirmFn 不应该被调用
    const confirmFn = async () => {
      throw new Error('不应该被调用')
    }

    for await (const event of runAgentLoop(
      '读取文件',
      history,
      { workDir: tempDir, files: [], summary: '测试' },
      registry,
      toolCtx,
      [],
      confirmFn,
    )) {
      events.push(event)
    }

    // read_json 应该直接成功
    const toolResults = events.filter(e => e.type === 'tool_result')
    expect(toolResults.length).toBe(1)
    expect(toolResults[0].success).toBe(true)

    await cleanup()
  })

  it('多个工具调用在同一迭代中', async () => {
    setMockStreams([
      [{
        choices: [{ delta: { content: '<tool name="list_files">{}</tool><tool name="read_json">{"file_path":"pages/test.json"}</tool>' } }]
      }],
      [{
        choices: [{ delta: { content: '完成。' } }]
      }],
    ])

    const registry = createDefaultRegistry()
    const history: Message[] = []
    const events: Array<any> = []

    for await (const event of runAgentLoop(
      '查看所有信息',
      history,
      { workDir: tempDir, files: [], summary: '测试' },
      registry,
      toolCtx,
    )) {
      events.push(event)
    }

    const toolCalls = events.filter(e => e.type === 'tool_call')
    expect(toolCalls.length).toBe(2)
    expect(toolCalls[0].tool).toBe('list_files')
    expect(toolCalls[1].tool).toBe('read_json')

    await cleanup()
  })

  it('历史正确累积', async () => {
    setMockStreams([
      [{
        choices: [{ delta: { content: '回复' } }]
      }],
    ])

    const registry = createDefaultRegistry()
    const history: Message[] = []
    await collectEvents(runAgentLoop(
      '第一条消息',
      history,
      { workDir: tempDir, files: [], summary: '测试' },
      registry,
      toolCtx,
    ))

    // history 应该有 user + assistant
    expect(history.length).toBe(2)
    expect(history[0].role).toBe('user')
    expect(history[1].role).toBe('assistant')

    await cleanup()
  })

  it('API 异常时返回 error 事件', async () => {
    setMockError(new Error('网络错误'))

    const registry = createDefaultRegistry()
    const history: Message[] = []
    const events: Array<any> = []

    for await (const event of runAgentLoop(
      '触发错误',
      history,
      { workDir: tempDir, files: [], summary: '测试' },
      registry,
      toolCtx,
    )) {
      events.push(event)
    }

    const errors = events.filter(e => e.type === 'error')
    expect(errors.length).toBe(1)
    expect(errors[0].error).toContain('网络错误')

    await cleanup()
  })
})

// ─── Helper ────────────────────────────────────────────

async function collectEvents(gen: AsyncGenerator<any>): Promise<Array<any>> {
  const events: Array<any> = []
  for await (const event of gen) {
    events.push(event)
  }
  return events
}
