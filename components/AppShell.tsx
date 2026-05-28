import TopBar from './TopBar'
import SidebarGate from './SidebarGate'
import CollapsibleCommentAside from './CollapsibleCommentAside'

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <SidebarGate />
        <main data-testid="main-content" className="flex-1 min-w-0 overflow-y-auto">
          {children}
        </main>
        <CollapsibleCommentAside />
      </div>
    </div>
  )
}
