'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AddGitSourceForm({ projectId }: { projectId: string }) {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim()) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/sources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gitUrl: url.trim() }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to add source')
        return
      }
      setUrl('')
      router.refresh()
    } catch {
      setError('Network error — check your connection')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
        Add Git Source
      </h2>
      <div className="flex gap-2">
        <input
          data-testid="git-url-input"
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://github.com/org/repo.git"
          disabled={busy}
          className="flex-1 rounded border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={busy || !url.trim()}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? 'Adding…' : 'Add Git Source'}
        </button>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </form>
  )
}
