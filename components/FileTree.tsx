'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { getReviewedMap, type ReviewedEntry } from '@/lib/review/reviewedFiles'

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
  currentSha,
  depth,
  threadCounts,
  reviewedMap,
}: {
  nodes: TreeNode[]
  projectId: string
  sourceId: string
  currentPath: string | null
  ref: string | null
  currentSha: string | null
  depth: number
  threadCounts: Record<string, ThreadCounts>
  reviewedMap: Map<string, ReviewedEntry>
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
                currentSha={currentSha}
                depth={depth + 1}
                threadCounts={threadCounts}
                reviewedMap={reviewedMap}
              />
            </>
          ) : (() => {
            const reviewed = reviewedMap.get(node.path)
            const isStale = reviewed && currentSha && reviewed.sha && reviewed.sha !== currentSha
            const isReviewed = !!reviewed && !isStale
            return (
              <Link
                href={`/projects/${projectId}/sources/${sourceId}?path=${encodeURIComponent(node.path)}${ref ? `&ref=${encodeURIComponent(ref)}` : ''}`}
                className={`flex items-center gap-1 truncate rounded px-2 py-0.5 text-sm ${
                  currentPath === node.path
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                    : isReviewed
                    ? 'text-zinc-400 hover:bg-zinc-100 dark:text-zinc-600 dark:hover:bg-zinc-800'
                    : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
                }`}
              >
                {isReviewed && <span className="shrink-0 text-green-500 text-xs" title="Reviewed">✓</span>}
                {isStale && <span className="shrink-0 text-amber-400 text-xs" title="Changed since reviewed">⚠</span>}
                <span className={`truncate ${isReviewed ? 'line-through decoration-zinc-300' : ''}`}>
                  {node.name}
                </span>
                <CommentBadge counts={threadCounts[node.path]} />
              </Link>
            )
          })()}
        </li>
      ))}
    </ul>
  )
}

function RefPicker({
  refs,
  currentRef,
  onChange,
}: {
  refs: RefInfo[]
  currentRef: string | null
  onChange: (ref: string) => void
}) {
  if (refs.length === 0) return null
  const value = currentRef ?? refs[0]?.name ?? ''
  return (
    <div className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-700 space-y-1.5">
      <select
        data-testid="ref-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
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
  const router = useRouter()
  const [files, setFiles] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [refs, setRefs] = useState<RefInfo[]>([])
  const [threadCounts, setThreadCounts] = useState<Record<string, ThreadCounts>>({})
  const [reviewedMap, setReviewedMap] = useState<Map<string, ReviewedEntry>>(new Map())

  const projectId = params?.projectId
  const sourceId = params?.sourceId
  const currentPath = searchParams?.get('path') ?? null
  const ref = searchParams?.get('ref') ?? null

  // Resolve current ref to its SHA for filtering DIFF_HUNK thread counts
  const currentSha = refs.find((r) => r.name === ref)?.sha ?? null

  useEffect(() => {
    if (!projectId || !sourceId) return
    fetch(`/api/projects/${projectId}/sources/${sourceId}/refs`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { refs?: RefInfo[] } | null) => setRefs(data?.refs ?? []))
      .catch(() => {})
  }, [projectId, sourceId])

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
    const p = new URLSearchParams()
    if (currentSha) p.set('sha', currentSha)
    fetch(`/api/projects/${projectId}/sources/${sourceId}/thread-counts?${p}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { counts?: Record<string, ThreadCounts> } | null) => {
        if (data?.counts) setThreadCounts(data.counts)
      })
      .catch(() => {})
  }, [projectId, sourceId, currentSha])

  useEffect(() => { fetchCounts() }, [fetchCounts])

  useEffect(() => {
    const handler = () => fetchCounts()
    window.addEventListener('threads-updated', handler)
    return () => window.removeEventListener('threads-updated', handler)
  }, [fetchCounts])

  useEffect(() => {
    if (!sourceId) return
    setReviewedMap(getReviewedMap(sourceId))
  }, [sourceId])

  useEffect(() => {
    if (!sourceId) return
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ sourceId: string }>).detail
      if (detail.sourceId === sourceId) setReviewedMap(getReviewedMap(sourceId))
    }
    window.addEventListener('reviewed-files-updated', handler)
    return () => window.removeEventListener('reviewed-files-updated', handler)
  }, [sourceId])

  const handleRefChange = useCallback((newRef: string) => {
    const p = new URLSearchParams(searchParams?.toString() ?? '')
    p.set('ref', newRef)
    router.replace(`/projects/${projectId}/sources/${sourceId}?${p.toString()}`)
  }, [router, searchParams, projectId, sourceId])

  if (!projectId || !sourceId) return null
  if (error) return <p className="p-4 text-sm text-red-500">{error}</p>

  const tree = buildTree(files)

  return (
    <div>
      <RefPicker refs={refs} currentRef={ref} onChange={handleRefChange} />
      <nav className="p-3" aria-label="File tree">
        <TreeNodes
          nodes={tree}
          projectId={projectId}
          sourceId={sourceId}
          currentPath={currentPath}
          ref={ref}
          currentSha={currentSha}
          depth={0}
          threadCounts={threadCounts}
          reviewedMap={reviewedMap}
        />
      </nav>
    </div>
  )
}
