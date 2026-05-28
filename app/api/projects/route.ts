import { z } from 'zod'
import { prisma } from '@/lib/db'

export async function GET() {
  const projects = await prisma.project.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  })
  return Response.json(projects)
}

const bodySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
})

export async function POST(req: Request) {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 422 })
  }
  const project = await prisma.project.create({
    data: { name: parsed.data.name, description: parsed.data.description },
    select: { id: true, name: true },
  })
  return Response.json(project, { status: 201 })
}
