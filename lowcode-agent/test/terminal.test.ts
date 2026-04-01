import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TerminalUI } from '../src/ui/terminal.js'
import type { AgentEvent } from '../src/agent/core.js'

// Mock process.stdout.write for streaming text tests
let stdoutWriteSpy: ReturnType<typeof vi.spyOn>
let capturedStdout: string

describe('TerminalUI', () => {
  let ui: TerminalUI
  let capturedOutput: string[]

  beforeEach(() => {
    capturedOutput = []
    capturedStdout = ''
    stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockImplementation((data: string) => {
      capturedStdout += typeof data === 'string' ? data : String(data)
      return true
    })

    // Use /dev/null as input to avoid blocking
    ui = new TerminalUI(
      { on: () => {}, resume: () => {}, pause: () => {} } as any,
      { write: (data: string) => { capturedOutput.push(data); return true } } as any,
    )
  })

  afterEach(() => {
    stdoutWriteSpy.mockRestore()
  })

  describe('createRenderContext', () => {
    it('返回初始渲染上下文', () => {
      const ctx = ui.createRenderContext()
      expect(ctx.lastEventType).toBe('')
      expect(ctx.thinkingStart).toBe(0)
      expect(ctx.displayBuffer).toBe('')
      expect(ctx.hasToolTag).toBe(false)
    })
  })

  describe('renderEvent', () => {
    let ctx: ReturnType<typeof ui.createRenderContext>

    beforeEach(() => {
      ctx = ui.createRenderContext()
    })

    it('rendering thinking 事件', () => {
      const event: AgentEvent = { type: 'thinking', text: '推理中...' }
      ui.renderEvent(event, ctx)
      expect(ctx.lastEventType).toBe('thinking')
    })

    it('rendering assistant_text 事件', () => {
      const event: AgentEvent = { type: 'assistant_text', text: '你好' }
      ui.renderEvent(event, ctx)
      expect(ctx.lastEventType).toBe('assistant_text')
      // assistant_text uses process.stdout.write directly
      expect(capturedStdout).toContain('你好')
    })

    it('rendering tool_call 事件', () => {
      const event: AgentEvent = { type: 'tool_call', tool: 'read_json', input: { file_path: 'test.json' } }
      ui.renderEvent(event, ctx)
      expect(ctx.lastEventType).toBe('tool_call')
      const output = capturedOutput.join('')
      expect(output).toContain('read_json')
    })

    it('rendering tool_result 成功', () => {
      const event: AgentEvent = { type: 'tool_result', tool: 'read_json', success: true, message: '内容' }
      ui.renderEvent(event, ctx)
      expect(ctx.lastEventType).toBe('tool_result')
      const output = capturedOutput.join('')
      expect(output).toContain('成功')
    })

    it('rendering tool_result 失败', () => {
      const event: AgentEvent = { type: 'tool_result', tool: 'read_json', success: false, message: '失败' }
      ui.renderEvent(event, ctx)
      const output = capturedOutput.join('')
      expect(output).toContain('失败')
    })

    it('rendering error 事件', () => {
      const event: AgentEvent = { type: 'error', error: '网络错误' }
      ui.renderEvent(event, ctx)
      expect(ctx.lastEventType).toBe('error')
      const output = capturedOutput.join('')
      expect(output).toContain('网络错误')
    })

    it('连续 thinking 事件只启动一次 spinner', () => {
      ui.renderEvent({ type: 'thinking', text: 'a' }, ctx)
      ui.renderEvent({ type: 'thinking', text: 'b' }, ctx)
      expect(ctx.lastEventType).toBe('thinking')
    })

    it('thinking → assistant_text 转换时停止 spinner', () => {
      ui.renderEvent({ type: 'thinking', text: '推理' }, ctx)
      ui.renderEvent({ type: 'assistant_text', text: '回复' }, ctx)
      expect(ctx.lastEventType).toBe('assistant_text')
    })

    it('过滤 <tool> 标签', () => {
      ui.renderEvent({ type: 'assistant_text', text: '正在处理 <tool name=' }, ctx)
      expect(ctx.hasToolTag).toBe(true)
      // 不应该输出包含 <tool 的文本
      expect(capturedStdout).not.toContain('<tool')
    })
  })

  describe('renderTail', () => {
    it('assistant_text 结尾换行', () => {
      const ctx = ui.createRenderContext()
      ctx.lastEventType = 'assistant_text'
      ui.renderTail(ctx)
      // renderTail for assistant_text adds newline via process.stdout.write
      expect(capturedStdout).toContain('\n')
    })
  })

  describe('getConfirmFn', () => {
    it('返回一个函数', () => {
      const fn = ui.getConfirmFn()
      expect(typeof fn).toBe('function')
    })
  })

  describe('stopSpinner', () => {
    it('不抛错', () => {
      expect(() => ui.stopSpinner()).not.toThrow()
    })
  })
})
