import { z } from 'zod'
import { buildTool, type ToolContext, type ToolResult } from './types.js'
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { safeResolve } from '../utils/path-guard.js'

export const writeFileTool = buildTool({
  name: 'write_file',
  description:
    '写入任意文本文件（Markdown、YAML、TXT 等）。当需要创建非 JSON 文件时使用此工具，JSON 文件请用 write_json。',
  inputSchema: z.object({
    file_path: z.string().describe('目标文件的相对路径，如 "docs/README.md"'),
    content: z.string().describe('文件的文本内容'),
  }),
  isReadOnly: false,
  handler: async (
    input: { file_path: string; content: string },
    ctx: ToolContext
  ): Promise<ToolResult<{ path: string; size: number }>> => {
    try {
      const absPath = safeResolve(ctx.workDir, input.file_path)
      await mkdir(dirname(absPath), { recursive: true })
      await writeFile(absPath, input.content, 'utf-8')
      return {
        success: true,
        data: { path: input.file_path, size: input.content.length },
        message: `已写入文件 "${input.file_path}" (${input.content.length} 字节)`,
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
