import { z } from 'zod'
import { buildTool, type ToolContext, type ToolResult } from './types.js'
import { readdir } from 'node:fs/promises'
import { join, extname, relative } from 'node:path'

export const listFilesTool = buildTool({
  name: 'list_files',
  description:
    '列出项目工作目录下的文件。返回所有 JSON 文件的相对路径列表。用于了解项目中有哪些页面和接口文件。',
  inputSchema: z.object({
    extension: z
      .string()
      .optional()
      .describe('只列出指定扩展名的文件，如 ".json"。默认列出所有文件。'),
    directory: z
      .string()
      .optional()
      .describe('只列出指定子目录下的文件。默认列出整个项目。'),
  }),
  isReadOnly: true,
  handler: async (
    input: { extension?: string; directory?: string },
    ctx: ToolContext
  ): Promise<ToolResult<string[]>> => {
    try {
      const targetDir = input.directory
        ? join(ctx.workDir, input.directory)
        : ctx.workDir
      const ext = input.extension || '.json'

      const files = await listFilesRecursive(targetDir, ext)
      const relativeFiles = files.map((f) => relative(ctx.workDir, f))

      return {
        success: true,
        data: relativeFiles,
        message: relativeFiles.length > 0
          ? `找到 ${relativeFiles.length} 个文件：\n${relativeFiles.map((f) => `  - ${f}`).join('\n')}`
          : '未找到任何文件。',
      }
    } catch (err: unknown) {
      return {
        success: false,
        error: String(err),
        message: `列出文件失败: ${err}`,
      }
    }
  },
})

async function listFilesRecursive(dir: string, ext: string): Promise<string[]> {
  const results: string[] = []
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        results.push(...await listFilesRecursive(fullPath, ext))
      } else if (extname(entry.name) === ext) {
        results.push(fullPath)
      }
    }
  } catch {
    // Skip directories we can't read
  }
  return results
}
