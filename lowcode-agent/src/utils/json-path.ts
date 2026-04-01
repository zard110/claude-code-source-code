/**
 * JSON Path utilities — get/set/delete by dot-notation path.
 * Supports array indices: "components[0].props.title"
 */

/**
 * Parse a dot-notation path into segments
 * "components[0].props.title" → ["components", 0, "props", "title"]
 */
function parsePath(path: string): (string | number)[] {
  const segments: (string | number)[] = []
  const parts = path.split('.')

  for (const part of parts) {
    // Handle array indices: "items[0]" → "items", 0
    const match = part.match(/^(.+?)\[(\d+)\]$/)
    if (match) {
      segments.push(match[1])
      segments.push(parseInt(match[2], 10))
    } else {
      segments.push(part)
    }
  }

  return segments
}

/**
 * Get a value by JSON path.
 * Returns undefined if path doesn't exist.
 */
export function getByPath(obj: unknown, path: string): unknown {
  const segments = parsePath(path)
  let current: unknown = obj

  for (const seg of segments) {
    if (current === null || current === undefined) {
      return undefined
    }
    if (typeof seg === 'number') {
      if (!Array.isArray(current)) return undefined
      current = current[seg]
    } else {
      if (typeof current !== 'object' || Array.isArray(current)) return undefined
      current = (current as Record<string, unknown>)[seg]
    }
  }

  return current
}

/**
 * Set a value by JSON path.
 * Creates intermediate objects/arrays as needed.
 */
export function setByPath(obj: unknown, path: string, value: unknown): void {
  const segments = parsePath(path)
  let current: unknown = obj

  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i]
    const nextSeg = segments[i + 1]

    if (typeof seg === 'number') {
      if (!Array.isArray(current)) {
        throw new Error(`Expected array at segment "${seg}", got ${typeof current}`)
      }
      // Ensure the array is long enough
      while (current.length <= seg) {
        current.push(typeof nextSeg === 'number' ? [] : {})
      }
      current = current[seg]
    } else {
      if (typeof current !== 'object' || current === null || Array.isArray(current)) {
        throw new Error(`Expected object at segment "${seg}"`)
      }
      const record = current as Record<string, unknown>
      if (record[seg] === undefined) {
        record[seg] = typeof nextSeg === 'number' ? [] : {}
      }
      current = record[seg]
    }
  }

  // Set the final value
  const lastSeg = segments[segments.length - 1]
  if (typeof lastSeg === 'number') {
    if (!Array.isArray(current)) {
      throw new Error(`Expected array at final segment`)
    }
    current[lastSeg] = value
  } else {
    if (typeof current !== 'object' || current === null || Array.isArray(current)) {
      throw new Error(`Expected object at final segment`)
    }
    ;(current as Record<string, unknown>)[lastSeg] = value
  }
}

/**
 * Delete a value by JSON path.
 */
export function deleteByPath(obj: unknown, path: string): boolean {
  const segments = parsePath(path)
  let current: unknown = obj

  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i]
    if (typeof seg === 'number') {
      if (!Array.isArray(current)) return false
      current = current[seg]
    } else {
      if (typeof current !== 'object' || current === null) return false
      current = (current as Record<string, unknown>)[seg]
    }
    if (current === undefined) return false
  }

  const lastSeg = segments[segments.length - 1]
  if (typeof lastSeg === 'number') {
    if (!Array.isArray(current)) return false
    current.splice(lastSeg, 1)
  } else {
    if (typeof current !== 'object' || current === null) return false
    delete (current as Record<string, unknown>)[lastSeg]
  }

  return true
}
