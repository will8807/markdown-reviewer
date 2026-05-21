import { prisma } from '../lib/db'

async function main() {
  const sources = await prisma.source.findMany({
    select: { id: true, name: true, type: true, gitUrl: true, localPath: true, projectId: true },
  })
  console.log(JSON.stringify(sources, null, 2))
}

main().finally(() => prisma.$disconnect())
