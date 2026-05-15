export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 overflow-hidden">
      <aside
        data-testid="file-tree"
        className="w-64 shrink-0 border-r border-zinc-200 dark:border-zinc-800 overflow-y-auto"
      >
        {/* FileTree — Phase 3 */}
      </aside>
      <main
        data-testid="main-content"
        className="flex-1 min-w-0 overflow-y-auto"
      >
        {children}
      </main>
      <aside
        data-testid="comment-panel"
        className="w-80 shrink-0 border-l border-zinc-200 dark:border-zinc-800 overflow-y-auto"
      >
        {/* CommentPanel — Phase 3 */}
      </aside>
    </div>
  )
}
