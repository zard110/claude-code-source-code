import { describe, it, expect } from 'vitest'
import { getByPath, setByPath, deleteByPath } from '../src/utils/json-path.js'

describe('getByPath', () => {
  const obj = {
    name: 'test',
    components: [
      { type: 'Table', props: { title: '用户列表', columns: ['id', 'name'] } },
      { type: 'Form', props: { title: '编辑表单' } },
    ],
    nested: { a: { b: { c: 'deep' } } },
  }

  it('获取顶层字段', () => {
    expect(getByPath(obj, 'name')).toBe('test')
  })

  it('获取嵌套对象', () => {
    expect(getByPath(obj, 'nested.a.b.c')).toBe('deep')
  })

  it('获取数组元素', () => {
    expect(getByPath(obj, 'components[0].type')).toBe('Table')
    expect(getByPath(obj, 'components[1].type')).toBe('Form')
  })

  it('获取数组元素深层的值', () => {
    expect(getByPath(obj, 'components[0].props.title')).toBe('用户列表')
  })

  it('获取数组内的数组', () => {
    expect(getByPath(obj, 'components[0].props.columns[0]')).toBe('id')
    expect(getByPath(obj, 'components[0].props.columns[1]')).toBe('name')
  })

  it('路径不存在返回 undefined', () => {
    expect(getByPath(obj, 'nonexistent')).toBeUndefined()
    expect(getByPath(obj, 'nested.x.y')).toBeUndefined()
    expect(getByPath(obj, 'components[9].type')).toBeUndefined()
  })

  it('null/undefined 中间节点返回 undefined', () => {
    expect(getByPath(null, 'a')).toBeUndefined()
    expect(getByPath(undefined, 'a')).toBeUndefined()
    expect(getByPath({ a: null }, 'a.b')).toBeUndefined()
  })

  it('在非数组上用数字索引返回 undefined', () => {
    expect(getByPath({ a: 'hello' }, 'a[0]')).toBeUndefined()
  })

  it('在数组上用字符串路径返回 undefined', () => {
    expect(getByPath([1, 2, 3], 'x')).toBeUndefined()
  })
})

describe('setByPath', () => {
  it('设置顶层字段', () => {
    const obj: Record<string, unknown> = { name: 'old' }
    setByPath(obj, 'name', 'new')
    expect(obj.name).toBe('new')
  })

  it('设置嵌套字段', () => {
    const obj = { a: { b: 'old' } }
    setByPath(obj, 'a.b', 'new')
    expect((obj as any).a.b).toBe('new')
  })

  it('设置数组元素', () => {
    const obj = { items: ['a', 'b', 'c'] }
    setByPath(obj, 'items[1]', 'B')
    expect((obj as any).items[1]).toBe('B')
  })

  it('自动创建中间对象', () => {
    const obj: Record<string, unknown> = {}
    setByPath(obj, 'a.b.c', 'value')
    expect((obj as any).a.b.c).toBe('value')
  })

  it('自动创建中间数组', () => {
    const obj: Record<string, unknown> = {}
    setByPath(obj, 'items[0].name', 'first')
    expect((obj as any).items[0].name).toBe('first')
  })

  it('扩展现有数组', () => {
    const obj = { items: ['a'] }
    setByPath(obj, 'items[2]', 'c')
    expect((obj as any).items[2]).toBe('c')
    expect((obj as any).items).toHaveLength(3)
  })

  it('在 null 上抛错', () => {
    expect(() => setByPath(null, 'a', 1)).toThrow()
  })
})

describe('deleteByPath', () => {
  it('删除顶层字段', () => {
    const obj: Record<string, unknown> = { name: 'test', age: 10 }
    expect(deleteByPath(obj, 'name')).toBe(true)
    expect(obj).toEqual({ age: 10 })
  })

  it('删除嵌套字段', () => {
    const obj = { a: { b: 1, c: 2 } }
    expect(deleteByPath(obj, 'a.b')).toBe(true)
    expect((obj as any).a).toEqual({ c: 2 })
  })

  it('删除数组元素 (splice)', () => {
    const obj = { items: ['a', 'b', 'c'] }
    expect(deleteByPath(obj, 'items[1]')).toBe(true)
    expect((obj as any).items).toEqual(['a', 'c'])
  })

  it('路径不存在返回 false', () => {
    // { a: 1 } 中间 'a' 是 number 而非 object，所以 a.b 走不到
    expect(deleteByPath({ a: 1 }, 'a.b')).toBe(false)
    // null 中间节点
    expect(deleteByPath(null, 'a')).toBe(false)
  })

  it('null 对象返回 false', () => {
    expect(deleteByPath(null, 'a')).toBe(false)
  })
})
