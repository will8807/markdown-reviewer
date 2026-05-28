import Link from 'next/link'

interface Source {
  id: string
  name: string
  type: string
  project: { id: string; name: string }
}

interface Props {
  sources: Source[]
  activeSourceId: string | null
}

export default function SourceRail({ sources, activeSourceId }: Props) {
  if (sources.length === 0) {
    return <div data-testid="source-rail-empty" className="p-4 text-sm text-gray-500">No sources yet.</div>
  }

  const groupsMap = new Map<string, { projectId: string; projectName: string; sources: Source[] }>()
  for (const src of sources) {
    const { id: projectId, name: projectName } = src.project
    if (!groupsMap.has(projectId)) {
      groupsMap.set(projectId, { projectId, projectName, sources: [] })
    }
    groupsMap.get(projectId)!.sources.push(src)
  }

  const groups = [...groupsMap.values()].sort((a, b) =>
    a.projectName.localeCompare(b.projectName),
  )

  return (
    <nav aria-label="Sources">
      {groups.map(({ projectId, projectName, sources: groupSources }) => (
        <div key={projectId} data-testid={`source-rail-group-${projectId}`}>
          <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
            {projectName}
          </div>
          <ul>
            {groupSources.map((src) => (
              <li key={src.id}>
                <Link
                  href={`/projects/${src.project.id}/sources/${src.id}`}
                  aria-current={src.id === activeSourceId ? 'page' : undefined}
                  className="block px-4 py-1.5 text-sm hover:bg-gray-100"
                >
                  {src.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}
