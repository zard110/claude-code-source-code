import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // 真实 LLM 测试：10 分钟超时
    testTimeout: 300_000,
    // 只运行 real 目录
    include: ['test/real/**/*.test.ts'],
  },
})
