'use client'

import { useEffect, useMemo, useRef } from 'react'
import { applyHighlights, type HighlightThread } from '@/lib/highlights/applyHighlights'

interface Props {
  html: string
}

// Scroll the active comment's anchored passage into view. The active thread's
// range is stored in the CSS Custom Highlight registry by applyHighlights.
function scrollToActiveHighlight() {
  if (typeof CSS === 'undefined' || !('highlights' in CSS)) return
  const highlight = CSS.highlights.get('comment-thread-active')
  if (!highlight) return
  const range = [...highlight][0]
  const target = range?.startContainer.parentElement
  target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

export default function MarkdownViewer({ html }: Props) {
  const articleRef = useRef<HTMLElement>(null)

  // Stable dangerouslySetInnerHTML object — React 19 re-applies (and re-sets
  // innerHTML) when the prop object's identity changes, which would detach the
  // CSS Custom Highlight ranges applied imperatively below.
  const inner = useMemo(() => ({ __html: html }), [html])

  useEffect(() => {
    function handler(e: Event) {
      const { threads, activeId, scrollToActive } = (
        e as CustomEvent<{ threads: HighlightThread[]; activeId?: string; scrollToActive?: boolean }>
      ).detail
      if (!articleRef.current) return
      applyHighlights(articleRef.current, threads, activeId)
      if (scrollToActive && activeId) scrollToActiveHighlight()
    }
    window.addEventListener('threads-updated', handler)
    return () => {
      window.removeEventListener('threads-updated', handler)
      if (typeof CSS !== 'undefined' && 'highlights' in CSS) CSS.highlights.clear()
    }
  }, [])

  return (
    <article
      ref={articleRef}
      className="prose prose-zinc dark:prose-invert max-w-none p-8"
      dangerouslySetInnerHTML={inner}
    />
  )
}
