'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Project {
  id: string
  name: string
}

const LAST_PROJECT_KEY = 'markdown-reviewer:last-project'

export default function NewSourceModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const dialogRef = useRef<HTMLDialogElement>(null)

  const [projects, setProjects] = useState<Project[]>([])
  const [gitUrl, setGitUrl] = useState('')
  const [sourceName, setSourceName] = useState('')
  const [projectId, setProjectId] = useState<string>('')
  const [urlError, setUrlError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch('/api/projects')
      .then((r) => r.json())
      .then((data: Project[]) => {
        setProjects(data)
        const last = localStorage.getItem(LAST_PROJECT_KEY)
        const match = data.find((p) => p.id === last)
        setProjectId(match?.id ?? data[0]?.id ?? '')
      })
      .catch(() => null)
  }, [])

  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    el.showModal()
    const onCancel = (e: Event) => { e.preventDefault(); onClose() }
    el.addEventListener('cancel', onCancel)
    return () => el.removeEventListener('cancel', onCancel)
  }, [onClose])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setUrlError(null)
    setSubmitError(null)

    if (!gitUrl.trim()) {
      setUrlError('Git URL is required')
      return
    }
    if (!projectId) {
      setSubmitError('Select a project')
      return
    }

    setBusy(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gitUrl: gitUrl.trim(),
          ...(sourceName.trim() ? { name: sourceName.trim() } : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSubmitError(data.error ?? 'Failed to add source')
        return
      }
      localStorage.setItem(LAST_PROJECT_KEY, projectId)
      onClose()
      router.push(`/projects/${projectId}/sources/${data.source.id}`)
      router.refresh()
    } catch {
      setSubmitError('Network error — check your connection')
    } finally {
      setBusy(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      data-testid="new-source-modal"
      className="rounded-lg shadow-xl p-0 w-full max-w-md backdrop:bg-black/40"
      onClick={(e) => { if (e.target === dialogRef.current) onClose() }}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">New Source</h2>
          <button
            type="button"
            data-testid="modal-close-btn"
            onClick={onClose}
            aria-label="Close"
            className="text-zinc-400 hover:text-zinc-600 text-lg leading-none"
          >
            ×
          </button>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="git-url" className="text-xs font-medium text-zinc-600">
            Git URL <span className="text-red-500">*</span>
          </label>
          <input
            id="git-url"
            data-testid="git-url-input"
            type="text"
            value={gitUrl}
            onChange={(e) => setGitUrl(e.target.value)}
            placeholder="https://github.com/org/repo.git"
            disabled={busy}
            className="rounded border border-zinc-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          {urlError && (
            <p data-testid="url-error" className="text-xs text-red-500">{urlError}</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="source-name" className="text-xs font-medium text-zinc-600">
            Source name <span className="text-zinc-400">(optional)</span>
          </label>
          <input
            id="source-name"
            data-testid="source-name-input"
            type="text"
            value={sourceName}
            onChange={(e) => setSourceName(e.target.value)}
            placeholder="Inferred from URL"
            disabled={busy}
            className="rounded border border-zinc-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="project-picker" className="text-xs font-medium text-zinc-600">
            Project
          </label>
          <select
            id="project-picker"
            data-testid="project-picker"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            disabled={busy}
            className="rounded border border-zinc-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {submitError && (
          <p data-testid="submit-error" className="text-xs text-red-500">{submitError}</p>
        )}

        <button
          type="submit"
          data-testid="modal-submit-btn"
          disabled={busy}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? 'Adding…' : 'Add Source'}
        </button>
      </form>
    </dialog>
  )
}
