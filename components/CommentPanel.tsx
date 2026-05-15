'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'

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
  anchor: {
    selectedText: string | null
    filePath: string
  } | null
  comments: Comment[]
}

export default function CommentPanel() {
  const params = useParams<{ projectId: string; sourceId: string }>()
  const searchParams = useSearchParams()
  const [threads, setThreads] = useState<Thread[]>([])
  const [fileId, setFileId] = useState<string | null>(null)

  const filePath = searchParams?.get('path')
  const projectId = params?.projectId
  const sourceId = params?.sourceId

  // Resolve fileId from the source + path
  useEffect(() => {
    if (!projectId || !sourceId || !filePath) {
      setThreads([])
      setFileId(null)
      return
    }
    fetch(`/api/projects/${projectId}/sources/${sourceId}/tree`)
      .then((r) => r.json())
      .then(() => {
        // FileEntry lookup via a dedicated endpoint isn't wired yet;
        // we'll discover fileId from the comment-thread response instead.
        // For now, skip and wait for thread creation to supply fileId.
      })
      .catch(() => null)
  }, [projectId, sourceId, filePath])

  const refresh = useCallback(
    (fid: string) => {
      setFileId(fid)
      fetch(`/api/files/${fid}/comments`)
        .then((r) => r.json())
        .then((data: { threads: Thread[] }) => setThreads(data.threads ?? []))
        .catch(() => null)
    },
    []
  )

  // Expose refresh so SelectionPopover can trigger it after creating a thread
  useEffect(() => {
    function handler(e: Event) {
      const detail = (e as CustomEvent<{ fileId: string }>).detail
      if (detail?.fileId) refresh(detail.fileId)
    }
    window.addEventListener('thread-created', handler)
    return () => window.removeEventListener('thread-created', handler)
  }, [refresh])

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
    <div className="p-4">
      <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-3">Comments</h2>
      {threads.length === 0 ? (
        <p className="text-sm text-zinc-400 italic">Select text to add a comment.</p>
      ) : (
        <ul className="space-y-4">
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
                    <p className="text-zinc-600 dark:text-zinc-400">{c.body}</p>
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
