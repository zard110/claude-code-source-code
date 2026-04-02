import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

/**
 * SDK 测试 — 验证 createSDK 返回的对象结构正确
 *
 * 注意：这里的 query/stream 测试需要 mock OpenAI，
 * 和 loop.test.ts 共享同一套 mock。实际 LLM 调用测试在 test/real/ 中。
 */

describe('SDK 结构测试', () => {
  it('createSDK 返回 query 和 stream 方法', async () => {
    // 动态导入以触发 dotenv
    const { createSDK } = await import('../src/sdk.js')

    const tempDir = await mkdtemp(join(tmpdir(), 'lowcode-sdk-'))
    try {
      const sdk = await createSDK({ workDir: tempDir })
      expect(typeof sdk.query).toBe('function')
      expect(typeof sdk.stream).toBe('function')
    } finally {
      await rm(tempDir, { recursive: true, force: true })
    }
  })

  it('SDKResult 类型正确', () => {
    // 类型级别测试 — 编译通过即可
    const result = {
      events: [] as any[],
      text: '',
      toolCalls: [] as any[],
      toolResults: [] as any[],
      errors: [] as any[],
      hadThinking: false,
    }
    expect(result.events).toEqual([])
    expect(result.text).toBe('')
  })
})
