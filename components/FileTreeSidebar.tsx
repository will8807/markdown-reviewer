'use client'

import { Suspense } from 'react'
import { usePathname } from 'next/navigation'
import FileTree from './FileTree'
import ViewerCompareToggle from './ViewerCompareToggle'

export default function FileTreeSidebar() {
  const pathname = usePathname()
  if (pathname?.includes('/compare')) return null
  return (
    <aside
      data-testid="file-tree"
      className="w-64 shrink-0 border-r border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden"
    >
      <ViewerCompareToggle />
      <div className="flex-1 overflow-y-auto">
        <Suspense fallback={null}>
          <FileTree />
        </Suspense>
      </div>
    </aside>
  )
}
