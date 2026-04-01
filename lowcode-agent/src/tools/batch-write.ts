import { z } from 'zod'
import { buildTool, type ToolContext, type ToolResult } from './types.js'
import { writeFile, mkdir } from 'node:fs/promises'
import { join, isAbsolute, dirname } from 'node:path'

/**
 * Batch write tool — creates multiple JSON files in a single tool call.
 *
 * This is the key architectural fix for batch operations:
 * - 7 files → 1 tool call (not 7 iterations)
 * - 100 files → 1 tool call (not 100 iterations)
 * - No maxIterations limit issue
 *
 * Mirrors Claude Code's approach: use a batch tool instead of N sequential calls.
 */
export const batchWriteTool = buildTool({
  name: 'write_files',
  description:
    '批量创建多个 JSON 文件。当用户要求创建多个文件时（如计划批准后批量创建），使用此工具一次性创建所有文件，而不是逐个调用 write_json。',
  inputSchema: z.object({
    files: z
      .array(
        z.object({
          file_path: z.string().describe('文件相对路径'),
          content: z.record(z.unknown()).describe('JSON 内容对象'),
        })
      )
      .describe('要创建的文件数组'),
  }),
  isReadOnly: false,
  handler: async (
    input: { files: Array<{ file_path: string; content: Record<string, unknown> }> },
    ctx: ToolContext
  ): Promise<
    ToolResult<{ created: string[]; failed: Array<{ path: string; error: string }> }>
  > => {
    const created: string[] = []
    const failed: Array<{ path: string; error: string }> = []

    for (const file of input.files) {
      try {
        const absPath = isAbsolute(file.file_path)
          ? file.file_path
          : join(ctx.workDir, file.file_path)

        await mkdir(dirname(absPath), { recursive: true })

        const jsonStr = JSON.stringify(file.content, null, 2)
        await writeFile(absPath, jsonStr, 'utf-8')

        ctx.fileCache.set(absPath, file.content)
        created.push(file.file_path)
      } catch (err: unknown) {
        failed.push({ path: file.file_path, error: String(err) })
      }
    }

    const total = created.length + failed.length
    if (failed.length === 0) {
      return {
        success: true,
        data: { created, failed: [] },
        message: `已批量创建 ${created.length}/${total} 个文件:\n${created.map(p => `  ✅ ${p}`).join('\n')}`,
      }
    } else if (created.length > 0) {
      return {
        success: true,
        data: { created, failed },
        message: `已创建 ${created.length}/${total} 个文件，${created.join(', ')}), ${failed.length} 个失败`,
      }
    } else {
      return {
        success: false,
        error: failed.map(f => `${f.path}: ${f.error}`).join('; '),
        message: `批量创建失败: ${failed.map(f => `${f.path}: ${f.error}`).join('; ')}`,
      }
    }
  },
})
