import { readdir, stat } from 'node:fs/promises'
import { join, extname, relative } from 'node:path'
import type { ToolContext } from '../tools/types.js'

/**
 * Project context — scans the working directory and builds
 * a summary that the LLM can use to understand the project state.
 */
export interface ProjectContext {
  workDir: string
  files: FileInfo[]
  summary: string
}

export interface FileInfo {
  path: string       // relative path
  size: number       // bytes
  modified: string   // ISO date
}

/**
 * Build project context by scanning the working directory
 */
export async function buildProjectContext(workDir: string): Promise<ProjectContext> {
  const files = await scanFiles(workDir)
  const summary = buildSummary(files, workDir)

  return { workDir, files, summary }
}

/**
 * Create a ToolContext for tool execution
 */
export function createToolContext(workDir: string): ToolContext {
  return {
    workDir,
    fileCache: new Map(),
  }
}

async function scanFiles(root: string): Promise<FileInfo[]> {
  const results: FileInfo[] = []

  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(fullPath)
      } else if (extname(entry.name) === '.json') {
        const info = await stat(fullPath)
        results.push({
          path: relative(root, fullPath),
          size: info.size,
          modified: info.mtime.toISOString(),
        })
      }
    }
  }

  try {
    await walk(root)
  } catch {
    // Directory might not exist yet
  }

  return results.sort((a, b) => a.path.localeCompare(b.path))
}

function buildSummary(files: FileInfo[], workDir: string): string {
  if (files.length === 0) {
    return `项目目录 "${workDir}" 下暂无 JSON 文件。`
  }

  // Group files by directory
  const groups = new Map<string, string[]>()
  for (const f of files) {
    const dir = f.path.includes('/') ? f.path.substring(0, f.path.lastIndexOf('/')) : '.'
    if (!groups.has(dir)) groups.set(dir, [])
    groups.get(dir)!.push(`  ${f.path} (${formatSize(f.size)})`)
  }

  let summary = `项目目录 "${workDir}" 包含 ${files.length} 个 JSON 文件：\n`
  for (const [dir, fileList] of groups) {
    summary += `\n${dir}/\n${fileList.join('\n')}\n`
  }

  return summary
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}
