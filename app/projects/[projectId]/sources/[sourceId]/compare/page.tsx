import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getRepoDir } from '@/lib/sources/gitRevisions'
import { resolveRef } from '@/lib/sources/gitSource'
import { listChangedFiles } from '@/lib/diff/computeDiff'
import CompareClient from '@/components/CompareClient'

export default async function ComparePage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; sourceId: string }>
  searchParams: Promise<{ base?: string; head?: string; path?: string }>
}) {
  const { projectId, sourceId } = await params
  const { base, head, path: activePath } = await searchParams

  const source = await prisma.source.findFirst({
    where: { id: sourceId, projectId, type: 'GIT' },
  })
  if (!source) notFound()

  if (!base || !head) {
    return (
      <CompareClient
        projectId={projectId}
        sourceId={sourceId}
        files={[]}
        baseSha={null}
        headSha={null}
        base={null}
        head={null}
        activePath={null}
      />
    )
  }

  const repoDir = getRepoDir(source.id)
  try {
    const [baseSha, headSha] = await Promise.all([
      resolveRef(repoDir, base),
      resolveRef(repoDir, head),
    ])
    const files = await listChangedFiles(repoDir, baseSha, headSha)
    return (
      <CompareClient
        projectId={projectId}
        sourceId={sourceId}
        files={files}
        baseSha={baseSha}
        headSha={headSha}
        base={base}
        head={head}
        activePath={activePath ?? null}
      />
    )
  } catch {
    return <div className="p-8 text-red-500">Failed to compute diff. Check that both refs exist.</div>
  }
}
