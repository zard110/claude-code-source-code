/**
 * JSON diff display utility
 */

/**
 * Compare two JSON values and return a human-readable diff
 */
export function jsonDiff(oldVal: unknown, newVal: unknown, path = ''): string {
  const lines: string[] = []

  if (oldVal === newVal) return '（无变化）'

  // Both are objects (not null, not array)
  if (
    typeof oldVal === 'object' && oldVal !== null && !Array.isArray(oldVal) &&
    typeof newVal === 'object' && newVal !== null && !Array.isArray(newVal)
  ) {
    const oldObj = oldVal as Record<string, unknown>
    const newObj = newVal as Record<string, unknown>
    const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)])

    for (const key of allKeys) {
      const subPath = path ? `${path}.${key}` : key
      if (!(key in newObj)) {
        lines.push(`  - ${subPath}: ${JSON.stringify(oldObj[key])}`)
      } else if (!(key in oldObj)) {
        lines.push(`  + ${subPath}: ${JSON.stringify(newObj[key])}`)
      } else if (oldObj[key] !== newObj[key]) {
        lines.push(...jsonDiff(oldObj[key], newObj[key], subPath).split('\n'))
      }
    }
  }
  // Both are arrays
  else if (Array.isArray(oldVal) && Array.isArray(newVal)) {
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      lines.push(`  ~ ${path || '(root)'}: [${oldVal.length} items] → [${newVal.length} items]`)
      // Show first few changed items
      const maxShow = 3
      let shown = 0
      for (let i = 0; i < Math.max(oldVal.length, newVal.length) && shown < maxShow; i++) {
        const subPath = `${path}[${i}]`
        if (i >= oldVal.length) {
          lines.push(`  + ${subPath}: ${JSON.stringify(newVal[i])}`)
          shown++
        } else if (i >= newVal.length) {
          lines.push(`  - ${subPath}: ${JSON.stringify(oldVal[i])}`)
          shown++
        } else if (JSON.stringify(oldVal[i]) !== JSON.stringify(newVal[i])) {
          lines.push(...jsonDiff(oldVal[i], newVal[i], subPath).split('\n'))
          shown++
        }
      }
      if (shown >= maxShow) {
        lines.push(`  ... (更多差异省略)`)
      }
    }
  }
  // Values are different primitives
  else {
    const prefix = path ? `  ~ ${path}:` : '  ~'
    lines.push(`${prefix} ${JSON.stringify(oldVal)} → ${JSON.stringify(newVal)}`)
  }

  return lines.join('\n')
}
