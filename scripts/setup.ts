import { execSync } from 'node:child_process'
import { existsSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs'

// Coordinates a fresh install: dependencies → .env → Prisma client →
// migrations → seed. Safe to re-run; an existing .env is left untouched.

function step(label: string, cmd: string): void {
  console.log(`\n▶ ${label}`)
  execSync(cmd, { stdio: 'inherit' })
}

async function main(): Promise<void> {
  step('Installing dependencies', 'npm install')

  if (existsSync('.env')) {
    console.log('\n▶ .env already exists — leaving it untouched')
  } else {
    copyFileSync('.env.example', '.env')
    console.log('\n▶ Created .env from .env.example')
  }

  step('Generating Prisma client', 'npx prisma generate')
  step('Applying database migrations', 'npx prisma migrate deploy')

  console.log('\n▶ Seeding the database')
  const seedOutput = execSync('npx prisma db seed', {
    stdio: ['inherit', 'pipe', 'inherit'],
    encoding: 'utf8',
  })
  process.stdout.write(seedOutput)

  // The seed prints the seeded user id; wire it into .env so comment
  // authorship works without a manual edit.
  const match = seedOutput.match(/DEV_USER_ID=(\S+)/)
  if (match) {
    const env = readFileSync('.env', 'utf8')
    const updated = /^DEV_USER_ID=.*$/m.test(env)
      ? env.replace(/^DEV_USER_ID=.*$/m, `DEV_USER_ID=${match[1]}`)
      : `${env.trimEnd()}\nDEV_USER_ID=${match[1]}\n`
    writeFileSync('.env', updated)
    console.log(`\n▶ Set DEV_USER_ID in .env`)
  }

  console.log('\n✓ Setup complete. Start the app with:  npm run dev')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
