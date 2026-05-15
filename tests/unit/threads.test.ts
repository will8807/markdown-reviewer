import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { prisma } from '@/lib/db'
import {
  findFileByPath,
  createCommentThread,
  addComment,
  listThreadsForFile,
  setThreadResolved,
} from '@/lib/api/threads'

// Requires DATABASE_URL_TEST pointing at the test schema.
// Run: docker compose up -d db && pnpm prisma migrate deploy

let userId: string
let sourceId: string
let fileId: string

beforeEach(async () => {
  await prisma.comment.deleteMany()
  await prisma.commentAnchor.deleteMany()
  await prisma.commentThread.deleteMany()
  await prisma.fileEntry.deleteMany()
  await prisma.reviewSession.deleteMany()
  await prisma.source.deleteMany()
  await prisma.project.deleteMany()
  await prisma.user.deleteMany()

  const user = await prisma.user.create({
    data: { email: 'test@test.com', name: 'Test User' },
  })
  userId = user.id

  const project = await prisma.project.create({
    data: { name: 'Test Project' },
  })

  const source = await prisma.source.create({
    data: { projectId: project.id, type: 'LOCAL', name: 'Test Source', localPath: '/test' },
  })
  sourceId = source.id

  const file = await prisma.fileEntry.create({
    data: { sourceId, path: 'README.md' },
  })
  fileId = file.id
})

afterAll(() => prisma.$disconnect())

describe('findFileByPath', () => {
  it('returns the file when it exists', async () => {
    const file = await findFileByPath(sourceId, 'README.md')
    expect(file).not.toBeNull()
    expect(file?.path).toBe('README.md')
  })

  it('returns null for an unknown path', async () => {
    const file = await findFileByPath(sourceId, 'missing.md')
    expect(file).toBeNull()
  })
})

describe('createCommentThread', () => {
  it('creates a thread with a TEXT_SELECTION anchor', async () => {
    const thread = await createCommentThread(sourceId, fileId, {
      type: 'TEXT_SELECTION',
      filePath: 'README.md',
      selectedText: 'hello world',
      prefix: 'say ',
      suffix: ' today',
    })
    expect(thread.sourceId).toBe(sourceId)
    expect(thread.fileId).toBe(fileId)
    expect(thread.resolved).toBe(false)
    expect(thread.anchor?.selectedText).toBe('hello world')
    expect(thread.comments).toHaveLength(0)
  })
})

describe('addComment', () => {
  it('adds a comment attributed to the given author', async () => {
    const thread = await createCommentThread(sourceId, fileId, {
      type: 'TEXT_SELECTION',
      filePath: 'README.md',
    })
    const comment = await addComment(thread.id, userId, 'Great point!')
    expect(comment.body).toBe('Great point!')
    expect(comment.author.id).toBe(userId)
  })
})

describe('listThreadsForFile', () => {
  it('returns all threads with their comments', async () => {
    const thread = await createCommentThread(sourceId, fileId, {
      type: 'TEXT_SELECTION',
      filePath: 'README.md',
      selectedText: 'some text',
    })
    await addComment(thread.id, userId, 'First comment')
    await addComment(thread.id, userId, 'Second comment')

    const threads = await listThreadsForFile(fileId)
    expect(threads).toHaveLength(1)
    expect(threads[0].anchor?.selectedText).toBe('some text')
    expect(threads[0].comments).toHaveLength(2)
    expect(threads[0].comments[0].body).toBe('First comment')
  })

  it('returns an empty array when no threads exist', async () => {
    const threads = await listThreadsForFile(fileId)
    expect(threads).toHaveLength(0)
  })
})

describe('setThreadResolved', () => {
  it('marks a thread as resolved and sets resolvedAt', async () => {
    const thread = await createCommentThread(sourceId, fileId, {
      type: 'TEXT_SELECTION',
      filePath: 'README.md',
    })
    const updated = await setThreadResolved(thread.id, true)
    expect(updated.resolved).toBe(true)
    expect(updated.resolvedAt).not.toBeNull()
  })

  it('reopens a resolved thread and clears resolvedAt', async () => {
    const thread = await createCommentThread(sourceId, fileId, {
      type: 'TEXT_SELECTION',
      filePath: 'README.md',
    })
    await setThreadResolved(thread.id, true)
    const updated = await setThreadResolved(thread.id, false)
    expect(updated.resolved).toBe(false)
    expect(updated.resolvedAt).toBeNull()
  })
})
