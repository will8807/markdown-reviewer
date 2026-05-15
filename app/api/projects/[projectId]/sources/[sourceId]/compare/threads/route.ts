import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { listThreadsForDiff } from '@/lib/api/threads'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; sourceId: string }> },
) {
  const { projectId, sourceId } = await params
  const base = req.nextUrl.searchParams.get('base')
  const head = req.nextUrl.searchParams.get('head')
  const path = req.nextUrl.searchParams.get('path')

  if (!base || !head || !path) {
    return Response.json({ error: 'base, head, and path are required' }, { status: 400 })
  }

  const source = await prisma.source.findFirst({ where: { id: sourceId, projectId } })
  if (!source) return Response.json({ error: 'Not found' }, { status: 404 })

  const threads = await listThreadsForDiff(sourceId, path, base, head)
  return Response.json({ threads })
}
