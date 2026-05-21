import { createClient } from '@libsql/client'
import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'

function createPrismaClient() {
  const url = process.env.DATABASE_URL ?? 'file:./prisma/dev.db'
  // WAL mode must be persistent in the DB file so all processes can read
  // concurrently. The seed script sets it before server start; this is a
  // fallback for dev environments where seed hasn't been run yet.
  const rawClient = createClient({ url })
  rawClient.execute('PRAGMA journal_mode=WAL').finally(() => rawClient.close()).catch(() => {})

  const adapter = new PrismaLibSql({ url })
  const client = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    transactionOptions: { maxWait: 15_000, timeout: 30_000 },
  })
  // busy_timeout must be set per-connection. 30 s gives ample headroom under CI
  // load where the server can hold the write lock for several seconds.
  client.$executeRawUnsafe('PRAGMA busy_timeout=30000').catch(() => {})
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
