'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams, usePathname } from 'next/navigation'
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

function TreeNodes({
  nodes,
  projectId,
  sourceId,
  currentPath,
  ref,
  depth,
}: {
  nodes: TreeNode[]
  projectId: string
  sourceId: string
  currentPath: string | null
  ref: string | null
  depth: number
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
              />
            </>
          ) : (
            <Link
              href={`/projects/${projectId}/sources/${sourceId}?path=${encodeURIComponent(node.path)}${ref ? `&ref=${encodeURIComponent(ref)}` : ''}`}
              className={`block truncate rounded px-2 py-0.5 text-sm ${
                currentPath === node.path
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                  : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
              }`}
            >
              {node.name}
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
  const pathname = usePathname()
  const [refs, setRefs] = useState<RefInfo[]>([])

  useEffect(() => {
    fetch(`/api/projects/${projectId}/sources/${sourceId}/refs`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setRefs(data?.refs ?? []))
      .catch(() => {})
  }, [projectId, sourceId])

  if (refs.length === 0) return null

  const value = currentRef ?? refs[0]?.name ?? ''
  const isCompare = pathname?.includes('/compare')

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams?.toString() ?? '')
    params.set('ref', e.target.value)
    router.replace(`/projects/${projectId}/sources/${sourceId}?${params.toString()}`)
  }

  return (
    <div className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-700 space-y-1.5">
      {!isCompare && (
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
      )}
      <div className="flex gap-2 text-xs">
        <Link
          href={`/projects/${projectId}/sources/${sourceId}${currentRef ? `?ref=${encodeURIComponent(currentRef)}` : ''}`}
          className={`flex-1 text-center rounded py-0.5 ${!isCompare ? 'bg-zinc-100 dark:bg-zinc-800 font-medium' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
        >
          View
        </Link>
        <Link
          href={`/projects/${projectId}/sources/${sourceId}/compare`}
          className={`flex-1 text-center rounded py-0.5 ${isCompare ? 'bg-zinc-100 dark:bg-zinc-800 font-medium' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
        >
          Compare
        </Link>
      </div>
    </div>
  )
}

export default function FileTree() {
  const params = useParams<{ projectId: string; sourceId: string }>()
  const searchParams = useSearchParams()
  const [files, setFiles] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

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
        />
      </nav>
    </div>
  )
}
