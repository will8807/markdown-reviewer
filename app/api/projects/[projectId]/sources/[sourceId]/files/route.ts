import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { read } from '@/lib/sources/localSource'
import { getRepoDir } from '@/lib/sources/gitRevisions'
import { resolveRef, readFile } from '@/lib/sources/gitSource'

const querySchema = z.object({ path: z.string().min(1) })

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; sourceId: string }> },
) {
  const { projectId, sourceId } = await params

  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return Response.json({ error: 'Missing path query parameter' }, { status: 400 })
  }

  const source = await prisma.source.findFirst({ where: { id: sourceId, projectId } })
  if (!source) return Response.json({ error: 'Not found' }, { status: 404 })

  if (source.type === 'GIT') {
    const ref = req.nextUrl.searchParams.get('ref') ?? 'HEAD'
    const repoDir = getRepoDir(source.id)
    try {
      const sha = await resolveRef(repoDir, ref)
      const buf = await readFile(repoDir, sha, parsed.data.path)
      return Response.json({ path: parsed.data.path, content: buf.toString('utf8') })
    } catch (err: unknown) {
      if (err instanceof Error && /path traversal/i.test(err.message)) {
        return Response.json({ error: 'Forbidden' }, { status: 400 })
      }
      return Response.json({ error: 'Not found' }, { status: 404 })
    }
  }

  if (!source.localPath) {
    return Response.json({ error: 'Source has no local path' }, { status: 400 })
  }
  try {
    const content = await read(source.localPath, parsed.data.path)
    return Response.json({ path: parsed.data.path, content })
  } catch (err: unknown) {
    if (err instanceof Error && /path traversal/i.test(err.message)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }
    return Response.json({ error: 'Not found' }, { status: 404 })
  }
}
