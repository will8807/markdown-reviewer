import sharp from 'sharp'
import { writeFileSync } from 'fs'

const W = 800
const H = 400

function banner(version: 'v1' | 'v2'): string {
  const isV2 = version === 'v2'
  const title = isV2 ? 'Acme Docs v2.0' : 'Acme Docs v1.0'
  const subtitle = isV2
    ? 'Faster. Clearer. Now with examples.'
    : 'Documentation for the Acme API.'
  const blockFill = isV2 ? '#10b981' : '#3b82f6'
  const blockLabel = isV2 ? 'NEW' : 'API'
  const footer = isV2 ? 'Updated 2026-05-18' : 'Updated 2025-11-04'

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <rect width="100%" height="100%" fill="#f4f4f5"/>

  <!-- Title block (top-left region) -->
  <text x="40" y="90" font-family="Arial, sans-serif" font-size="44" font-weight="700" fill="#18181b">${title}</text>
  <text x="40" y="130" font-family="Arial, sans-serif" font-size="20" fill="#52525b">${subtitle}</text>

  <!-- Illustration block (right-side region) -->
  <rect x="540" y="60" width="220" height="220" rx="16" fill="${blockFill}"/>
  <text x="650" y="185" font-family="Arial, sans-serif" font-size="56" font-weight="700" fill="#ffffff" text-anchor="middle">${blockLabel}</text>

  <!-- Divider line -->
  <line x1="40" y1="330" x2="760" y2="330" stroke="#d4d4d8" stroke-width="2"/>

  <!-- Footer text (bottom-left region) -->
  <text x="40" y="360" font-family="Arial, sans-serif" font-size="14" fill="#71717a">${footer}</text>
</svg>`
}

async function main() {
  const outDir = process.argv[2]
  const version = process.argv[3] as 'v1' | 'v2'
  if (!outDir || !version) {
    console.error('usage: tsx gen-demo-banner.ts <outDir> <v1|v2>')
    process.exit(1)
  }

  const svg = banner(version)
  const png = await sharp(Buffer.from(svg)).png().toBuffer()
  writeFileSync(`${outDir}/hero.png`, png)
  console.log(`Wrote ${outDir}/hero.png (${version}, ${png.length} bytes)`)
}

main()
