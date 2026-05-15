'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import type { serializeSelection } from '@/lib/anchors/textAnchor'

interface Comment {
  id: string
  body: string
  createdAt: string
  author: { name: string }
}

interface Thread {
  id: string
  resolved: boolean
  resolvedAt: string | null
  anchor: { selectedText: string | null; filePath: string } | null
  comments: Comment[]
}

interface PendingComposer {
  anchor: ReturnType<typeof serializeSelection>
  sourceId: string
  fileId: string | null
  devUserId: string | null
}

export default function CommentPanel() {
  const params = useParams<{ projectId: string; sourceId: string }>()
  const searchParams = useSearchParams()
  const [threads, setThreads] = useState<Thread[]>([])
  const [fileId, setFileId] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingComposer | null>(null)
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const filePath = searchParams?.get('path')

  const refresh = useCallback((fid: string) => {
    setFileId(fid)
    fetch(`/api/files/${fid}/comments`)
      .then((r) => r.json())
      .then((data: { threads: Thread[] }) => setThreads(data.threads ?? []))
      .catch(() => null)
  }, [])

  // Listen for new thread requests from ViewerClient
  useEffect(() => {
    function handler(e: Event) {
      const detail = (e as CustomEvent<PendingComposer>).detail
      setPending(detail)
      setBody('')
      setTimeout(() => textareaRef.current?.focus(), 50)
    }
    window.addEventListener('comment-requested', handler)
    return () => window.removeEventListener('comment-requested', handler)
  }, [])

  // Listen for thread-created refresh signals
  useEffect(() => {
    function handler(e: Event) {
      const detail = (e as CustomEvent<{ fileId: string }>).detail
      if (detail?.fileId) refresh(detail.fileId)
    }
    window.addEventListener('thread-created', handler)
    return () => window.removeEventListener('thread-created', handler)
  }, [refresh])

  // Reset threads when file changes
  useEffect(() => {
    setThreads([])
    setFileId(null)
    setPending(null)
  }, [filePath])

  const submitComment = async () => {
    if (!pending || !body.trim()) return
    setSubmitting(true)

    try {
      // Create the thread
      const threadRes = await fetch('/api/comment-threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceId: pending.sourceId,
          fileId: pending.fileId ?? undefined,
          anchor: {
            type: 'TEXT_SELECTION',
            filePath: pending.anchor.filePath,
            selectedText: pending.anchor.selectedText,
            prefix: pending.anchor.prefix,
            suffix: pending.anchor.suffix,
            charStart: pending.anchor.charStart,
            charEnd: pending.anchor.charEnd,
          },
        }),
      })
      if (!threadRes.ok) return

      const thread = (await threadRes.json()) as { id: string; fileId: string | null }

      // Add the comment
      if (pending.devUserId) {
        await fetch('/api/comments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            threadId: thread.id,
            authorId: pending.devUserId,
            body: body.trim(),
          }),
        })
      }

      const effectiveFileId = thread.fileId ?? pending.fileId
      if (effectiveFileId) refresh(effectiveFileId)
    } finally {
      setSubmitting(false)
      setPending(null)
      setBody('')
    }
  }

  const toggleResolved = async (thread: Thread) => {
    await fetch(`/api/comment-threads/${thread.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolved: !thread.resolved }),
    })
    if (fileId) refresh(fileId)
  }

  if (!filePath) {
    return (
      <div className="p-4">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-3">Comments</h2>
        <p className="text-sm text-zinc-400 italic">Open a file to see its comments.</p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide">Comments</h2>

      {/* Composer */}
      {pending && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950 p-3 space-y-2">
          {pending.anchor.selectedText && (
            <blockquote className="border-l-2 border-blue-300 pl-2 text-xs text-blue-600 dark:text-blue-400 italic truncate">
              {pending.anchor.selectedText}
            </blockquote>
          )}
          <textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitComment()
              if (e.key === 'Escape') { setPending(null); setBody('') }
            }}
            placeholder="Add a comment…"
            rows={3}
            className="w-full rounded border border-blue-200 dark:border-blue-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setPending(null); setBody('') }}
              className="text-xs text-zinc-500 hover:text-zinc-700 px-2 py-1"
            >
              Cancel
            </button>
            <button
              onClick={submitComment}
              disabled={!body.trim() || submitting}
              className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-40"
            >
              {submitting ? 'Saving…' : 'Comment'}
            </button>
          </div>
        </div>
      )}

      {/* Thread list */}
      {threads.length === 0 && !pending ? (
        <p className="text-sm text-zinc-400 italic">Select text to add a comment.</p>
      ) : (
        <ul className="space-y-3">
          {threads.map((thread) => (
            <li
              key={thread.id}
              className={`rounded-lg border p-3 text-sm ${
                thread.resolved
                  ? 'border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 opacity-60'
                  : 'border-zinc-200 dark:border-zinc-700'
              }`}
            >
              {thread.anchor?.selectedText && (
                <blockquote className="mb-2 border-l-2 border-zinc-300 pl-2 text-xs text-zinc-500 italic truncate">
                  {thread.anchor.selectedText}
                </blockquote>
              )}
              <ul className="space-y-2">
                {thread.comments.map((c) => (
                  <li key={c.id}>
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">{c.author.name}</span>
                    <p className="text-zinc-600 dark:text-zinc-400 mt-0.5">{c.body}</p>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => toggleResolved(thread)}
                className="mt-2 text-xs text-zinc-400 hover:text-zinc-600 underline"
              >
                {thread.resolved ? 'Reopen' : 'Resolve'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
