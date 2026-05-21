'use client'

import { useState, useEffect } from 'react'
import CommentPanel from './CommentPanel'

export default function CollapsibleCommentAside() {
  const [open, setOpen] = useState(true)

  useEffect(() => {
    const handler = () => setOpen(true)
    window.addEventListener('open-comment-panel', handler)
    return () => window.removeEventListener('open-comment-panel', handler)
  }, [])

  return (
    <div className="flex shrink-0">
      {/* Toggle tab — always visible at the seam between content and aside */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="self-center h-12 w-4 shrink-0 rounded-l flex items-center justify-center bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-zinc-500 dark:text-zinc-400"
        title={open ? 'Collapse comments' : 'Expand comments'}
        aria-label={open ? 'Collapse comments' : 'Expand comments'}
      >
        <span className="text-[10px] leading-none">{open ? '›' : '‹'}</span>
      </button>

      <aside
        className={`shrink-0 border-l border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden transition-[width] duration-200 ${open ? 'w-80' : 'w-0'}`}
      >
        <CommentPanel />
      </aside>
    </div>
  )
}
