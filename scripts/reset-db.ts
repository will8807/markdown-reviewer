import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'

const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL ?? 'file:./prisma/dev.db' })
const prisma = new PrismaClient({ adapter })

async function main() {
  // SQLite doesn't support TRUNCATE or CASCADE — delete in FK order instead
  await prisma.comment.deleteMany()
  await prisma.commentAnchor.deleteMany()
  await prisma.commentThread.deleteMany()
  await prisma.fileEntry.deleteMany()
  await prisma.reviewSession.deleteMany()
  await prisma.sourceRevision.deleteMany()
  await prisma.source.deleteMany()
  await prisma.project.deleteMany()
  await prisma.user.deleteMany()
  console.log('Database reset complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
