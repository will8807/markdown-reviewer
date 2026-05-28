'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getRecent, type RecentEntry } from '@/lib/activity/recentFiles'

export default function RecentFiles() {
  const [entries, setEntries] = useState<RecentEntry[]>([])

  useEffect(() => {
    setEntries(getRecent(5))
  }, [])

  if (entries.length === 0) return null

  return (
    <section className="mb-8">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-3">
        Recently viewed
      </h2>
      <ul className="space-y-1">
        {entries.map((e) => (
          <li key={`${e.sourceId}:${e.filePath}`}>
            <Link
              href={`/projects/${e.projectId}/sources/${e.sourceId}?path=${encodeURIComponent(e.filePath)}`}
              className="flex items-baseline justify-between rounded px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <span className="text-sm truncate">{e.filePath.split('/').pop()}</span>
              <span className="text-xs text-zinc-400 shrink-0 ml-3">
                {e.sourceName} · {e.projectName}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
