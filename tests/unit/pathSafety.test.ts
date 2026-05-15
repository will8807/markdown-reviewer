import { describe, it, expect } from 'vitest'
import { assertSafe } from '@/lib/sources/pathSafety'

describe('assertSafe', () => {
  const root = '/srv/data'

  it('accepts a simple relative filename', () => {
    expect(() => assertSafe(root, 'README.md')).not.toThrow()
  })

  it('accepts a nested relative path', () => {
    expect(() => assertSafe(root, 'guide/setup.md')).not.toThrow()
  })

  it('rejects a single-segment traversal', () => {
    expect(() => assertSafe(root, '../etc/passwd')).toThrow(/path traversal/i)
  })

  it('rejects a multi-segment traversal', () => {
    expect(() => assertSafe(root, 'foo/../../etc/passwd')).toThrow(/path traversal/i)
  })

  it('rejects an absolute path that escapes the root', () => {
    expect(() => assertSafe(root, '/etc/passwd')).toThrow(/path traversal/i)
  })

  it('accepts a path that resolves exactly to the root', () => {
    expect(() => assertSafe(root, '.')).not.toThrow()
  })

  it('normalises Windows backslashes before checking', () => {
    expect(() => assertSafe(root, '..\\etc\\passwd')).toThrow(/path traversal/i)
  })
})
