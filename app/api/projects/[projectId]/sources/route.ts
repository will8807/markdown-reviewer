import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getRepoDir } from '@/lib/sources/gitRevisions'
import { cloneOrFetch } from '@/lib/sources/gitSource'

const bodySchema = z.object({
  gitUrl: z.string().min(1),
  name: z.string().min(1).optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params
  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!project) return Response.json({ error: 'Project not found' }, { status: 404 })

  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { gitUrl, name } = parsed.data
  const sourceName = name ?? gitUrl.split('/').pop()?.replace(/\.git$/, '') ?? gitUrl

  // Attempt the clone before persisting — if unreachable, fail without creating a row
  const tempId = `tmp-${Date.now()}`
  const repoDir = getRepoDir(tempId)
  try {
    await cloneOrFetch(gitUrl, repoDir)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'git clone failed'
    return Response.json({ error: `Repository unreachable: ${msg}` }, { status: 502 })
  }

  const source = await prisma.source.create({
    data: { projectId, type: 'GIT', name: sourceName, gitUrl },
  })

  // Move the temp clone to the correct location
  const finalDir = getRepoDir(source.id)
  const { renameSync } = await import('fs')
  try {
    renameSync(repoDir, finalDir)
  } catch {
    // Directory already exists (race) — the fetch via /refs will handle it
  }

  return Response.json({ source }, { status: 201 })
}
