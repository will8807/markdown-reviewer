import { defineConfig } from 'vitest/config'
import { readFileSync } from 'fs'
import path from 'path'

function parseDotenv(filePath: string): Record<string, string> {
  try {
    return Object.fromEntries(
      readFileSync(filePath, 'utf-8')
        .split('\n')
        .filter(l => l && !l.startsWith('#') && l.includes('='))
        .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')] })
    )
  } catch { return {} }
}

const env = parseDotenv(path.resolve(__dirname, '.env'))

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    // DB integration tests use DATABASE_URL_TEST; swap the env var at test time.
    env: {
      DATABASE_URL:
        process.env.DATABASE_URL_TEST ??
        process.env.DATABASE_URL ??
        env.DATABASE_URL_TEST ??
        env.DATABASE_URL ??
        '',
    },
    coverage: {
      provider: 'v8',
      include: ['lib/**', 'components/**'],
    },
  },
})
