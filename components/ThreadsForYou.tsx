import Link from 'next/link'
import { prisma } from '@/lib/db'
import { filterThreadsForUser } from '@/lib/activity/threadsForUser'

export default async function ThreadsForYou({ userId }: { userId: string | null }) {
  if (!userId) return null

  let threads: Awaited<ReturnType<typeof filterThreadsForUser>> = []
  try {
    const rows = await prisma.commentThread.findMany({
      where: {
        resolved: false,
        comments: { some: { authorId: userId } },
      },
      include: {
        source: { include: { project: { select: { id: true, name: true } } } },
        file: { select: { path: true } },
        anchor: { select: { selectedText: true } },
        comments: {
          select: { id: true, authorId: true, body: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    const shaped = rows.map((t) => ({
      id: t.id,
      resolved: t.resolved,
      source: {
        id: t.source.id,
        name: t.source.name,
        project: { id: t.source.project.id, name: t.source.project.name },
      },
      file: { path: t.file?.path ?? '' },
      anchor: { selectedText: t.anchor?.selectedText ?? '' },
      comments: t.comments.map((c) => ({
        id: c.id,
        authorId: c.authorId,
        body: c.body,
        createdAt: c.createdAt.toISOString(),
      })),
    }))

    threads = filterThreadsForUser(shaped, userId)
  } catch {
    return null
  }

  if (threads.length === 0) return null

  return (
    <section className="mb-8">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-3">
        Threads you&rsquo;re in
      </h2>
      <ul className="space-y-2">
        {threads.map((t) => {
          const latest = t.comments[t.comments.length - 1]
          const href = t.file.path
            ? `/projects/${t.source.project.id}/sources/${t.source.id}?path=${encodeURIComponent(t.file.path)}`
            : `/projects/${t.source.project.id}/sources/${t.source.id}`
          return (
            <li key={t.id}>
              <Link
                href={href}
                className="flex flex-col gap-0.5 rounded-lg border border-zinc-200 dark:border-zinc-700 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium truncate">
                    {t.anchor.selectedText ? `"${t.anchor.selectedText}"` : t.file.path || t.source.name}
                  </span>
                  <span className="text-xs text-zinc-400 shrink-0">
                    {new Date(latest.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <span className="text-xs text-zinc-500 truncate">
                  {t.source.name} · {t.file.path}
                </span>
                <p className="text-xs text-zinc-500 mt-1 line-clamp-1">{latest.body}</p>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
