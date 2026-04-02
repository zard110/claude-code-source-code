import { z } from 'zod'
import { buildTool, type ToolContext, type ToolResult } from './types.js'
import { readFile, writeFile } from 'node:fs/promises'
import { safeResolve } from '../utils/path-guard.js'
import { getByPath, setByPath, deleteByPath } from '../utils/json-path.js'
import { jsonDiff } from '../utils/diff.js'

export const modifyJsonTool = buildTool({
  name: 'modify_json',
  description:
    '精确修改 JSON 文件的指定节点。使用 JSON Path 定位要修改的位置（如 "components[0].props.title"）。' +
    '支持三种操作：set（设值/新增）、delete（删除节点）。修改前会验证旧值是否匹配。',
  inputSchema: z.object({
    file_path: z.string().describe('JSON 文件的相对路径'),
    operation: z
      .enum(['set', 'delete'])
      .describe("操作类型：'set' 设置值（新增或修改），'delete' 删除节点"),
    path: z
      .string()
      .describe(
        'JSON Path 路径，如 "title"、"components[0].props.name"、"api.response.schema"'
      ),
    old_value: z
      .any()
      .optional()
      .describe('预期旧值（用于验证）。如果不提供则跳过验证。'),
    new_value: z.any().describe('新值（set 操作必填，delete 操作忽略）'),
  }),
  isReadOnly: false,
  handler: async (
    input: {
      file_path: string
      operation: 'set' | 'delete'
      path: string
      old_value?: unknown
      new_value?: unknown
    },
    ctx: ToolContext
  ): Promise<ToolResult<{ path: string; operation: string }>> => {
    try {
      const absPath = safeResolve(ctx.workDir, input.file_path)

      // Read current file
      const content = await readFile(absPath, 'utf-8')
      const json = JSON.parse(content)
      const oldValue = getByPath(json, input.path)

      // Validate old value if provided
      if (input.old_value !== undefined) {
        if (JSON.stringify(oldValue) !== JSON.stringify(input.old_value)) {
          return {
            success: false,
            error: 'OLD_VALUE_MISMATCH',
            message: `验证失败：路径 "${input.path}" 的当前值是 ${JSON.stringify(oldValue)}，与预期的 ${JSON.stringify(input.old_value)} 不匹配`,
          }
        }
      }

      // Apply operation
      let newValue: unknown
      switch (input.operation) {
        case 'set':
          setByPath(json, input.path, input.new_value)
          newValue = input.new_value
          break
        case 'delete':
          deleteByPath(json, input.path)
          newValue = '(已删除)'
          break
      }

      // Write back
      await writeFile(absPath, JSON.stringify(json, null, 2), 'utf-8')
      ctx.fileCache.set(absPath, json)

      // Generate diff
      const diffStr = jsonDiff(oldValue, newValue, input.path)

      return {
        success: true,
        data: { path: input.file_path, operation: input.operation },
        message: `已修改 "${input.file_path}" 的 "${input.path}"\n变更：\n${diffStr}`,
      }
    } catch (err: unknown) {
      return {
        success: false,
        error: String(err),
        message: `修改文件 "${input.file_path}" 失败: ${err}`,
      }
    }
  },
})
