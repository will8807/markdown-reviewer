import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, screen, within } from '@testing-library/react'
import SourceRail from '@/components/SourceRail'

afterEach(cleanup)

const demoSource = {
  id: 'src1',
  name: 'Demo Content',
  type: 'LOCAL' as const,
  project: { id: 'p1', name: 'Demo Project' },
}
const wikiSource = {
  id: 'src2',
  name: 'Internal Wiki',
  type: 'GIT' as const,
  project: { id: 'p2', name: 'Engineering' },
}
const otherDemoSource = {
  id: 'src3',
  name: 'Reference Docs',
  type: 'GIT' as const,
  project: { id: 'p1', name: 'Demo Project' },
}

describe('SourceRail', () => {
  it('lists every source passed in', () => {
    render(<SourceRail sources={[demoSource, wikiSource]} activeSourceId={null} />)
    expect(screen.getByText('Demo Content')).toBeTruthy()
    expect(screen.getByText('Internal Wiki')).toBeTruthy()
  })

  it('renders sources as links to their viewer pages', () => {
    render(<SourceRail sources={[demoSource]} activeSourceId={null} />)
    const link = screen.getByText('Demo Content').closest('a')
    expect(link).not.toBeNull()
    expect(link!.getAttribute('href')).toBe('/projects/p1/sources/src1')
  })

  it('groups sources under their project name', () => {
    render(
      <SourceRail
        sources={[demoSource, otherDemoSource, wikiSource]}
        activeSourceId={null}
      />,
    )
    const demoGroup = screen.getByTestId('source-rail-group-p1')
    expect(within(demoGroup).getByText('Demo Project')).toBeTruthy()
    expect(within(demoGroup).getByText('Demo Content')).toBeTruthy()
    expect(within(demoGroup).getByText('Reference Docs')).toBeTruthy()

    const engGroup = screen.getByTestId('source-rail-group-p2')
    expect(within(engGroup).getByText('Engineering')).toBeTruthy()
    expect(within(engGroup).getByText('Internal Wiki')).toBeTruthy()
  })

  it('orders project groups stably by name', () => {
    render(
      <SourceRail
        sources={[wikiSource, demoSource]}
        activeSourceId={null}
      />,
    )
    const groups = screen.getAllByTestId(/^source-rail-group-/)
    expect(groups.map((g) => g.getAttribute('data-testid'))).toEqual([
      'source-rail-group-p1', // Demo Project
      'source-rail-group-p2', // Engineering
    ])
  })

  it('marks the active source as current via aria-current', () => {
    render(
      <SourceRail
        sources={[demoSource, wikiSource]}
        activeSourceId="src2"
      />,
    )
    const activeLink = screen.getByText('Internal Wiki').closest('a')
    const inactiveLink = screen.getByText('Demo Content').closest('a')
    expect(activeLink?.getAttribute('aria-current')).toBe('page')
    expect(inactiveLink?.getAttribute('aria-current')).not.toBe('page')
  })

  it('renders an empty state when no sources exist', () => {
    render(<SourceRail sources={[]} activeSourceId={null} />)
    expect(screen.getByTestId('source-rail-empty')).toBeTruthy()
  })

  it('does not collapse projects whose names happen to match alphabetically next to each other', () => {
    const a = { ...demoSource, id: 'sa', project: { id: 'pA', name: 'Acme' } }
    const a2 = { ...demoSource, id: 'sa2', project: { id: 'pA2', name: 'Acme' } }
    render(<SourceRail sources={[a, a2]} activeSourceId={null} />)
    // Two groups even when project names are equal — grouping is by project id
    expect(screen.getAllByTestId(/^source-rail-group-/)).toHaveLength(2)
  })
})
