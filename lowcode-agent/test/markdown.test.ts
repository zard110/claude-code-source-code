import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderMarkdown } from '../src/utils/markdown.js'

describe('renderMarkdown', () => {
  describe('段落和文本', () => {
    it('应该保留普通文本', () => {
      expect(renderMarkdown('hello world')).toContain('hello world')
    })

    it('应该保留空行', () => {
      const result = renderMarkdown('line1\n\nline2')
      const lines = result.split('\n')
      expect(lines[0]).toContain('line1')
      expect(lines[1]).toBe('')
    })
  })

  describe('标题', () => {
    it('应该渲染 ### 标题', () => {
      const result = renderMarkdown('### 这是标题')
      expect(result).not.toContain('###')
    })

    it('应该渲染 ## 标题', () => {
      const result = renderMarkdown('## 二级标题')
      expect(result).not.toContain('##')
    })

    it('应该渲染 # 标题', () => {
      const result = renderMarkdown('# 一级标题')
      expect(result).not.toContain('#')
    })
  })

  describe('粗体', () => {
    it('应该渲染粗体文本', () => {
      const input = '这是 **粗体** 文本'
      const result = renderMarkdown(input)
      // chalk.bold 备应用了，文本应该仍包含内容
      expect(result).toContain('粗体')
      expect(result).not.toContain('**')
    })
  })

  describe('行内代码', () => {
    it('应该渲染行内代码', () => {
      const result = renderMarkdown('这是 `code` 文本')
      expect(result).toContain('code')
      expect(result).not.toContain('`')
    })
  })

  describe('列表', () => {
    it('应该渲染无序列表', () => {
      const result = renderMarkdown('- 项目A\n- 项目B')
      expect(result).toContain('项目A')
      expect(result).toContain('项目B')
      expect(result).not.toContain('- ')
    })

    in('应该渲染有序列表', () => {
      const result = renderMarkdown('1. 第一\n2. 第二')
      expect(result).toContain('第一')
      expect(result).toContain('第二')
      // 有序列表的数字标号保留，但用 dim 样式
      expect(result).toMatch(/\b1\./)
    })
  })

  describe('表格', () => {
    it('应该渲染表格', () => {
      const input = '| 名称 | 状态 |\n|------|------|\n| 页面A | ✅ |\n| 页面B | ❌ |'
      const result = renderMarkdown(input)
      expect(result).toContain('页面A')
      expect(result).toContain('页面B')
      // ✅ → ✓, ✗ → ✗ (renderInline 转换)
      expect(result).toContain('✓')
      expect(result).toContain('✗')
      // 不应包含分隔行 |---|
      expect(result).not.toMatch(/^\|[-]+\|$/m)
    })

    it('应该处理空表格', () => {
      const result = renderMarkdown('')
      expect(result).toBe('')
    })

    it('应该处理中文对齐', () => {
      const input = '| 字段 | 类型 |\n|------|------|\n| 报销标题 | 文本 |\n| 部门 | 选择 |'
      const result = renderMarkdown(input)
      expect(result).toContain('报销标题')
      expect(result).toContain('部门')
    })
  })
})
