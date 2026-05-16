import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getRepoDir } from '@/lib/sources/gitRevisions'
import { resolveRef, readFile } from '@/lib/sources/gitSource'
import { listChangedFiles, computeFileDiff } from '@/lib/diff/computeDiff'
import { renderMarkdown } from '@/lib/markdown/render'
import CompareClient from '@/components/CompareClient'
import type { DiffHunk } from '@/lib/diff/computeDiff'

interface ActiveFileDiff {
  baseHtml: string | null
  headHtml: string | null
  hunks: DiffHunk[]
  isBinary: boolean
  status: 'added' | 'removed' | 'modified' | 'renamed'
}

export default async function ComparePage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; sourceId: string }>
  searchParams: Promise<{ base?: string; head?: string; path?: string }>
}) {
  const { projectId, sourceId } = await params
  const { base, head, path: activePath } = await searchParams

  const source = await prisma.source.findFirst({
    where: { id: sourceId, projectId, type: 'GIT' },
  })
  if (!source) notFound()

  if (!base || !head) {
    return (
      <CompareClient
        projectId={projectId}
        sourceId={sourceId}
        files={[]}
        baseSha={null}
        headSha={null}
        base={null}
        head={null}
        activePath={null}
        activeFileDiff={null}
      />
    )
  }

  const repoDir = getRepoDir(source.id)

  // Clone (or fetch) on demand so the compare page works on first load.
  if (source.gitUrl) {
    const { cloneOrFetch } = await import('@/lib/sources/gitSource')
    try { await cloneOrFetch(source.gitUrl, repoDir) } catch { /* fetch errors are non-fatal */ }
  }

  let baseSha: string
  let headSha: string
  try {
    ;[baseSha, headSha] = await Promise.all([
      resolveRef(repoDir, base),
      resolveRef(repoDir, head),
    ])
  } catch {
    return <div className="p-8 text-red-500">Failed to resolve refs. Check that both exist.</div>
  }

  const files = await listChangedFiles(repoDir, baseSha, headSha).catch(() => [])

  let activeFileDiff: ActiveFileDiff | null = null

  if (activePath) {
    try {
      const diff = await computeFileDiff(repoDir, baseSha, headSha, activePath)

      let baseHtml: string | null = null
      let headHtml: string | null = null

      if (!diff.isBinary) {
        const renderOpts = { projectId, sourceId, filePath: activePath, includeSourceLines: true }

        if (diff.status !== 'added') {
          try {
            const buf = await readFile(repoDir, baseSha, activePath)
            baseHtml = await renderMarkdown(buf.toString('utf8'), renderOpts)
          } catch { /* file may not exist on base */ }
        }

        if (diff.status !== 'removed') {
          try {
            const buf = await readFile(repoDir, headSha, activePath)
            headHtml = await renderMarkdown(buf.toString('utf8'), renderOpts)
          } catch { /* file may not exist on head */ }
        }
      }

      activeFileDiff = {
        baseHtml,
        headHtml,
        hunks: diff.hunks,
        isBinary: diff.isBinary,
        status: diff.status,
      }
    } catch { /* diff failed — show nothing */ }
  }

  return (
    <CompareClient
      projectId={projectId}
      sourceId={sourceId}
      files={files}
      baseSha={baseSha}
      headSha={headSha}
      base={base}
      head={head}
      activePath={activePath ?? null}
      activeFileDiff={activeFileDiff}
    />
  )
}
