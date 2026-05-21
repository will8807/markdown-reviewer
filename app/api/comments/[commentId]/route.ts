import { z } from 'zod'
import { prisma } from '@/lib/db'

const patchSchema = z.object({
  body: z.string().min(1),
  authorId: z.string().min(1),
})

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ commentId: string }> },
) {
  const { commentId } = await params

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = patchSchema.safeParse(raw)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const existing = await prisma.comment.findUnique({ where: { id: commentId } })
  if (!existing) return Response.json({ error: 'Not found' }, { status: 404 })
  if (existing.authorId !== parsed.data.authorId) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const updated = await prisma.comment.update({
    where: { id: commentId },
    data: { body: parsed.data.body, editedAt: new Date() },
    include: { author: true },
  })

  return Response.json(updated)
}
