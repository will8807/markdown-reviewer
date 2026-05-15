import { listThreadsForFile } from '@/lib/api/threads'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const { fileId } = await params
  const threads = await listThreadsForFile(fileId)
  return Response.json({ threads })
}
