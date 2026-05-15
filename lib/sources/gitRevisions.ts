import path from 'path'
import { prisma } from '@/lib/db'
import { cloneOrFetch, resolveRef, scanTree } from './gitSource'

export function getRepoDir(sourceId: string): string {
  return path.resolve(process.cwd(), '.data', 'git', sourceId)
}

export async function upsertRevision(
  sourceId: string,
  gitUrl: string,
  ref: string,
): Promise<{ id: string; sha: string }> {
  const repoDir = getRepoDir(sourceId)
  await cloneOrFetch(gitUrl, repoDir)
  const sha = await resolveRef(repoDir, ref)

  let revision = await prisma.sourceRevision.findFirst({ where: { sourceId, sha } })
  if (!revision) {
    revision = await prisma.sourceRevision.create({ data: { sourceId, sha } })
  }

  const filePaths = await scanTree(repoDir, sha)
  await Promise.all(
    filePaths.map((fp) =>
      prisma.fileEntry.upsert({
        where: { sourceId_path: { sourceId, path: fp } },
        update: {},
        create: { sourceId, path: fp },
      }),
    ),
  )

  return { id: revision.id, sha: revision.sha! }
}
