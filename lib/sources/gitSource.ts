import { execFileSync } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import simpleGit from 'simple-git'
import { assertSafe } from './pathSafety'

export interface Ref {
  name: string
  sha: string
  type: 'branch' | 'tag'
}

// Clone sourceUrl as a bare repo into repoDir. If repoDir already looks like a
// bare clone (HEAD present), fetch instead so callers can call this idempotently.
// Tolerant of concurrent calls — when one finishes after another started, the
// loser polls for HEAD to appear instead of erroring.
export async function cloneOrFetch(sourceUrl: string, repoDir: string): Promise<void> {
  if (existsSync(join(repoDir, 'HEAD'))) {
    await simpleGit(repoDir).fetch([
      'origin',
      '+refs/heads/*:refs/heads/*',
      '+refs/tags/*:refs/tags/*',
      '--prune',
    ])
    return
  }
  try {
    await simpleGit().clone(sourceUrl, repoDir, ['--bare'])
  } catch (err) {
    // Another caller is mid-clone — wait briefly for HEAD to appear.
    for (let i = 0; i < 50; i++) {
      if (existsSync(join(repoDir, 'HEAD'))) return
      await new Promise((r) => setTimeout(r, 100))
    }
    throw err
  }
}

// List all branches and tags in the bare repo.
export async function listRefs(repoDir: string): Promise<Ref[]> {
  const raw = await simpleGit(repoDir).raw([
    'for-each-ref',
    '--format=%(refname) %(refname:short) %(objectname)',
    'refs/heads/',
    'refs/tags/',
  ])
  return raw
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [fullRef, name, sha] = line.split(' ')
      const type: Ref['type'] = fullRef.startsWith('refs/tags/') ? 'tag' : 'branch'
      return { name, sha, type }
    })
}

// Resolve a ref name, branch, tag, or abbreviated SHA to a full 40-char commit SHA.
export async function resolveRef(repoDir: string, ref: string): Promise<string> {
  const sha = await simpleGit(repoDir).revparse([`${ref}^{commit}`])
  return sha.trim()
}

const BINARY_EXTS_GIT = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp', '.tiff',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.zip', '.tar', '.gz', '.tgz', '.bz2', '.7z', '.rar',
  '.exe', '.dll', '.so', '.dylib', '.class', '.pyc', '.pyd',
  '.mp4', '.mp3', '.wav', '.avi', '.mov', '.ogg', '.flac',
  '.pdf', '.wasm', '.bin', '.dat',
])

function isTextPath(filePath: string): boolean {
  const dot = filePath.lastIndexOf('.')
  if (dot === -1) return true  // no extension (Dockerfile, Makefile, LICENSE …)
  return !BINARY_EXTS_GIT.has(filePath.slice(dot).toLowerCase())
}

// List all text file paths at a given commit SHA. Returns sorted POSIX paths.
export async function scanTree(repoDir: string, sha: string): Promise<string[]> {
  const raw = await simpleGit(repoDir).raw(['ls-tree', '-r', '--name-only', sha])
  return raw
    .trim()
    .split('\n')
    .filter((line) => line && isTextPath(line))
    .sort()
}

// Read a file at a specific commit SHA. Returns raw bytes so callers can handle
// both text (toString()) and binary files. Rejects path traversal attempts.
export async function readFile(repoDir: string, sha: string, filePath: string): Promise<Buffer> {
  assertSafe('/git-root', filePath)
  try {
    return execFileSync('git', ['cat-file', 'blob', `${sha}:${filePath}`], {
      cwd: repoDir,
      encoding: 'buffer',
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`Failed to read "${filePath}" at ${sha}: ${msg}`)
  }
}
