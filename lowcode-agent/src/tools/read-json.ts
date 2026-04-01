import { z } from 'zod'
import { buildTool, type ToolContext, type ToolResult } from './types.js'
import { readFile } from 'node:fs/promises'
import { join, isAbsolute } from 'node:path'

export const readJsonTool = buildTool({
  name: 'read_json',
  description:
    '读取指定 JSON 文件的内容。使用相对路径（相对于项目根目录）。用于查看页面或接口的当前配置。',
  inputSchema: z.object({
    file_path: z.string().describe('JSON 文件的相对路径，如 "pages/user-list.json"'),
  }),
  isReadOnly: true,
  handler: async (
    input: { file_path: string },
    ctx: ToolContext
  ): Promise<ToolResult<object>> => {
    try {
      const absPath = isAbsolute(input.file_path)
        ? input.file_path
        : join(ctx.workDir, input.file_path)

      const content = await readFile(absPath, 'utf-8')
      const json = JSON.parse(content)

      // Cache the file for later use
      ctx.fileCache.set(absPath, json)

      return {
        success: true,
        data: json,
        message: `已读取 "${input.file_path}" (${content.length} 字节)\n\n${content}`,
      }
    } catch (err: unknown) {
      return {
        success: false,
        error: String(err),
        message: `读取文件 "${input.file_path}" 失败: ${err}`,
      }
    }
  },
})
