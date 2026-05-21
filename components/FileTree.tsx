'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

interface TreeNode {
  name: string
  path: string
  children?: TreeNode[]
}

interface RefInfo {
  name: string
  sha: string
  type: 'branch' | 'tag'
}

interface ThreadCounts {
  open: number
  resolved: number
}

function buildTree(files: string[]): TreeNode[] {
  const root: TreeNode[] = []

  for (const file of files.sort()) {
    const parts = file.split('/')
    let nodes = root

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const fullPath = parts.slice(0, i + 1).join('/')
      const isFile = i === parts.length - 1

      let node = nodes.find((n) => n.name === part)
      if (!node) {
        node = { name: part, path: fullPath, children: isFile ? undefined : [] }
        nodes.push(node)
      }
      if (!isFile) nodes = node.children!
    }
  }

  return root
}

function CommentBadge({ counts }: { counts: ThreadCounts | undefined }) {
  if (!counts || (counts.open === 0 && counts.resolved === 0)) return null
  return (
    <span className="ml-auto flex items-center gap-1 shrink-0">
      {counts.open > 0 && (
        <span
          title={`${counts.open} open comment${counts.open === 1 ? '' : 's'}`}
          className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
        >
          {counts.open}
        </span>
      )}
      {counts.resolved > 0 && (
        <span
          title={`${counts.resolved} resolved`}
          className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-semibold bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
        >
          ✓{counts.resolved}
        </span>
      )}
    </span>
  )
}

function TreeNodes({
  nodes,
  projectId,
  sourceId,
  currentPath,
  ref,
  depth,
  threadCounts,
}: {
  nodes: TreeNode[]
  projectId: string
  sourceId: string
  currentPath: string | null
  ref: string | null
  depth: number
  threadCounts: Record<string, ThreadCounts>
}) {
  return (
    <ul className="space-y-0.5">
      {nodes.map((node) => (
        <li key={node.path} style={{ paddingLeft: depth * 12 }}>
          {node.children ? (
            <>
              <span className="block py-0.5 text-xs font-semibold uppercase tracking-wide text-zinc-400 select-none">
                {node.name}
              </span>
              <TreeNodes
                nodes={node.children}
                projectId={projectId}
                sourceId={sourceId}
                currentPath={currentPath}
                ref={ref}
                depth={depth + 1}
                threadCounts={threadCounts}
              />
            </>
          ) : (
            <Link
              href={`/projects/${projectId}/sources/${sourceId}?path=${encodeURIComponent(node.path)}${ref ? `&ref=${encodeURIComponent(ref)}` : ''}`}
              className={`flex items-center gap-1 truncate rounded px-2 py-0.5 text-sm ${
                currentPath === node.path
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                  : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
              }`}
            >
              <span className="truncate">{node.name}</span>
              <CommentBadge counts={threadCounts[node.path]} />
            </Link>
          )}
        </li>
      ))}
    </ul>
  )
}

function RefPicker({
  projectId,
  sourceId,
  currentRef,
}: {
  projectId: string
  sourceId: string
  currentRef: string | null
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [refs, setRefs] = useState<RefInfo[]>([])

  useEffect(() => {
    fetch(`/api/projects/${projectId}/sources/${sourceId}/refs`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setRefs(data?.refs ?? []))
      .catch(() => {})
  }, [projectId, sourceId])

  if (refs.length === 0) return null

  const value = currentRef ?? refs[0]?.name ?? ''
  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams?.toString() ?? '')
    params.set('ref', e.target.value)
    router.replace(`/projects/${projectId}/sources/${sourceId}?${params.toString()}`)
  }

  return (
    <div className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-700 space-y-1.5">
      <select
        data-testid="ref-select"
        value={value}
        onChange={handleChange}
        className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        {refs.map((r) => (
          <option key={r.name} value={r.name}>
            {r.name}
          </option>
        ))}
      </select>
    </div>
  )
}

export default function FileTree() {
  const params = useParams<{ projectId: string; sourceId: string }>()
  const searchParams = useSearchParams()
  const [files, setFiles] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [threadCounts, setThreadCounts] = useState<Record<string, ThreadCounts>>({})

  const projectId = params?.projectId
  const sourceId = params?.sourceId
  const currentPath = searchParams?.get('path') ?? null
  const ref = searchParams?.get('ref') ?? null

  useEffect(() => {
    if (!projectId || !sourceId) return
    const url = `/api/projects/${projectId}/sources/${sourceId}/tree${ref ? `?ref=${encodeURIComponent(ref)}` : ''}`
    fetch(url)
      .then((r) => r.json())
      .then((data: { files?: string[]; error?: string }) => {
        if (data.error) setError(data.error)
        else setFiles(data.files ?? [])
      })
      .catch(() => setError('Failed to load file tree'))
  }, [projectId, sourceId, ref])

  const fetchCounts = useCallback(() => {
    if (!projectId || !sourceId) return
    fetch(`/api/projects/${projectId}/sources/${sourceId}/thread-counts`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { counts?: Record<string, ThreadCounts> } | null) => {
        if (data?.counts) setThreadCounts(data.counts)
      })
      .catch(() => {})
  }, [projectId, sourceId])

  useEffect(() => {
    fetchCounts()
  }, [fetchCounts])

  // Refresh counts whenever threads change (CommentPanel broadcasts this)
  useEffect(() => {
    const handler = () => fetchCounts()
    window.addEventListener('threads-updated', handler)
    return () => window.removeEventListener('threads-updated', handler)
  }, [fetchCounts])

  if (!projectId || !sourceId) return null
  if (error) return <p className="p-4 text-sm text-red-500">{error}</p>

  const tree = buildTree(files)

  return (
    <div>
      <RefPicker projectId={projectId} sourceId={sourceId} currentRef={ref} />
      <nav className="p-3" aria-label="File tree">
        <TreeNodes
          nodes={tree}
          projectId={projectId}
          sourceId={sourceId}
          currentPath={currentPath}
          ref={ref}
          depth={0}
          threadCounts={threadCounts}
        />
      </nav>
    </div>
  )
}
