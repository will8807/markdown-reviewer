import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'

const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL ?? 'file:./prisma/dev.db' })
const prisma = new PrismaClient({ adapter })

async function main() {
  const { count: comments } = await prisma.comment.deleteMany()
  const { count: anchors } = await prisma.commentAnchor.deleteMany()
  const { count: threads } = await prisma.commentThread.deleteMany()
  console.log(`Deleted ${threads} thread(s), ${anchors} anchor(s), ${comments} comment(s).`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
