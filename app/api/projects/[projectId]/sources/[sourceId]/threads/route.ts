import { prisma } from '@/lib/db'
import { listThreadsForSource } from '@/lib/api/threads'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string; sourceId: string }> },
) {
  const { projectId, sourceId } = await params

  const source = await prisma.source.findFirst({ where: { id: sourceId, projectId } })
  if (!source) return Response.json({ error: 'Not found' }, { status: 404 })

  const threads = await listThreadsForSource(sourceId)
  return Response.json({ threads })
}
