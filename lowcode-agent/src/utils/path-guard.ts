/**
 * 路径安全守卫 — 防止路径遍历攻击
 *
 * 所有文件工具必须使用 safeResolve() 而不是直接 join()，
 * 确保解析后的路径始终在工作目录内。
 */
import { resolve, sep } from 'node:path'

/**
 * 安全解析文件路径，确保结果在工作目录内。
 * @throws 如果路径越界（包含 .. 逃逸或指向工作目录外的绝对路径）
 */
export function safeResolve(workDir: string, inputPath: string): string {
  const resolved = resolve(workDir, inputPath)
  const normalizedWorkDir = resolve(workDir)
  if (!resolved.startsWith(normalizedWorkDir + sep) && resolved !== normalizedWorkDir) {
    throw new Error(`路径越界: "${inputPath}" 解析为 "${resolved}"，不在工作目录 "${normalizedWorkDir}" 内`)
  }
  return resolved
}
