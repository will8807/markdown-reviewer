import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'

function createPrismaClient() {
  const url = process.env.DATABASE_URL ?? 'file:./prisma/dev.db'
  const adapter = new PrismaLibSql({ url })
  const client = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    // Cascade-delete on SQLite can exceed the 5s default when another process
    // (Next.js server vs BDD process) holds a brief write lock. Give engine-
    // level operations up to 20s so cleanups don't fail under WAL contention.
    transactionOptions: { maxWait: 15_000, timeout: 30_000 },
  })
  // WAL is persistent on the DB file. busy_timeout is per-connection (10s).
  client.$executeRawUnsafe('PRAGMA busy_timeout = 10000').catch(() => {})
  return client
}

const globalForPrisma = global as unknown as { prisma: PrismaClient | undefined }

function getClient(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient()
  }
  return globalForPrisma.prisma
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    return (getClient() as unknown as Record<string | symbol, unknown>)[prop]
  },
})
