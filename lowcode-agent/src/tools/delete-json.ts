import { z } from 'zod'
import { buildTool, type ToolContext, type ToolResult } from './types.js'
import { unlink } from 'node:fs/promises'
import { join, isAbsolute } from 'node:path'

export const deleteFileTool = buildTool({
  name: 'delete_file',
  description:
    '删除一个 JSON 文件。此操作不可逆，请谨慎使用。用于删除不再需要的页面或接口配置文件。',
  inputSchema: z.object({
    file_path: z.string().describe('要删除的文件相对路径'),
  }),
  isReadOnly: false,
  handler: async (
    input: { file_path: string },
    ctx: ToolContext
  ): Promise<ToolResult<null>> => {
    try {
      const absPath = isAbsolute(input.file_path)
        ? input.file_path
        : join(ctx.workDir, input.file_path)

      await unlink(absPath)
      ctx.fileCache.delete(absPath)

      return {
        success: true,
        data: null,
        message: `已删除文件 "${input.file_path}"`,
      }
    } catch (err: unknown) {
      return {
        success: false,
        error: String(err),
        message: `删除文件 "${input.file_path}" 失败: ${err}`,
      }
    }
  },
})
