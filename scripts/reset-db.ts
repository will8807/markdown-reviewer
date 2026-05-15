import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const tables = [
    '"Comment"',
    '"CommentAnchor"',
    '"CommentThread"',
    '"FileEntry"',
    '"ReviewSession"',
    '"SourceRevision"',
    '"Source"',
    '"Project"',
    '"User"',
  ]
  for (const table of tables) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${table} CASCADE`)
  }
  console.log('Database reset complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
