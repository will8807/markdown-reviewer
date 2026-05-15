import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { scan } from '@/lib/sources/localSource'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string; sourceId: string }> }
) {
  const { projectId, sourceId } = await params

  const source = await prisma.source.findFirst({ where: { id: sourceId, projectId } })
  if (!source) return Response.json({ error: 'Not found' }, { status: 404 })
  if (source.type !== 'LOCAL' || !source.localPath) {
    return Response.json({ error: 'Source has no local path' }, { status: 400 })
  }

  const files = await scan(source.localPath)
  return Response.json({ files })
}
