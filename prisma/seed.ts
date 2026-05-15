import { PrismaClient } from '@prisma/client'
import path from 'path'

const prisma = new PrismaClient()

async function main() {
  const user = await prisma.user.upsert({
    where: { email: 'dev@localhost' },
    update: {},
    create: { email: 'dev@localhost', name: 'Dev User' },
  })

  const project = await prisma.project.upsert({
    where: { id: 'demo-project' },
    update: {},
    create: { id: 'demo-project', name: 'Demo Project', description: 'Development demo content' },
  })

  const source = await prisma.source.upsert({
    where: { id: 'demo-source' },
    update: {},
    create: {
      id: 'demo-source',
      projectId: project.id,
      type: 'LOCAL',
      name: 'Demo Content',
      localPath: path.resolve(process.cwd(), 'demo-content'),
    },
  })

  console.log('Seeded:')
  console.log(`  User:    ${user.id}  (${user.email})`)
  console.log(`  Project: ${project.id}`)
  console.log(`  Source:  ${source.id}  →  ${source.localPath}`)
  console.log('')
  console.log(`Add to .env:  DEV_USER_ID=${user.id}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
