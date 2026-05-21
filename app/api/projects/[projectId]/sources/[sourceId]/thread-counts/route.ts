import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; sourceId: string }> },
) {
  const { projectId, sourceId } = await params

  const source = await prisma.source.findFirst({ where: { id: sourceId, projectId } })
  if (!source) return Response.json({ error: 'Not found' }, { status: 404 })

  // Viewer mode: optional SHA of the ref currently being browsed.
  // When provided, DIFF_HUNK threads are only counted when the SHA matches
  // the side of the hunk the comment was made on.
  const viewerSha = req.nextUrl.searchParams.get('sha') ?? undefined

  // Compare mode: scope to a specific diff by baseSha+headSha.
  const base = req.nextUrl.searchParams.get('base')
  const head = req.nextUrl.searchParams.get('head')
  const hunkId = base && head ? `${base}:${head}` : undefined

  const threads = await prisma.commentThread.findMany({
    where: {
      sourceId,
      ...(hunkId ? { anchor: { hunkId } } : {}),
    },
    select: {
      resolved: true,
      anchor: { select: { filePath: true, type: true, hunkId: true, diffSide: true } },
    },
  })

  const counts: Record<string, { open: number; resolved: number }> = {}
  for (const thread of threads) {
    const anchor = thread.anchor
    if (!anchor?.filePath) continue

    // In viewer mode, skip DIFF_HUNK threads that belong to a different ref.
    if (viewerSha && anchor.type === 'DIFF_HUNK') {
      const [baseSha, headSha] = (anchor.hunkId ?? '').split(':')
      const relevantSha = anchor.diffSide === 'head' ? headSha : baseSha
      if (relevantSha !== viewerSha) continue
    }

    const path = anchor.filePath
    if (!counts[path]) counts[path] = { open: 0, resolved: 0 }
    if (thread.resolved) counts[path].resolved++
    else counts[path].open++
  }

  return Response.json({ counts })
}
