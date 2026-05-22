import { prisma } from '@/lib/db'
import type { Prisma, ThreadStatus } from '@prisma/client'

export async function findFileByPath(sourceId: string, filePath: string) {
  return prisma.fileEntry.findUnique({
    where: { sourceId_path: { sourceId, path: filePath } },
  })
}

export async function createCommentThread(
  sourceId: string,
  fileId: string | null,
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

export async function listThreadsForFile(
  fileId: string,
  opts?: { sourceId: string; filePath: string },
) {
  // Include threads anchored to this fileId AND threads from compare mode
  // (fileId = null) that share the same source + file path.
  return prisma.commentThread.findMany({
    where: {
      OR: [
        { fileId },
        ...(opts
          ? [{ sourceId: opts.sourceId, fileId: null, anchor: { filePath: opts.filePath } }]
          : []),
      ],
    },
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

export async function setThreadStatus(threadId: string, status: ThreadStatus) {
  return prisma.commentThread.update({
    where: { id: threadId },
    data: { status },
  })
}

// All file-anchored threads in a source, across every file. Diff- and
// image-region anchors are excluded — those belong to a comparison view, not
// the file viewer that all-files mode navigates within.
export async function listThreadsForSource(sourceId: string) {
  return prisma.commentThread.findMany({
    where: {
      sourceId,
      anchor: { type: { in: ['TEXT_SELECTION', 'HEADING', 'BLOCK'] } },
    },
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

export async function listThreadsForDiff(
  sourceId: string,
  filePath: string,
  baseSha: string,
  headSha: string,
) {
  return prisma.commentThread.findMany({
    where: {
      sourceId,
      anchor: {
        filePath,
        hunkId: `${baseSha}:${headSha}`,
      },
    },
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
