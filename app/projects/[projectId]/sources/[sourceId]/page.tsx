import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { read } from '@/lib/sources/localSource'
import { getRepoDir } from '@/lib/sources/gitRevisions'
import { cloneOrFetch, resolveRef, readFile } from '@/lib/sources/gitSource'
import { renderMarkdown } from '@/lib/markdown/render'
import { isMarkdownPath } from '@/lib/files/fileType'
import ViewerClient from '@/components/ViewerClient'
import CodeListingClient from '@/components/CodeListingClient'

async function ensureFileEntry(sourceId: string, filePath: string): Promise<string> {
  const existing = await prisma.fileEntry.findUnique({
    where: { sourceId_path: { sourceId, path: filePath } },
  })
  if (existing) return existing.id
  const created = await prisma.fileEntry.create({ data: { sourceId, path: filePath } })
  return created.id
}

export default async function ViewerPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; sourceId: string }>
  searchParams: Promise<{ path?: string; ref?: string }>
}) {
  const { projectId, sourceId } = await params
  const { path: filePath, ref } = await searchParams

  const source = await prisma.source.findFirst({
    where: { id: sourceId, projectId },
    include: { project: { select: { name: true } } },
  })
  if (!source) notFound()

  if (!filePath) {
    return (
      <div className="p-8 text-zinc-500">
        <p>Select a file from the tree to begin.</p>
      </div>
    )
  }

  let content: string
  let resolvedSha: string | null = null
  try {
    if (source.type === 'GIT') {
      const repoDir = getRepoDir(source.id)
      if (source.gitUrl) await cloneOrFetch(source.gitUrl, repoDir)
      resolvedSha = await resolveRef(repoDir, ref ?? 'HEAD')
      const buf = await readFile(repoDir, resolvedSha, filePath)
      content = buf.toString('utf8')
    } else {
      content = await read(source.localPath!, filePath)
    }
  } catch (err: unknown) {
    if (err instanceof Error && /path traversal/i.test(err.message)) {
      return <div className="p-8 text-red-500">Access denied.</div>
    }
    return (
      <div className="p-8 text-zinc-500">
        <p className="font-medium text-zinc-700 mb-1">File not found</p>
        <p className="text-sm font-mono">{filePath}</p>
      </div>
    )
  }

  let fileId: string | null = null
  try {
    fileId = await ensureFileEntry(sourceId, filePath)
  } catch {
    // DB not available — comments disabled
  }

  const sourceName = source.name
  const projectName = source.project.name

  if (!isMarkdownPath(filePath)) {
    return (
      <CodeListingClient
        content={content}
        filePath={filePath}
        fileId={fileId}
        sha={resolvedSha}
        sourceName={sourceName}
        projectId={projectId}
        projectName={projectName}
      />
    )
  }

  const html = await renderMarkdown(content, { projectId, sourceId, filePath })

  return (
    <ViewerClient
      html={html}
      sourceContent={content}
      filePath={filePath}
      fileId={fileId}
      sha={resolvedSha}
      sourceName={sourceName}
      projectId={projectId}
      projectName={projectName}
    />
  )
}
