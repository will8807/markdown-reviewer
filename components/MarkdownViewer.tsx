'use client'

import { useEffect, useRef } from 'react'
import { applyHighlights, type HighlightThread } from '@/lib/highlights/applyHighlights'

interface Props {
  html: string
}

export default function MarkdownViewer({ html }: Props) {
  const articleRef = useRef<HTMLElement>(null)

  useEffect(() => {
    function handler(e: Event) {
      const { threads, activeId } = (e as CustomEvent<{ threads: HighlightThread[]; activeId?: string }>).detail
      if (articleRef.current) applyHighlights(articleRef.current, threads, activeId)
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
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
