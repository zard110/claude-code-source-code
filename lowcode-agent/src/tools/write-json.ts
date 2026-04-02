import { z } from 'zod'
import { buildTool, type ToolContext, type ToolResult } from './types.js'
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { safeResolve } from '../utils/path-guard.js'

export const writeJsonTool = buildTool({
  name: 'write_json',
  description:
    '创建一个新的 JSON 文件，或完全覆盖已有 JSON 文件。用于创建新的页面或接口配置文件。如果要修改已有文件的部分内容，请使用 modify_json。',
  inputSchema: z.object({
    file_path: z.string().describe('目标文件的相对路径，如 "pages/user-list.json"'),
    content: z.record(z.unknown()).describe('要写入的 JSON 内容（对象）'),
  }),
  isReadOnly: false,
  handler: async (
    input: { file_path: string; content: unknown },
    ctx: ToolContext
  ): Promise<ToolResult<{ path: string; size: number }>> => {
    try {
      const absPath = safeResolve(ctx.workDir, input.file_path)

      // Ensure directory exists
      await mkdir(dirname(absPath), { recursive: true })

      // Write formatted JSON
      const jsonStr = JSON.stringify(input.content, null, 2)
      await writeFile(absPath, jsonStr, 'utf-8')

      // Update cache
      ctx.fileCache.set(absPath, input.content)

      return {
        success: true,
        data: { path: input.file_path, size: jsonStr.length },
        message: `已写入文件 "${input.file_path}" (${jsonStr.length} 字节)`,
      }
    } catch (err: unknown) {
      return {
        success: false,
        error: String(err),
        message: `写入文件 "${input.file_path}" 失败: ${err}`,
      }
    }
  },
})
