import { prisma } from '@/lib/db'
import SourceRail from '@/components/SourceRail'
import ThreadsForYou from '@/components/ThreadsForYou'
import RecentFiles from '@/components/RecentFiles'

async function getSources() {
  try {
    return await prisma.source.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        type: true,
        project: { select: { id: true, name: true } },
      },
    })
  } catch {
    return null
  }
}

export default async function Home() {
  const sources = await getSources()
  const userId = process.env.DEV_USER_ID ?? null

  if (sources === null) {
    return (
      <div className="p-8 max-w-lg">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-medium">Database not connected</p>
          <p className="mt-1">
            Ensure <code>DATABASE_URL</code> is set in <code>.env</code> and run{' '}
            <code>npm run db:seed</code>.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      <aside
        data-testid="source-rail"
        className="w-56 shrink-0 border-r border-zinc-200 dark:border-zinc-800 overflow-y-auto py-3"
      >
        <SourceRail sources={sources} activeSourceId={null} />
      </aside>

      <main className="flex-1 min-w-0 overflow-y-auto p-8 max-w-2xl">
        {sources.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No sources yet — click <strong>+ New Source</strong> in the top bar to add one.
          </p>
        ) : (
          <>
            <ThreadsForYou userId={userId} />
            <RecentFiles />
            {userId === null && (
              <p className="text-sm text-zinc-400">
                Set <code>DEV_USER_ID</code> in <code>.env</code> to see your activity.
              </p>
            )}
          </>
        )}
      </main>
    </div>
  )
}
