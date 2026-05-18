import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'fs'
import path from 'path'
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getRepoDir } from '@/lib/sources/gitRevisions'
import { resolveRef, readFile } from '@/lib/sources/gitSource'
import { assertSafe } from '@/lib/sources/pathSafety'

const querySchema = z.object({
  base: z.string().min(1),
  head: z.string().min(1),
  path: z.string().min(1),
})

function cacheDir(sourceId: string, baseSha: string, headSha: string): string {
  return path.resolve(process.cwd(), '.data', 'git', sourceId, 'diff', `${baseSha}-${headSha}`)
}

function cachePath(sourceId: string, baseSha: string, headSha: string, filePath: string): string {
  return path.join(cacheDir(sourceId, baseSha, headSha), filePath)
}

async function generateDiff(baseBuf: Buffer, headBuf: Buffer): Promise<Buffer> {
  const sharp = (await import('sharp')).default
  const pixelmatch = (await import('pixelmatch')).default

  // Decode both to raw RGBA, resizing to the same dimensions first.
  const [baseInfo, headInfo] = await Promise.all([
    sharp(baseBuf).metadata(),
    sharp(headBuf).metadata(),
  ])
  const width = Math.max(baseInfo.width ?? 1, headInfo.width ?? 1)
  const height = Math.max(baseInfo.height ?? 1, headInfo.height ?? 1)

  const [baseRaw, headRaw] = await Promise.all([
    sharp(baseBuf)
      .resize(width, height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .ensureAlpha()
      .raw()
      .toBuffer(),
    sharp(headBuf)
      .resize(width, height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .ensureAlpha()
      .raw()
      .toBuffer(),
  ])

  const diffPixels = Buffer.alloc(width * height * 4)
  pixelmatch(baseRaw, headRaw, diffPixels, width, height, { threshold: 0.1, alpha: 0.3 })

  return sharp(diffPixels, { raw: { width, height, channels: 4 } }).png().toBuffer()
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; sourceId: string }> },
) {
  const { projectId, sourceId } = await params

  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return Response.json({ error: 'base, head, and path query params are required' }, { status: 400 })
  }

  try {
    assertSafe('/git-root', parsed.data.path)
  } catch {
    return Response.json({ error: 'Forbidden' }, { status: 400 })
  }

  const source = await prisma.source.findFirst({
    where: { id: sourceId, projectId, type: 'GIT' },
  })
  if (!source) return Response.json({ error: 'Not found' }, { status: 404 })

  const repoDir = getRepoDir(source.id)
  let baseSha: string
  let headSha: string
  try {
    ;[baseSha, headSha] = await Promise.all([
      resolveRef(repoDir, parsed.data.base),
      resolveRef(repoDir, parsed.data.head),
    ])
  } catch {
    return Response.json({ error: 'Failed to resolve refs' }, { status: 502 })
  }

  // Serve from disk cache if available (content-addressed by SHA pair).
  const cached = cachePath(sourceId, baseSha, headSha, parsed.data.path)
  if (existsSync(cached)) {
    const buf = readFileSync(cached)
    return new Response(new Uint8Array(buf), {
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable' },
    })
  }

  let baseBuf: Buffer
  let headBuf: Buffer
  try {
    ;[baseBuf, headBuf] = await Promise.all([
      readFile(repoDir, baseSha, parsed.data.path),
      readFile(repoDir, headSha, parsed.data.path),
    ])
  } catch {
    return Response.json({ error: 'Could not read file on one or both sides' }, { status: 404 })
  }

  let diffPng: Buffer
  try {
    diffPng = await generateDiff(baseBuf, headBuf)
  } catch {
    return Response.json({ error: 'Failed to generate pixel diff' }, { status: 500 })
  }

  // Persist to cache.
  try {
    mkdirSync(path.dirname(cached), { recursive: true })
    writeFileSync(cached, diffPng)
  } catch { /* non-fatal — still serve the response */ }

  return new Response(new Uint8Array(diffPng), {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable' },
  })
}
