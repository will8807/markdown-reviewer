'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import type { serializeSelection } from '@/lib/anchors/textAnchor'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CommentAuthor { name: string }

interface Comment {
  id: string
  body: string
  createdAt: string
  author: CommentAuthor
}

interface Anchor {
  type: string
  selectedText: string | null
  prefix: string | null
  renderedStart: number | null
  renderedEnd: number | null
  filePath: string
  diffSide: string | null
  lineStart: number | null
  lineEnd: number | null
}

interface Thread {
  id: string
  resolved: boolean
  resolvedAt: string | null
  anchor: Anchor | null
  comments: Comment[]
}

// File-viewer comment request (TEXT_SELECTION)
interface FilePendingComposer {
  anchor: ReturnType<typeof serializeSelection>
  sourceId: string
  fileId: string | null
}

// Diff-viewer comment request (DIFF_HUNK)
interface DiffPendingComposer {
  sourceId: string
  filePath: string
  diffSide: 'base' | 'head'
  lineStart: number
  lineEnd: number
  selectedText: string
  baseSha: string
  headSha: string
}

interface DiffContext {
  sourceId: string
  filePath: string
  baseSha: string
  headSha: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CommentPanel() {
  const params = useParams<{ projectId: string; sourceId: string }>()

  const [threads, setThreads] = useState<Thread[]>([])
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [fileId, setFileId] = useState<string | null>(null)
  const [diffCtx, setDiffCtx] = useState<DiffContext | null>(null)

  const [filePending, setFilePending] = useState<FilePendingComposer | null>(null)
  const [diffPending, setDiffPending] = useState<DiffPendingComposer | null>(null)

  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [devUserId, setDevUserId] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const pending = filePending ?? diffPending

  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.json())
      .then((data: { userId: string | null }) => setDevUserId(data.userId))
      .catch(() => null)
  }, [])

  // Broadcast threads so MarkdownViewer can apply highlights
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('threads-updated', { detail: { threads, activeId: activeThreadId } }),
    )
  }, [threads, activeThreadId])

  // ── File-mode thread loading ──────────────────────────────────────────────

  const refreshFileThreads = useCallback((fid: string) => {
    setFileId(fid)
    fetch(`/api/files/${fid}/comments`)
      .then((r) => r.json())
      .then((data: { threads: Thread[] }) => setThreads(data.threads ?? []))
      .catch(() => null)
  }, [])

  useEffect(() => {
    const handler = (e: Event) => {
      const { anchor, sourceId, fileId: fid } = (e as CustomEvent<FilePendingComposer>).detail
      setFilePending({ anchor, sourceId, fileId: fid })
      setDiffPending(null)
      setBody('')
      setTimeout(() => textareaRef.current?.focus(), 50)
    }
    window.addEventListener('comment-requested', handler)
    return () => window.removeEventListener('comment-requested', handler)
  }, [])

  useEffect(() => {
    const handler = (e: Event) => {
      const { fileId: fid } = (e as CustomEvent<{ fileId: string }>).detail
      if (fid) refreshFileThreads(fid)
    }
    window.addEventListener('file-opened', handler)
    window.addEventListener('thread-created', handler)
    return () => {
      window.removeEventListener('file-opened', handler)
      window.removeEventListener('thread-created', handler)
    }
  }, [refreshFileThreads])

  // ── Diff-mode thread loading ──────────────────────────────────────────────

  const refreshDiffThreads = useCallback((ctx: DiffContext) => {
    const { projectId } = params ?? {}
    if (!projectId) return
    const url =
      `/api/projects/${projectId}/sources/${ctx.sourceId}/compare/threads` +
      `?base=${encodeURIComponent(ctx.baseSha)}&head=${encodeURIComponent(ctx.headSha)}&path=${encodeURIComponent(ctx.filePath)}`
    fetch(url)
      .then((r) => r.json())
      .then((data: { threads: Thread[] }) => setThreads(data.threads ?? []))
      .catch(() => null)
  }, [params])

  useEffect(() => {
    const handler = (e: Event) => {
      const ctx = (e as CustomEvent<DiffContext>).detail
      setDiffCtx(ctx)
      setFilePending(null)
      setDiffPending(null)
      setBody('')
      setFileId(null)
      refreshDiffThreads(ctx)
    }
    window.addEventListener('diff-opened', handler)
    return () => window.removeEventListener('diff-opened', handler)
  }, [refreshDiffThreads])

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<DiffPendingComposer>).detail
      setDiffPending(detail)
      setFilePending(null)
      setBody('')
      setTimeout(() => textareaRef.current?.focus(), 50)
    }
    window.addEventListener('diff-comment-requested', handler)
    return () => window.removeEventListener('diff-comment-requested', handler)
  }, [])

  // ── Submission ────────────────────────────────────────────────────────────

  const submitFileComment = async (p: FilePendingComposer) => {
    const threadRes = await fetch('/api/comment-threads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceId: p.sourceId,
        fileId: p.fileId ?? undefined,
        anchor: {
          type: 'TEXT_SELECTION',
          filePath: p.anchor.filePath,
          selectedText: p.anchor.selectedText,
          prefix: p.anchor.prefix,
          suffix: p.anchor.suffix,
          charStart: p.anchor.charStart,
          charEnd: p.anchor.charEnd,
          renderedStart: p.anchor.renderedStart,
          renderedEnd: p.anchor.renderedEnd,
        },
      }),
    })
    if (!threadRes.ok) return
    const thread = (await threadRes.json()) as { id: string; fileId: string | null }
    if (devUserId) {
      await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId: thread.id, authorId: devUserId, body: body.trim() }),
      })
    }
    const fid = thread.fileId ?? p.fileId
    if (fid) refreshFileThreads(fid)
  }

  const submitDiffComment = async (p: DiffPendingComposer) => {
    const threadRes = await fetch('/api/comment-threads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceId: p.sourceId,
        anchor: {
          type: 'DIFF_HUNK',
          filePath: p.filePath,
          diffSide: p.diffSide,
          lineStart: p.lineStart,
          lineEnd: p.lineEnd,
          selectedText: p.selectedText,
          baseSha: p.baseSha,
          headSha: p.headSha,
        },
      }),
    })
    if (!threadRes.ok) return
    const thread = (await threadRes.json()) as { id: string }
    if (devUserId) {
      await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId: thread.id, authorId: devUserId, body: body.trim() }),
      })
    }
    if (diffCtx) refreshDiffThreads(diffCtx)
  }

  const submitComment = async () => {
    if (!body.trim()) return
    setSubmitting(true)
    try {
      if (diffPending) await submitDiffComment(diffPending)
      else if (filePending) await submitFileComment(filePending)
    } finally {
      setSubmitting(false)
      setFilePending(null)
      setDiffPending(null)
      setBody('')
    }
  }

  const toggleResolved = async (thread: Thread) => {
    await fetch(`/api/comment-threads/${thread.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolved: !thread.resolved }),
    })
    if (fileId) refreshFileThreads(fileId)
    else if (diffCtx) refreshDiffThreads(diffCtx)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const isDiffMode = diffCtx !== null

  if (!isDiffMode && !fileId && !filePending) {
    return (
      <div className="p-4">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-3">Comments</h2>
        <p className="text-sm text-zinc-400 italic">Open a file to see its comments.</p>
      </div>
    )
  }

  // Quote shown in the pending composer
  const composerQuote = diffPending
    ? `${diffPending.diffSide} · lines ${diffPending.lineStart}–${diffPending.lineEnd}`
    : filePending?.anchor.selectedText ?? null

  return (
    <div data-testid="comment-panel" className="p-4 space-y-4">
      <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide">Comments</h2>

      {/* Composer */}
      {pending && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950 p-3 space-y-2">
          {composerQuote && (
            <blockquote className="border-l-2 border-blue-300 pl-2 text-xs text-blue-600 dark:text-blue-400 italic truncate">
              {composerQuote}
            </blockquote>
          )}
          <textarea
            ref={textareaRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitComment()
              if (e.key === 'Escape') {
                setFilePending(null)
                setDiffPending(null)
                setBody('')
              }
            }}
            placeholder="Add a comment…"
            rows={3}
            className="w-full rounded border border-blue-200 dark:border-blue-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => { setFilePending(null); setDiffPending(null); setBody('') }}
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
        <p className="text-sm text-zinc-400 italic">
          {isDiffMode ? 'Click a highlighted block to add a comment.' : 'Select text to add a comment.'}
        </p>
      ) : (
        <ul className="space-y-3">
          {threads.map((thread) => {
            const isDiffThread = thread.anchor?.type === 'DIFF_HUNK'
            const quote = isDiffThread && thread.anchor?.lineStart
              ? `${thread.anchor.diffSide} · lines ${thread.anchor.lineStart}–${thread.anchor.lineEnd ?? thread.anchor.lineStart}`
              : thread.anchor?.selectedText ?? null

            return (
              <li
                key={thread.id}
                data-testid="comment-thread"
                onClick={() => setActiveThreadId((id) => (id === thread.id ? null : thread.id))}
                className={`rounded-lg border p-3 text-sm cursor-pointer ${
                  thread.resolved
                    ? 'border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 opacity-60'
                    : activeThreadId === thread.id
                    ? 'border-amber-400 bg-amber-50 dark:border-amber-600 dark:bg-amber-950/30'
                    : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                }`}
              >
                {quote && (
                  <blockquote className="mb-2 border-l-2 border-zinc-300 pl-2 text-xs text-zinc-500 italic truncate">
                    {quote}
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
                  onClick={(e) => { e.stopPropagation(); toggleResolved(thread) }}
                  className="mt-2 text-xs text-zinc-400 hover:text-zinc-600 underline"
                >
                  {thread.resolved ? 'Reopen' : 'Resolve'}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
