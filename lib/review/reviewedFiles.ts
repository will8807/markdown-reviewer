export interface ReviewedEntry {
  sha: string | null
  reviewedAt: number
}

type StorageShape = Record<string, Record<string, ReviewedEntry>>

const STORAGE_KEY = 'markdown-reviewer:reviewed-files'

function load(): StorageShape {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as StorageShape
  } catch {
    return {}
  }
}

function save(data: StorageShape): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function markReviewed(sourceId: string, filePath: string, sha: string | null): void {
  const data = load()
  if (!data[sourceId]) data[sourceId] = {}
  data[sourceId][filePath] = { sha, reviewedAt: Date.now() }
  save(data)
}

export function markUnreviewed(sourceId: string, filePath: string): void {
  const data = load()
  if (!data[sourceId]) return
  delete data[sourceId][filePath]
  save(data)
}

export function getReviewedEntry(sourceId: string, filePath: string): ReviewedEntry | null {
  return load()[sourceId]?.[filePath] ?? null
}

export function getReviewedMap(sourceId: string): Map<string, ReviewedEntry> {
  const entries = load()[sourceId] ?? {}
  return new Map(Object.entries(entries))
}

export function clearReviewedForSource(sourceId: string): void {
  const data = load()
  delete data[sourceId]
  save(data)
}
