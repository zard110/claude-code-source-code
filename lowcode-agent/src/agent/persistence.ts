/**
 * 会话持久化 — 灵感来自 Claude Code 的 JSONL 会话存储
 *
 * 将对话历史写入 .agent/session.jsonl，每行一条消息。
 * 进程重启后可恢复上次的对话上下文。
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import type { Message } from './core.js'

const SESSION_DIR = '.agent'
const SESSION_FILE = 'session.jsonl'

function sessionPath(workDir: string): string {
  return resolve(workDir, SESSION_DIR, SESSION_FILE)
}

/** 保存对话历史到 JSONL 文件 */
export async function saveSession(workDir: string, messages: readonly Message[]): Promise<void> {
  const filePath = sessionPath(workDir)
  await mkdir(dirname(filePath), { recursive: true })
  const lines = messages.map(m => JSON.stringify(m)).join('\n')
  await writeFile(filePath, lines, 'utf-8')
}

/** 从 JSONL 文件加载上次对话历史 */
export async function loadSession(workDir: string): Promise<Message[]> {
  const filePath = sessionPath(workDir)
  try {
    const content = await readFile(filePath, 'utf-8')
    if (!content.trim()) return []
    return content
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line) as Message)
  } catch {
    // 文件不存在或读取失败，返回空历史
    return []
  }
}
