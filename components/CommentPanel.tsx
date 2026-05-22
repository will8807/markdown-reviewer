'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { serializeSelection } from '@/lib/anchors/textAnchor'
import { filterThreads, sortThreads, type StatusFilter } from '@/lib/comments/threadFilters'
import { getPanelContext } from '@/lib/comments/panelContext'
import { shouldNavigateForThread, viewerUrlForFile, type CommentScope } from '@/lib/comments/crossFileNav'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CommentAuthor { id: string; name: string }

function formatCommentDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  if (d.toDateString() === now.toDateString()) return `Today · ${time}`
  const date = d.getFullYear() === now.getFullYear()
    ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  return `${date} · ${time}`
}

interface Comment {
  id: string
  body: string
  createdAt: string
  editedAt: string | null
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
  imgX: number | null
  imgY: number | null
  imgW: number | null
  imgH: number | null
}

type ThreadStatus = 'OPEN' | 'ACCEPTED' | 'REJECTED' | 'DISCUSS'

interface Thread {
  id: string
  status: ThreadStatus
  resolved: boolean
  resolvedAt: string | null
  createdAt: string
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

// Image-region comment request (IMAGE_REGION)
interface ImageRegionPendingComposer {
  sourceId: string
  filePath: string
  diffSide: 'base' | 'head'
  imgX: number
  imgY: number
  imgW: number
  imgH: number
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
  const router = useRouter()

  const [threads, setThreads] = useState<Thread[]>([])
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [fileId, setFileId] = useState<string | null>(null)
  const [viewerSha, setViewerSha] = useState<string | null>(null)
  const [diffCtx, setDiffCtx] = useState<DiffContext | null>(null)

  const [filePending, setFilePending] = useState<FilePendingComposer | null>(null)
  const [diffPending, setDiffPending] = useState<DiffPendingComposer | null>(null)
  const [imagePending, setImagePending] = useState<ImageRegionPendingComposer | null>(null)

  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [devUserId, setDevUserId] = useState<string | null>(null)
  const [replyThreadId, setReplyThreadId] = useState<string | null>(null)
  const [replyBody, setReplyBody] = useState('')
  const [replySubmitting, setReplySubmitting] = useState(false)
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editBody, setEditBody] = useState('')
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [authorFilter, setAuthorFilter] = useState<string>('all')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [scope, setScope] = useState<CommentScope>('file')
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const threadListRef = useRef<HTMLUListElement>(null)
  // Set before a cross-file navigation so the thread can be activated once the
  // target file's viewer mounts; scrollPendingRef asks the viewer to scroll.
  const pendingActivationRef = useRef<string | null>(null)
  const scrollPendingRef = useRef(false)

  // Stable refs so the mount-bootstrap effect can call them without deps
  const refreshFileThreadsRef = useRef<(fid: string, sha?: string | null) => void>(() => {})
  const refreshDiffThreadsRef = useRef<(ctx: DiffContext) => void>(() => {})

  const pending = filePending ?? diffPending ?? imagePending

  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.json())
      .then((data: { userId: string | null }) => setDevUserId(data.userId))
      .catch(() => null)
  }, [])

  // Broadcast threads so MarkdownViewer / RenderedDiff can apply highlights
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('threads-updated', {
        detail: { threads, activeId: activeThreadId, scrollToActive: scrollPendingRef.current },
      }),
    )
    scrollPendingRef.current = false
  }, [threads, activeThreadId])

  // Focus a thread when a diff comment marker is clicked
  useEffect(() => {
    const handler = (e: Event) => {
      const { threadId } = (e as CustomEvent<{ threadId: string }>).detail
      setActiveThreadId(threadId)
      // Scroll the thread card into view after React re-renders
      requestAnimationFrame(() => {
        const el = threadListRef.current?.querySelector<HTMLElement>(`[data-thread-id="${threadId}"]`)
        el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      })
    }
    window.addEventListener('focus-thread', handler)
    return () => window.removeEventListener('focus-thread', handler)
  }, [])

  // ── File-mode thread loading ──────────────────────────────────────────────

  const refreshFileThreads = useCallback((fid: string, sha?: string | null) => {
    setFileId(fid)
    const url = sha
      ? `/api/files/${fid}/comments?sha=${encodeURIComponent(sha)}`
      : `/api/files/${fid}/comments`
    fetch(url)
      .then((r) => r.json())
      .then((data: { threads: Thread[] }) => setThreads(data.threads ?? []))
      .catch(() => null)
  }, [])
  refreshFileThreadsRef.current = refreshFileThreads

  // ── All-files thread loading ──────────────────────────────────────────────

  const refreshAllThreads = useCallback(() => {
    const projectId = params?.projectId
    const sourceId = params?.sourceId
    if (!projectId || !sourceId) return
    fetch(`/api/projects/${projectId}/sources/${sourceId}/threads`)
      .then((r) => r.json())
      .then((data: { threads: Thread[] }) => setThreads(data.threads ?? []))
      .catch(() => null)
  }, [params])

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
      const { fileId: fid, filePath, sha } = (
        e as CustomEvent<{ fileId: string; filePath?: string; sha?: string | null }>
      ).detail
      if (!fid) return
      setViewerSha(sha ?? null)
      if (filePath != null) setCurrentFilePath(filePath)
      if (scope === 'all') {
        // The all-files list is already loaded; just activate the thread that
        // triggered this navigation (if any) and let the viewer scroll to it.
        setFileId(fid)
        const pending = pendingActivationRef.current
        if (pending) {
          pendingActivationRef.current = null
          scrollPendingRef.current = true
          setActiveThreadId(pending)
        }
      } else {
        refreshFileThreads(fid, sha)
      }
    }
    window.addEventListener('file-opened', handler)
    window.addEventListener('thread-created', handler)
    return () => {
      window.removeEventListener('file-opened', handler)
      window.removeEventListener('thread-created', handler)
    }
  }, [refreshFileThreads, scope])

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
  refreshDiffThreadsRef.current = refreshDiffThreads

  // Reload whatever the panel is currently showing after a thread mutation.
  const refreshThreads = useCallback(() => {
    if (scope === 'all') refreshAllThreads()
    else if (fileId) refreshFileThreads(fileId, viewerSha)
    else if (diffCtx) refreshDiffThreads(diffCtx)
  }, [scope, fileId, viewerSha, diffCtx, refreshAllThreads, refreshFileThreads, refreshDiffThreads])

  // Bootstrap on mount: if a content component fired its event before our
  // listeners registered, read the stored context and load threads now.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const ctx = getPanelContext()
    if (!ctx) return
    if (ctx.type === 'file') {
      setViewerSha(ctx.sha ?? null)
      setCurrentFilePath(ctx.filePath)
      refreshFileThreadsRef.current(ctx.fileId, ctx.sha)
    } else {
      setDiffCtx(ctx)
      refreshDiffThreadsRef.current(ctx)
    }
  }, []) // mount only

  useEffect(() => {
    const handler = (e: Event) => {
      const ctx = (e as CustomEvent<DiffContext>).detail
      setDiffCtx(ctx)
      setFilePending(null)
      setDiffPending(null)
      setImagePending(null)
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
      setImagePending(null)
      setBody('')
      setTimeout(() => textareaRef.current?.focus(), 50)
    }
    window.addEventListener('diff-comment-requested', handler)
    return () => window.removeEventListener('diff-comment-requested', handler)
  }, [])

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<ImageRegionPendingComposer>).detail
      setImagePending(detail)
      setFilePending(null)
      setDiffPending(null)
      setBody('')
      setTimeout(() => textareaRef.current?.focus(), 50)
    }
    window.addEventListener('image-region-comment-requested', handler)
    return () => window.removeEventListener('image-region-comment-requested', handler)
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
    if (fid) refreshFileThreads(fid, viewerSha)
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

  const submitImageRegionComment = async (p: ImageRegionPendingComposer) => {
    const threadRes = await fetch('/api/comment-threads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceId: p.sourceId,
        anchor: {
          type: 'IMAGE_REGION',
          filePath: p.filePath,
          diffSide: p.diffSide,
          imgX: p.imgX,
          imgY: p.imgY,
          imgW: p.imgW,
          imgH: p.imgH,
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
      else if (imagePending) await submitImageRegionComment(imagePending)
      else if (filePending) await submitFileComment(filePending)
    } finally {
      setSubmitting(false)
      setFilePending(null)
      setDiffPending(null)
      setImagePending(null)
      setBody('')
    }
  }

  const toggleResolved = async (thread: Thread) => {
    await fetch(`/api/comment-threads/${thread.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolved: !thread.resolved }),
    })
    refreshThreads()
  }

  const submitReply = async (threadId: string) => {
    if (!replyBody.trim() || !devUserId) return
    setReplySubmitting(true)
    try {
      await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId, authorId: devUserId, body: replyBody.trim() }),
      })
      setReplyThreadId(null)
      setReplyBody('')
      refreshThreads()
    } finally {
      setReplySubmitting(false)
    }
  }

  const submitEdit = async (commentId: string) => {
    if (!editBody.trim() || !devUserId) return
    setEditSubmitting(true)
    try {
      await fetch(`/api/comments/${commentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: editBody.trim(), authorId: devUserId }),
      })
      setEditingCommentId(null)
      setEditBody('')
      refreshThreads()
    } finally {
      setEditSubmitting(false)
    }
  }

  const changeStatus = async (thread: Thread, status: ThreadStatus) => {
    const next = thread.status === status ? 'OPEN' : status
    await fetch(`/api/comment-threads/${thread.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
    refreshThreads()
  }

  // ── Scope toggle & thread activation ──────────────────────────────────────

  const switchScope = (next: CommentScope) => {
    setScope(next)
    if (next === 'all') refreshAllThreads()
    else if (fileId) refreshFileThreads(fileId, viewerSha)
  }

  const handleThreadClick = (thread: Thread) => {
    const threadFilePath = thread.anchor?.filePath
    if (shouldNavigateForThread(scope, threadFilePath, currentFilePath)) {
      // Cross-file: open the file first; file-opened activates the thread.
      pendingActivationRef.current = thread.id
      const { projectId, sourceId } = params ?? {}
      if (projectId && sourceId && threadFilePath) {
        router.push(viewerUrlForFile(projectId, sourceId, threadFilePath))
      }
      return
    }
    setActiveThreadId((id) => {
      const next = id === thread.id ? null : thread.id
      if (next) scrollPendingRef.current = true
      return next
    })
  }

  // ── Filter / sort ─────────────────────────────────────────────────────────

  const authors = useMemo(() => {
    const seen = new Map<string, string>()
    for (const t of threads) {
      for (const c of t.comments) {
        if (!seen.has(c.author.id)) seen.set(c.author.id, c.author.name)
      }
    }
    return [...seen.entries()].map(([id, name]) => ({ id, name }))
  }, [threads])

  const visibleThreads = useMemo(() => {
    const filtered = filterThreads(threads, {
      status: statusFilter,
      authorId: authorFilter !== 'all' ? authorFilter : undefined,
    })
    return sortThreads(filtered, sortDir)
  }, [threads, statusFilter, authorFilter, sortDir])

  // ── Render ────────────────────────────────────────────────────────────────

  const isDiffMode = diffCtx !== null

  if (!isDiffMode && !fileId && !filePending && !diffPending) {
    return (
      <div className="p-4">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-3">Comments</h2>
        <p className="text-sm text-zinc-400 italic">Open a file to see its comments.</p>
      </div>
    )
  }

  // Quote shown in the pending composer
  const composerQuote = diffPending
    ? diffPending.selectedText || `${diffPending.diffSide} · lines ${diffPending.lineStart}–${diffPending.lineEnd}`
    : imagePending
    ? `Region on ${imagePending.diffSide}`
    : filePending?.anchor.selectedText ?? null

  return (
    <div data-testid="comment-panel" className="flex flex-col h-full">
      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide">Comments</h2>
          {!isDiffMode && (
            <div className="flex gap-1">
              {(['file', 'all'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  data-testid={`comment-scope-${s}`}
                  onClick={() => switchScope(s)}
                  className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium transition-colors ${
                    scope === s
                      ? 'border-blue-500 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                      : 'border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:border-zinc-400'
                  }`}
                >
                  {s === 'file' ? 'This file' : 'All files'}
                </button>
              ))}
            </div>
          )}
        </div>

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
                  setImagePending(null)
                  setBody('')
                }
              }}
              placeholder="Add a comment…"
              rows={3}
              className="w-full rounded border border-blue-200 dark:border-blue-700 bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setFilePending(null); setDiffPending(null); setImagePending(null); setBody('') }}
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

        {/* Filter / sort toolbar */}
        {threads.length > 0 && (
          <div className="space-y-1.5" data-testid="comment-toolbar">
            <div className="flex gap-1 flex-wrap">
              {(['all', 'open', 'accepted', 'rejected', 'discuss', 'resolved'] as const).map((s) => (
                <button
                  key={s}
                  data-testid={`status-filter-${s}`}
                  onClick={() => setStatusFilter(s)}
                  className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium capitalize transition-colors ${
                    statusFilter === s
                      ? 'border-blue-500 bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                      : 'border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:border-zinc-400'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="flex gap-2 items-center">
              {authors.length > 0 && (
                <select
                  data-testid="author-filter"
                  value={authorFilter}
                  onChange={(e) => setAuthorFilter(e.target.value)}
                  className="flex-1 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-1.5 py-0.5 text-xs focus:outline-none"
                >
                  <option value="all">All authors</option>
                  {authors.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              )}
              <button
                data-testid="sort-toggle"
                onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                className="text-[10px] px-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:border-zinc-400 whitespace-nowrap"
              >
                {sortDir === 'asc' ? 'Oldest first' : 'Newest first'}
              </button>
            </div>
          </div>
        )}

        {/* Thread list */}
        {threads.length === 0 && !pending ? (
          <p className="text-sm text-zinc-400 italic">
            {isDiffMode ? 'Highlight text in the diff, then click Add Comment.' : 'Select text to add a comment.'}
          </p>
        ) : visibleThreads.length === 0 && !pending ? (
          <p className="text-sm text-zinc-400 italic">No threads match the current filters.</p>
        ) : (
          <ul ref={threadListRef} className="space-y-3">
            {visibleThreads.map((thread) => {
              const anchorType = thread.anchor?.type
              const quote = anchorType === 'IMAGE_REGION'
                ? `Region on ${thread.anchor?.diffSide}`
                : thread.anchor?.selectedText
                  ?? (anchorType === 'DIFF_HUNK' && thread.anchor?.lineStart
                    ? `${thread.anchor.diffSide} · lines ${thread.anchor.lineStart}–${thread.anchor.lineEnd ?? thread.anchor.lineStart}`
                    : null)

              return (
                <li
                  key={thread.id}
                  data-testid="comment-thread"
                  data-thread-id={thread.id}
                  onClick={() => handleThreadClick(thread)}
                  className={`rounded-lg border p-3 text-sm cursor-pointer ${
                    thread.resolved
                      ? 'border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 opacity-60'
                      : activeThreadId === thread.id
                      ? 'border-amber-400 bg-amber-50 dark:border-amber-600 dark:bg-amber-950/30'
                      : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'
                  }`}
                >
                  {scope === 'all' && thread.anchor?.filePath && (
                    <div
                      data-testid="thread-file-label"
                      className="mb-1 truncate text-[10px] font-medium text-zinc-400 dark:text-zinc-500"
                    >
                      {thread.anchor.filePath}
                    </div>
                  )}
                  {/* Header row: quote + status badge */}
                  <div className="flex items-start gap-2 mb-2">
                    {quote && (
                      <blockquote className="flex-1 border-l-2 border-zinc-300 pl-2 text-xs text-zinc-500 italic truncate">
                        {quote}
                      </blockquote>
                    )}
                    {thread.status !== 'OPEN' && (
                      <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none ${
                        thread.status === 'ACCEPTED' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                        thread.status === 'REJECTED' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' :
                        'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300'
                      }`}>
                        {thread.status}
                      </span>
                    )}
                  </div>
                  <ul className="space-y-2">
                    {thread.comments.map((c) => (
                      <li key={c.id}>
                        <div className="flex items-baseline gap-2">
                          <span className="font-medium text-zinc-700 dark:text-zinc-300">{c.author.name}</span>
                          <span className="text-[10px] text-zinc-400 dark:text-zinc-500" title={c.editedAt ?? c.createdAt}>
                            {formatCommentDate(c.createdAt)}
                          </span>
                          {c.editedAt && (
                            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 italic" title={c.editedAt}>
                              edited
                            </span>
                          )}
                          {c.author.id === devUserId && editingCommentId !== c.id && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setEditingCommentId(c.id)
                                setEditBody(c.body)
                              }}
                              className="ml-auto text-[10px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                            >
                              Edit
                            </button>
                          )}
                        </div>
                        {editingCommentId === c.id ? (
                          <div className="mt-1 space-y-1">
                            <textarea
                              value={editBody}
                              onChange={(e) => setEditBody(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitEdit(c.id)
                                if (e.key === 'Escape') { setEditingCommentId(null); setEditBody('') }
                              }}
                              rows={2}
                              className="w-full rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
                              autoFocus
                            />
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={(e) => { e.stopPropagation(); setEditingCommentId(null); setEditBody('') }}
                                className="text-xs text-zinc-400 hover:text-zinc-600 px-1"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); submitEdit(c.id) }}
                                disabled={!editBody.trim() || editSubmitting}
                                className="rounded bg-blue-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-40"
                              >
                                {editSubmitting ? 'Saving…' : 'Save'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-zinc-600 dark:text-zinc-400 mt-0.5">{c.body}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                  {/* Reply composer — shown for the active thread */}
                  {activeThreadId === thread.id && (
                    replyThreadId === thread.id ? (
                      <div className="mt-2 space-y-1">
                        <textarea
                          value={replyBody}
                          onChange={(e) => setReplyBody(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitReply(thread.id)
                            if (e.key === 'Escape') { setReplyThreadId(null); setReplyBody('') }
                          }}
                          placeholder="Reply…"
                          rows={2}
                          className="w-full rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
                          autoFocus
                        />
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={(e) => { e.stopPropagation(); setReplyThreadId(null); setReplyBody('') }}
                            className="text-xs text-zinc-400 hover:text-zinc-600 px-1"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); submitReply(thread.id) }}
                            disabled={!replyBody.trim() || replySubmitting}
                            className="rounded bg-blue-600 px-2 py-0.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-40"
                          >
                            {replySubmitting ? 'Saving…' : 'Reply'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); setReplyThreadId(thread.id); setReplyBody('') }}
                        className="mt-2 text-xs text-blue-500 hover:text-blue-700"
                      >
                        Reply
                      </button>
                    )
                  )}
                  {/* Status controls */}
                  <div className="mt-2 flex items-center gap-1 flex-wrap">
                    {(['ACCEPTED', 'REJECTED', 'DISCUSS'] as const).map((s) => (
                      <button
                        key={s}
                        disabled={thread.resolved}
                        onClick={(e) => { e.stopPropagation(); changeStatus(thread, s) }}
                        className={`text-[10px] px-1.5 py-0.5 rounded border font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                          thread.status === s
                            ? s === 'ACCEPTED' ? 'border-green-500 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                              s === 'REJECTED' ? 'border-red-500 bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' :
                              'border-amber-500 bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300'
                            : 'border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:border-zinc-400'
                        }`}
                      >
                        {s === 'ACCEPTED' ? 'Accept' : s === 'REJECTED' ? 'Reject' : 'Discuss'}
                      </button>
                    ))}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleResolved(thread) }}
                      className="ml-auto text-xs text-zinc-400 hover:text-zinc-600 underline"
                    >
                      {thread.resolved ? 'Reopen' : 'Resolve'}
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

    </div>
  )
}
