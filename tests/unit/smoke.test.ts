import { describe, it, expect } from 'vitest'

describe('pathSafety (smoke)', () => {
  it('rejects paths that escape the root', async () => {
    const { assertSafe } = await import('@/lib/sources/pathSafety')
    expect(() => assertSafe('/data', '../etc/passwd')).toThrow()
  })
})
