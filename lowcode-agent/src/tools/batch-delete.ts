import { z } from 'zod'
import { buildTool, type ToolContext, type ToolResult } from './types.js'
import { unlink } from 'node:fs/promises'
import { safeResolve } from '../utils/path-guard.js'

export const batchDeleteTool = buildTool({
  name: 'delete_files',
  description:
    '批量删除多个 JSON 文件。当用户要求删除所有文件或多个文件时，使用此工具一次删除，而不是逐个调用 delete_file。',
  inputSchema: z.object({
    file_paths: z.array(z.string()).describe('要删除的文件相对路径数组'),
  }),
  isReadOnly: false,
  handler: async (
    input: { file_paths: string[] },
    ctx: ToolContext
  ): Promise<ToolResult<{ deleted: string[]; failed: string[] }>> => {
    const deleted: string[] = []
    const failed: string[] = []

    for (const filePath of input.file_paths) {
      const idx = deleted.length + failed.length + 1
      ctx.onProgress?.(`删除文件 ${idx}/${input.file_paths.length}: ${filePath}`)
      try {
        const absPath = safeResolve(ctx.workDir, filePath)

        await unlink(absPath)
        ctx.fileCache.delete(absPath)
        deleted.push(filePath)
      } catch (err: unknown) {
        failed.push(`${filePath}: ${err}`)
      }
    }

    if (failed.length === 0) {
      return {
        success: true,
        data: { deleted, failed: [] },
        message: `已批量删除 ${deleted.length} 个文件: ${deleted.join(', ')}`,
      }
    } else if (deleted.length > 0) {
      return {
        success: true,
        data: { deleted, failed },
        message: `已删除 ${deleted.length} 个文件 (${deleted.join(', ')})，${failed.length} 个失败: ${failed.join('; ')}`,
      }
    } else {
      return {
        success: false,
        error: failed.join('; '),
        message: `批量删除失败: ${failed.join('; ')}`,
      }
    }
  },
})
