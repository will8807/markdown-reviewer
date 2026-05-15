import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { scan } from '@/lib/sources/localSource'
import { getRepoDir } from '@/lib/sources/gitRevisions'
import { resolveRef, scanTree } from '@/lib/sources/gitSource'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; sourceId: string }> },
) {
  const { projectId, sourceId } = await params

  const source = await prisma.source.findFirst({ where: { id: sourceId, projectId } })
  if (!source) return Response.json({ error: 'Not found' }, { status: 404 })

  if (source.type === 'GIT') {
    const ref = req.nextUrl.searchParams.get('ref') ?? 'HEAD'
    const repoDir = getRepoDir(source.id)
    try {
      const sha = await resolveRef(repoDir, ref)
      const files = await scanTree(repoDir, sha)
      return Response.json({ files })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'git error'
      return Response.json({ error: msg }, { status: 502 })
    }
  }

  if (!source.localPath) {
    return Response.json({ error: 'Source has no local path' }, { status: 400 })
  }
  const files = await scan(source.localPath)
  return Response.json({ files })
}
