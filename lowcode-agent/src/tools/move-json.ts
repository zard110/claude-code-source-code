import { z } from 'zod'
import { buildTool, type ToolContext, type ToolResult } from './types.js'
import { rename, mkdir } from 'node:fs/promises'
import { join, isAbsolute, dirname } from 'node:path'

export const moveFileTool = buildTool({
  name: 'move_file',
  description:
    '移动或重命名文件。可以用于将文件移动到其他目录（如把接口从 pages 移动到 apis），或重命名文件。',
  inputSchema: z.object({
    source_path: z.string().describe('源文件相对路径，如 "pages/attendance-api.json"'),
    target_path: z.string().describe('目标文件相对路径，如 "apis/attendance-api.json"'),
  }),
  isReadOnly: false,
  handler: async (
    input: { source_path: string; target_path: string },
    ctx: ToolContext
  ): Promise<ToolResult<{ from: string; to: string }>> => {
    try {
      const absSource = isAbsolute(input.source_path)
        ? input.source_path
        : join(ctx.workDir, input.source_path)
      const absTarget = isAbsolute(input.target_path)
        ? input.target_path
        : join(ctx.workDir, input.target_path)

      // Ensure target directory exists
      await mkdir(dirname(absTarget), { recursive: true })

      // Update cache: move content from old key to new key
      const cached = ctx.fileCache.get(absSource)
      if (cached) {
        ctx.fileCache.delete(absSource)
        ctx.fileCache.set(absTarget, cached)
      }

      await rename(absSource, absTarget)

      return {
        success: true,
        data: { from: input.source_path, to: input.target_path },
        message: `已移动文件 "${input.source_path}" → "${input.target_path}"`,
      }
    } catch (err: unknown) {
      return {
        success: false,
        error: String(err),
        message: `移动文件 "${input.source_path}" → "${input.target_path}" 失败: ${err}`,
      }
    }
  },
})
