import { z } from 'zod'
import { addComment } from '@/lib/api/threads'

const bodySchema = z.object({
  threadId: z.string().min(1),
  authorId: z.string().min(1),
  body: z.string().min(1),
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

  try {
    const comment = await addComment(parsed.data.threadId, parsed.data.authorId, parsed.data.body)
    return Response.json(comment, { status: 201 })
  } catch {
    return Response.json({ error: 'Thread not found' }, { status: 404 })
  }
}
