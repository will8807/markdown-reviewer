import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; sourceId: string }> },
) {
  const { projectId, sourceId } = await params

  const source = await prisma.source.findFirst({ where: { id: sourceId, projectId } })
  if (!source) return Response.json({ error: 'Not found' }, { status: 404 })

  // Optional: scope to a specific diff by baseSha+headSha
  const base = req.nextUrl.searchParams.get('base')
  const head = req.nextUrl.searchParams.get('head')
  const hunkId = base && head ? `${base}:${head}` : undefined

  const threads = await prisma.commentThread.findMany({
    where: {
      sourceId,
      ...(hunkId ? { anchor: { hunkId } } : {}),
    },
    select: { resolved: true, anchor: { select: { filePath: true } } },
  })

  const counts: Record<string, { open: number; resolved: number }> = {}
  for (const thread of threads) {
    const path = thread.anchor?.filePath
    if (!path) continue
    if (!counts[path]) counts[path] = { open: 0, resolved: 0 }
    if (thread.resolved) counts[path].resolved++
    else counts[path].open++
  }

  return Response.json({ counts })
}
