import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { getRepoDir } from '@/lib/sources/gitRevisions'
import { cloneOrFetch, listRefs } from '@/lib/sources/gitSource'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string; sourceId: string }> },
) {
  const { projectId, sourceId } = await params
  const source = await prisma.source.findFirst({
    where: { id: sourceId, projectId, type: 'GIT' },
  })
  if (!source) return Response.json({ error: 'Not found' }, { status: 404 })
  if (!source.gitUrl) return Response.json({ error: 'Source has no gitUrl' }, { status: 400 })

  const repoDir = getRepoDir(source.id)
  try {
    await cloneOrFetch(source.gitUrl, repoDir)
    const refs = await listRefs(repoDir)
    return Response.json({ refs })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'git operation failed'
    return Response.json({ error: msg }, { status: 502 })
  }
}
