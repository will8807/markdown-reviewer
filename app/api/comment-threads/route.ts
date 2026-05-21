import { z } from 'zod'
import { prisma } from '@/lib/db'
import { createCommentThread } from '@/lib/api/threads'

const baseAnchorSchema = z.object({
  type: z.enum(['TEXT_SELECTION', 'HEADING', 'BLOCK', 'IMAGE_REGION', 'DIFF_HUNK']),
  filePath: z.string().min(1),
  selectedText: z.string().optional(),
  prefix: z.string().optional(),
  suffix: z.string().optional(),
  headingPath: z.string().optional(),
  charStart: z.number().int().optional(),
  charEnd: z.number().int().optional(),
  renderedStart: z.number().int().optional(),
  renderedEnd: z.number().int().optional(),
  // DIFF_HUNK fields
  diffSide: z.enum(['base', 'head']).optional(),
  lineStart: z.number().int().positive().optional(),
  lineEnd: z.number().int().positive().optional(),
  baseSha: z.string().optional(),
  headSha: z.string().optional(),
  // IMAGE_REGION fields (normalized 0..1 relative to image element bounding box)
  imgX: z.number().min(0).max(1).optional(),
  imgY: z.number().min(0).max(1).optional(),
  imgW: z.number().min(0).max(1).optional(),
  imgH: z.number().min(0).max(1).optional(),
})

const bodySchema = z.object({
  sourceId: z.string().min(1),
  fileId: z.string().min(1).optional(),
  anchor: baseAnchorSchema,
})

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { sourceId, fileId, anchor } = parsed.data

  const source = await prisma.source.findUnique({ where: { id: sourceId } })
  if (!source) return Response.json({ error: 'Source not found' }, { status: 404 })

  // For DIFF_HUNK anchors, store baseSha:headSha in hunkId for later lookup
  const anchorData = {
    type: anchor.type,
    filePath: anchor.filePath,
    selectedText: anchor.selectedText,
    prefix: anchor.prefix,
    suffix: anchor.suffix,
    headingPath: anchor.headingPath,
    charStart: anchor.charStart,
    charEnd: anchor.charEnd,
    renderedStart: anchor.renderedStart,
    renderedEnd: anchor.renderedEnd,
    diffSide: anchor.diffSide,
    lineStart: anchor.lineStart,
    lineEnd: anchor.lineEnd,
    hunkId: anchor.baseSha && anchor.headSha
      ? `${anchor.baseSha}:${anchor.headSha}`
      : undefined,
    imgX: anchor.imgX,
    imgY: anchor.imgY,
    imgW: anchor.imgW,
    imgH: anchor.imgH,
  }

  const thread = await createCommentThread(sourceId, fileId ?? null, anchorData)
  return Response.json(thread, { status: 201 })
}
