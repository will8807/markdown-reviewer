import { z } from 'zod'
import { prisma } from '@/lib/db'
import { createCommentThread } from '@/lib/api/threads'

const bodySchema = z.object({
  sourceId: z.string().min(1),
  fileId: z.string().min(1).optional(),
  anchor: z.object({
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
  }),
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

  // Verify source exists
  const source = await prisma.source.findUnique({ where: { id: sourceId } })
  if (!source) return Response.json({ error: 'Source not found' }, { status: 404 })

  const thread = await createCommentThread(sourceId, fileId ?? null, anchor)
  return Response.json(thread, { status: 201 })
}
