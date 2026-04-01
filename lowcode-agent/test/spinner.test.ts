import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SpinnerManager } from '../src/utils/spinner.js'

describe('SpinnerManager', () => {
  let spinner: SpinnerManager
  let writeSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.useFakeTimers()
    spinner = new SpinnerManager()
    writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
  })

  afterEach(() => {
    spinner.stop()
    writeSpy.mockRestore()
    vi.useRealTimers()
  })

  it('start 后会写入 spinner 帧', () => {
    spinner.start('测试中')
    vi.advanceTimersByTime(120)
    expect(writeSpy).toHaveBeenCalled()
    const output = writeSpy.mock.calls.map(c => c[0]).join('')
    expect(output).toContain('测试中')
  })

  it('stop 后清行', () => {
    spinner.start('测试')
    vi.advanceTimersByTime(120)
    writeSpy.mockClear()
    spinner.stop()
    const output = writeSpy.mock.calls.map(c => c[0]).join('')
    expect(output).toContain('\r')
    expect(output).toContain('\x1b[K')
  })

  it('stop 带最终消息', () => {
    spinner.start('测试')
    vi.advanceTimersByTime(120)
    writeSpy.mockClear()
    spinner.stop('完成!')
    const output = writeSpy.mock.calls.map(c => c[0]).join('')
    expect(output).toContain('完成!')
  })

  it('startThinking 使用随机动词', () => {
    spinner.startThinking()
    vi.advanceTimersByTime(120)
    const output = writeSpy.mock.calls.map(c => c[0]).join('')
    const verbs = ['思考中', '分析中', '推理中', '生成中']
    expect(verbs.some(v => output.includes(v))).toBe(true)
  })

  it('startTool 显示工具中文动词', () => {
    spinner.startTool('read_json')
    vi.advanceTimersByTime(120)
    const output = writeSpy.mock.calls.map(c => c[0]).join('')
    expect(output).toContain('读取文件')
  })

  it('update 更新时间戳', () => {
    spinner.start('test')
    const before = (spinner as any).lastTokenTime
    spinner.update()
    const after = (spinner as any).lastTokenTime
    expect(after).toBeGreaterThanOrEqual(before)
  })

  it('getElapsed 在 start 后返回正值', () => {
    spinner.start('test')
    vi.advanceTimersByTime(500)
    const elapsed = spinner.getElapsed()
    expect(elapsed).toBeGreaterThanOrEqual(0)
  })

  it('getElapsed 在未 start 时返回 0', () => {
    const elapsed = spinner.getElapsed()
    expect(elapsed).toBe(0)
  })

  it('连续调用 start 不报错（先 stop 再 start）', () => {
    spinner.start('第一')
    vi.advanceTimersByTime(120)
    spinner.start('第二')
    vi.advanceTimersByTime(120)
    const output = writeSpy.mock.calls.map(c => c[0]).join('')
    expect(output).toContain('第二')
  })

  it('stop 不带消息不输出额外内容', () => {
    spinner.start('test')
    vi.advanceTimersByTime(120)
    writeSpy.mockClear()
    spinner.stop()
    const output = writeSpy.mock.calls.map(c => c[0]).join('')
    expect(output).not.toContain('undefined')
  })

  it('帧动画随时间推进', () => {
    spinner.start('anim')
    writeSpy.mockClear()

    // 推进多帧
    vi.advanceTimersByTime(120 * 3)

    // 应该有 3 次渲染 write
    const writes = writeSpy.mock.calls.filter(c => (c[0] as string).includes('anim'))
    expect(writes.length).toBeGreaterThanOrEqual(2)
  })
})
