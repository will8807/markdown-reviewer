// Module-level store so CommentPanel can bootstrap on mount even when
// content components dispatch their events before listeners are registered.

export type FileCtx = { type: 'file'; fileId: string; filePath: string; sha?: string }
export type DiffCtx = { type: 'diff'; sourceId: string; filePath: string; baseSha: string; headSha: string }
export type PanelCtx = FileCtx | DiffCtx | null

let _ctx: PanelCtx = null
export function setPanelContext(ctx: PanelCtx) { _ctx = ctx }
export function getPanelContext(): PanelCtx { return _ctx }
