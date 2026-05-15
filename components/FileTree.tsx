'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'

interface TreeNode {
  name: string
  path: string
  children?: TreeNode[]
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
  depth,
}: {
  nodes: TreeNode[]
  projectId: string
  sourceId: string
  currentPath: string | null
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
                depth={depth + 1}
              />
            </>
          ) : (
            <Link
              href={`/projects/${projectId}/sources/${sourceId}?path=${encodeURIComponent(node.path)}`}
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

export default function FileTree() {
  const params = useParams<{ projectId: string; sourceId: string }>()
  const searchParams = useSearchParams()
  const [files, setFiles] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  const projectId = params?.projectId
  const sourceId = params?.sourceId
  const currentPath = searchParams?.get('path') ?? null

  useEffect(() => {
    if (!projectId || !sourceId) return
    fetch(`/api/projects/${projectId}/sources/${sourceId}/tree`)
      .then((r) => r.json())
      .then((data: { files?: string[]; error?: string }) => {
        if (data.error) setError(data.error)
        else setFiles(data.files ?? [])
      })
      .catch(() => setError('Failed to load file tree'))
  }, [projectId, sourceId])

  if (!projectId || !sourceId) return null
  if (error) return <p className="p-4 text-sm text-red-500">{error}</p>

  const tree = buildTree(files)

  return (
    <nav className="p-3" aria-label="File tree">
      <TreeNodes
        nodes={tree}
        projectId={projectId}
        sourceId={sourceId}
        currentPath={currentPath}
        depth={0}
      />
    </nav>
  )
}
