/**
 * 项目记忆 — 灵感来自 Claude Code 的 CLAUDE.md 机制
 *
 * 读取工作目录下的 AGENT.md 文件（如果存在），将内容注入 system prompt。
 * 用户可在 AGENT.md 中写：
 * - 项目约定（命名规范、目录结构）
 * - 常用配置模板
 * - 偏好设置
 * - 重要的业务规则
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const AGENT_MD_FILENAME = 'AGENT.md'

/** 读取项目记忆文件内容 */
export async function loadProjectMemory(workDir: string): Promise<string | null> {
  const filePath = join(workDir, AGENT_MD_FILENAME)
  try {
    const content = await readFile(filePath, 'utf-8')
    return content.trim() || null
  } catch {
    return null
  }
}
