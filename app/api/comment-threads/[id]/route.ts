import { z } from 'zod'
import { setThreadResolved } from '@/lib/api/threads'

const bodySchema = z.object({
  resolved: z.boolean(),
})

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

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
    const thread = await setThreadResolved(id, parsed.data.resolved)
    return Response.json(thread)
  } catch {
    return Response.json({ error: 'Thread not found' }, { status: 404 })
  }
}
