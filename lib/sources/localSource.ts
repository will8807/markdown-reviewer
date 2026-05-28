import fs from 'fs/promises'
import path from 'path'
import { assertSafe } from './pathSafety'

const BINARY_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp', '.tiff',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.zip', '.tar', '.gz', '.tgz', '.bz2', '.7z', '.rar',
  '.exe', '.dll', '.so', '.dylib', '.class', '.pyc', '.pyd',
  '.mp4', '.mp3', '.wav', '.avi', '.mov', '.ogg', '.flac',
  '.pdf', '.wasm', '.bin', '.dat',
])

function isBinaryFilename(name: string): boolean {
  const dot = name.lastIndexOf('.')
  return dot !== -1 && BINARY_EXTS.has(name.slice(dot).toLowerCase())
}

export async function scan(root: string): Promise<string[]> {
  const results: string[] = []
  await walk(root, root, results)
  return results.sort()
}

async function walk(root: string, dir: string, out: string[]): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const abs = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      await walk(root, abs, out)
    } else if (entry.isFile() && !isBinaryFilename(entry.name)) {
      const rel = path.relative(root, abs).replace(/\\/g, '/')
      out.push(rel)
    }
  }
}

export async function read(root: string, filePath: string): Promise<string> {
  assertSafe(root, filePath)
  const abs = path.join(root, filePath.replace(/\//g, path.sep))
  return fs.readFile(abs, 'utf8')
}

export async function readBuffer(root: string, filePath: string): Promise<Buffer> {
  assertSafe(root, filePath)
  const abs = path.join(root, filePath.replace(/\//g, path.sep))
  return fs.readFile(abs)
}
