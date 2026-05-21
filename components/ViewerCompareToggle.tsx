'use client'

import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'

export default function ViewerCompareToggle() {
  const params = useParams<{ projectId?: string; sourceId?: string }>()
  const pathname = usePathname()

  if (!params?.projectId || !params?.sourceId) return null

  const { projectId, sourceId } = params
  const base = `/projects/${projectId}/sources/${sourceId}`
  const isCompare = pathname?.includes('/compare')

  const activeClass =
    'flex-1 py-1.5 text-center text-xs font-semibold text-zinc-800 dark:text-zinc-100 bg-zinc-100 dark:bg-zinc-700 rounded'
  const inactiveClass =
    'flex-1 py-1.5 text-center text-xs font-medium text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 rounded'

  return (
    <div className="px-2 py-2 border-b border-zinc-200 dark:border-zinc-700">
      <div className="flex gap-1 bg-zinc-200 dark:bg-zinc-800 rounded p-0.5">
        <Link href={base} className={isCompare ? inactiveClass : activeClass}>
          Viewer
        </Link>
        <Link href={`${base}/compare`} className={isCompare ? activeClass : inactiveClass}>
          Compare
        </Link>
      </div>
    </div>
  )
}
