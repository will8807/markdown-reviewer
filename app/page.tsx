import Link from 'next/link'
import { prisma } from '@/lib/db'

async function getProjects() {
  try {
    return await prisma.project.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { sources: true } } },
    })
  } catch {
    return null
  }
}

export default async function Home() {
  const projects = await getProjects()

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-semibold mb-6">Projects</h1>
      {projects === null ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-medium">Database not connected</p>
          <p className="mt-1">Start the database and ensure <code>DATABASE_URL</code> is set in <code>.env</code>.</p>
          <pre className="mt-2 text-xs font-mono">cp .env.example .env && docker-compose up -d</pre>
        </div>
      ) : projects.length === 0 ? (
        <p className="text-zinc-500">No projects yet. Run <code>npm run db:seed</code> to create demo data.</p>
      ) : (
        <ul className="space-y-3">
          {projects.map((project) => (
            <li key={project.id}>
              <Link
                href={`/projects/${project.id}`}
                className="block rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                <p className="font-medium">{project.name}</p>
                {project.description && (
                  <p className="text-sm text-zinc-500 mt-1">{project.description}</p>
                )}
                <p className="text-xs text-zinc-400 mt-2">
                  {project._count.sources} source{project._count.sources !== 1 ? 's' : ''}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
