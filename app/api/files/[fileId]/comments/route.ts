import { prisma } from '@/lib/db'
import { listThreadsForFile } from '@/lib/api/threads'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const { fileId } = await params
  // Look up the FileEntry so we can also include compare-mode threads (fileId
  // = null) that share the same source + file path.
  const file = await prisma.fileEntry.findUnique({ where: { id: fileId } })
  const threads = await listThreadsForFile(
    fileId,
    file ? { sourceId: file.sourceId, filePath: file.path } : undefined,
  )
  return Response.json({ threads })
}
