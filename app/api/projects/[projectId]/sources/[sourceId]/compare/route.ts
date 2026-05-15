import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getRepoDir } from '@/lib/sources/gitRevisions'
import { resolveRef } from '@/lib/sources/gitSource'
import { listChangedFiles } from '@/lib/diff/computeDiff'

const querySchema = z.object({
  base: z.string().min(1),
  head: z.string().min(1),
})

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; sourceId: string }> },
) {
  const { projectId, sourceId } = await params

  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return Response.json({ error: 'base and head query params are required' }, { status: 400 })
  }

  const source = await prisma.source.findFirst({
    where: { id: sourceId, projectId, type: 'GIT' },
  })
  if (!source) return Response.json({ error: 'Not found' }, { status: 404 })

  const repoDir = getRepoDir(source.id)
  try {
    const [baseSha, headSha] = await Promise.all([
      resolveRef(repoDir, parsed.data.base),
      resolveRef(repoDir, parsed.data.head),
    ])
    const files = await listChangedFiles(repoDir, baseSha, headSha)
    return Response.json({ baseSha, headSha, files })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'git operation failed'
    return Response.json({ error: msg }, { status: 502 })
  }
}
