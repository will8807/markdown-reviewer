import parseDiff from 'parse-diff'
import { simpleGit } from 'simple-git'

export interface DiffLine {
  side: 'base' | 'head' | 'context'
  lineNumber: number
  content: string
}

export interface DiffHunk {
  header: string
  lines: DiffLine[]
}

export interface FileDiff {
  path: string
  status: 'added' | 'removed' | 'modified' | 'renamed'
  hunks: DiffHunk[]
  isBinary: boolean
}

export interface ChangedFile {
  path: string
  status: 'added' | 'removed' | 'modified' | 'renamed'
  additions: number
  deletions: number
}

function fileStatus(file: parseDiff.File): ChangedFile['status'] {
  if (file.new) return 'added'
  if (file.deleted) return 'removed'
  if (file.from && file.to && file.from !== file.to) return 'renamed'
  return 'modified'
}

function filePath(file: parseDiff.File, status: ChangedFile['status']): string {
  const raw = status === 'removed' ? file.from : file.to
  return (raw ?? '').replace(/\\/g, '/')
}

export async function listChangedFiles(
  repoDir: string,
  baseSha: string,
  headSha: string,
): Promise<ChangedFile[]> {
  const sg = simpleGit(repoDir)
  const rawDiff = await sg.raw(['diff', '--no-color', '--unified=0', baseSha, headSha])
  if (!rawDiff.trim()) return []

  const parsed = parseDiff(rawDiff)
  return parsed.map((file) => {
    const status = fileStatus(file)
    return {
      path: filePath(file, status),
      status,
      additions: file.additions,
      deletions: file.deletions,
    }
  })
}

export async function computeFileDiff(
  repoDir: string,
  baseSha: string,
  headSha: string,
  filePath: string,
): Promise<FileDiff> {
  const sg = simpleGit(repoDir)
  const rawDiff = await sg.raw([
    'diff',
    '--no-color',
    `--unified=3`,
    baseSha,
    headSha,
    '--',
    filePath,
  ])

  const isBinary = rawDiff.includes('Binary files')
  const parsed = parseDiff(rawDiff)
  const file = parsed[0]

  const status: FileDiff['status'] = file ? fileStatus(file) : 'modified'
  const path = file ? (fileStatus(file) === 'removed' ? file.from : file.to) ?? filePath : filePath

  if (isBinary || !file) {
    return { path: path.replace(/\\/g, '/'), status, hunks: [], isBinary: true }
  }

  const hunks: DiffHunk[] = file.chunks.map((chunk) => ({
    header: chunk.content,
    lines: chunk.changes.map((change): DiffLine => {
      if (change.type === 'add') {
        return { side: 'head', lineNumber: change.ln, content: change.content.slice(1) }
      }
      if (change.type === 'del') {
        return { side: 'base', lineNumber: change.ln, content: change.content.slice(1) }
      }
      return { side: 'context', lineNumber: change.ln1, content: change.content.slice(1) }
    }),
  }))

  return { path: path.replace(/\\/g, '/'), status, hunks, isBinary: false }
}
