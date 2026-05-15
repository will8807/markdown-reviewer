import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { read } from '@/lib/sources/localSource'
import { renderMarkdown } from '@/lib/markdown/render'
import MarkdownViewer from '@/components/MarkdownViewer'

export default async function ViewerPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; sourceId: string }>
  searchParams: Promise<{ path?: string }>
}) {
  const { projectId, sourceId } = await params
  const { path: filePath } = await searchParams

  const source = await prisma.source.findFirst({
    where: { id: sourceId, projectId },
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
  try {
    content = await read(source.localPath!, filePath)
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

  const html = await renderMarkdown(content, { projectId, sourceId, filePath })

  return <MarkdownViewer html={html} />
}
