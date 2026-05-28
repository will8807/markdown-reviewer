export interface RecentEntry {
  projectId: string
  sourceId: string
  sourceName: string
  projectName: string
  filePath: string
  viewedAt: number
}

const STORAGE_KEY = 'markdown-reviewer:recent-files'
const MAX_ENTRIES = 10

function load(): RecentEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as RecentEntry[]
  } catch {
    return []
  }
}

function save(entries: RecentEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}

export function recordView(entry: Omit<RecentEntry, 'viewedAt'>): void {
  const entries = load().filter(
    (e) => !(e.sourceId === entry.sourceId && e.filePath === entry.filePath),
  )
  entries.unshift({ ...entry, viewedAt: Date.now() })
  save(entries.slice(0, MAX_ENTRIES))
}

export function getRecent(limit = MAX_ENTRIES): RecentEntry[] {
  return load().slice(0, limit)
}

export function pruneMissingSources(validIds: Set<string>): void {
  save(load().filter((e) => validIds.has(e.sourceId)))
}

export function clearRecent(): void {
  localStorage.removeItem(STORAGE_KEY)
}
