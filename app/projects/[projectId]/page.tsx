import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import AddGitSourceForm from '@/components/AddGitSourceForm'

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { sources: { orderBy: { createdAt: 'asc' } } },
  })

  if (!project) notFound()

  return (
    <div className="p-8 max-w-2xl">
      <Link href="/" className="text-sm text-zinc-400 hover:text-zinc-600 mb-4 inline-block">
        ← All projects
      </Link>
      <h1 className="text-2xl font-semibold mb-2">{project.name}</h1>
      {project.description && <p className="text-zinc-500 mb-6">{project.description}</p>}

      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400 mb-3">Sources</h2>
      {project.sources.length === 0 ? (
        <p className="text-zinc-500 text-sm">No sources configured.</p>
      ) : (
        <ul data-testid="source-list" className="space-y-2">
          {project.sources.map((source) => (
            <li key={source.id}>
              <Link
                data-testid="source-card"
                href={`/projects/${projectId}/sources/${source.id}`}
                className="block rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                <p className="font-medium">{source.name}</p>
                <p className="text-xs text-zinc-400 mt-1">
                  {source.type} {source.localPath ? `· ${source.localPath}` : ''}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <AddGitSourceForm projectId={projectId} />
    </div>
  )
}
