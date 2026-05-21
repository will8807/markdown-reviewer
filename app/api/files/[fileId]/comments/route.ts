import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { listThreadsForFile } from '@/lib/api/threads'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const { fileId } = await params
  const viewerSha = req.nextUrl.searchParams.get('sha') ?? undefined

  // Look up the FileEntry so we can also include compare-mode threads (fileId
  // = null) that share the same source + file path.
  const file = await prisma.fileEntry.findUnique({ where: { id: fileId } })
  const allThreads = await listThreadsForFile(
    fileId,
    file ? { sourceId: file.sourceId, filePath: file.path } : undefined,
  )

  // When the viewer is browsing a specific SHA, exclude DIFF_HUNK threads
  // whose relevant side does not match — otherwise comments from diffs on
  // other branches bleed through.
  const threads = viewerSha
    ? allThreads.filter((t) => {
        if (t.anchor?.type !== 'DIFF_HUNK') return true
        const [baseSha, headSha] = (t.anchor.hunkId ?? '').split(':')
        const relevantSha = t.anchor.diffSide === 'head' ? headSha : baseSha
        return relevantSha === viewerSha
      })
    : allThreads

  return Response.json({ threads })
}
