import path from 'path'
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { readBuffer } from '@/lib/sources/localSource'

const querySchema = z.object({ path: z.string().min(1) })

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; sourceId: string }> }
) {
  const { projectId, sourceId } = await params

  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) return Response.json({ error: 'Missing path query parameter' }, { status: 400 })

  const source = await prisma.source.findFirst({ where: { id: sourceId, projectId } })
  if (!source) return Response.json({ error: 'Not found' }, { status: 404 })
  if (source.type !== 'LOCAL' || !source.localPath) {
    return Response.json({ error: 'Source has no local path' }, { status: 400 })
  }

  try {
    const buf = await readBuffer(source.localPath, parsed.data.path)
    const ext = path.extname(parsed.data.path).toLowerCase()
    const contentType = MIME[ext] ?? 'application/octet-stream'
    return new Response(new Uint8Array(buf), { headers: { 'Content-Type': contentType } })
  } catch (err: unknown) {
    if (err instanceof Error && /path traversal/i.test(err.message)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }
    return Response.json({ error: 'Not found' }, { status: 404 })
  }
}
