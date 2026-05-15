import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { upsertRevision } from '@/lib/sources/gitRevisions'

const bodySchema = z.object({ ref: z.string().min(1) })

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; sourceId: string }> },
) {
  const { projectId, sourceId } = await params
  const source = await prisma.source.findFirst({
    where: { id: sourceId, projectId, type: 'GIT' },
  })
  if (!source) return Response.json({ error: 'Not found' }, { status: 404 })
  if (!source.gitUrl) return Response.json({ error: 'Source has no gitUrl' }, { status: 400 })

  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  try {
    const revision = await upsertRevision(source.id, source.gitUrl, parsed.data.ref)
    return Response.json({ revision }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'git operation failed'
    return Response.json({ error: msg }, { status: 502 })
  }
}
