import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'

export async function findFileByPath(sourceId: string, filePath: string) {
  return prisma.fileEntry.findUnique({
    where: { sourceId_path: { sourceId, path: filePath } },
  })
}

export async function createCommentThread(
  sourceId: string,
  fileId: string,
  anchor: Prisma.CommentAnchorCreateWithoutThreadInput,
) {
  return prisma.commentThread.create({
    data: {
      sourceId,
      fileId,
      anchor: { create: anchor },
    },
    include: { anchor: true, comments: true },
  })
}

export async function addComment(threadId: string, authorId: string, body: string) {
  return prisma.comment.create({
    data: { threadId, authorId, body },
    include: { author: true },
  })
}

export async function listThreadsForFile(fileId: string) {
  return prisma.commentThread.findMany({
    where: { fileId },
    include: {
      anchor: true,
      comments: {
        include: { author: true },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'asc' },
  })
}

export async function setThreadResolved(threadId: string, resolved: boolean) {
  return prisma.commentThread.update({
    where: { id: threadId },
    data: {
      resolved,
      resolvedAt: resolved ? new Date() : null,
    },
  })
}
