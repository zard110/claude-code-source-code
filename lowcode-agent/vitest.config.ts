import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // 默认排除真实 LLM 测试
    exclude: ['test/real/**', 'node_modules/**'],
  },
})
