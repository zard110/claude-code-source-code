import { describe, it, expect } from 'vitest'
import { jsonDiff } from '../src/utils/diff.js'

describe('jsonDiff', () => {
  it('相同值返回无变化', () => {
    expect(jsonDiff('hello', 'hello')).toBe('（无变化）')
    expect(jsonDiff(42, 42)).toBe('（无变化）')
    expect(jsonDiff(null, null)).toBe('（无变化）')
  })

  it('基本类型变更', () => {
    const result = jsonDiff('old', 'new', 'name')
    expect(result).toContain('name')
    expect(result).toContain('"old"')
    expect(result).toContain('"new"')
  })

  it('对象新增字段', () => {
    const result = jsonDiff({ a: 1 }, { a: 1, b: 2 })
    expect(result).toContain('+')
    expect(result).toContain('b')
    expect(result).toContain('2')
  })

  it('对象删除字段', () => {
    const result = jsonDiff({ a: 1, b: 2 }, { a: 1 })
    expect(result).toContain('-')
    expect(result).toContain('b')
    expect(result).toContain('2')
  })

  it('对象字段变更', () => {
    const result = jsonDiff({ a: 1 }, { a: 2 }, 'root')
    expect(result).toContain('root.a')
    expect(result).toContain('1')
    expect(result).toContain('2')
  })

  it('嵌套对象递归比较', () => {
    const old = { user: { name: 'Alice', age: 20 } }
    const new_ = { user: { name: 'Bob', age: 20 } }
    const result = jsonDiff(old, new_)
    expect(result).toContain('user.name')
    expect(result).toContain('"Alice"')
    expect(result).toContain('"Bob"')
  })

  it('数组长度变化', () => {
    const result = jsonDiff([1, 2], [1, 2, 3], 'arr')
    expect(result).toContain('arr')
  })

  it('数组元素变化', () => {
    const result = jsonDiff([1, 2, 3], [1, 5, 3], 'items')
    expect(result).toContain('items')
  })

  it('类型变更（值变为对象）', () => {
    const result = jsonDiff('string', { a: 1 }, 'field')
    expect(result).toContain('"string"')
    expect(result).toContain('{"a":1}')
  })

  it('空路径前缀', () => {
    const result = jsonDiff(1, 2)
    expect(result).toContain('~')
  })
})
