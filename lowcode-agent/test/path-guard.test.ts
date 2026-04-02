import { describe, it, expect } from 'vitest'
import { safeResolve } from '../src/utils/path-guard.js'
import { resolve } from 'node:path'

describe('safeResolve', () => {
  const workDir = resolve('/project')

  it('正常相对路径正常工作', () => {
    expect(safeResolve(workDir, 'pages/user.json')).toBe(resolve('/project/pages/user.json'))
  })

  it('./ 前缀正常工作', () => {
    expect(safeResolve(workDir, './pages/user.json')).toBe(resolve('/project/pages/user.json'))
  })

  it('拒绝 ../ 路径遍历', () => {
    expect(() => safeResolve(workDir, '../../../etc/passwd')).toThrow('路径越界')
  })

  it('拒绝逃逸到上级目录', () => {
    expect(() => safeResolve(workDir, '../../other-project/file.json')).toThrow('路径越界')
  })

  it('拒绝工作目录外的绝对路径', () => {
    expect(() => safeResolve(workDir, '/etc/passwd')).toThrow('路径越界')
  })

  it('工作目录本身合法', () => {
    expect(safeResolve(workDir, '.')).toBe(workDir)
  })

  it('子目录合法', () => {
    expect(safeResolve(workDir, 'apis')).toBe(resolve('/project/apis'))
  })

  it('深层嵌套路径合法', () => {
    expect(safeResolve(workDir, 'a/b/c/d/file.json')).toBe(resolve('/project/a/b/c/d/file.json'))
  })
})
