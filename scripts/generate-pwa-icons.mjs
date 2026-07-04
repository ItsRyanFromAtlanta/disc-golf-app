import sharp from 'sharp'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const standard = readFileSync(new URL('../public/icon-source.svg', import.meta.url))
const maskable = readFileSync(new URL('../public/icon-source-maskable.svg', import.meta.url))

const targets = [
  { input: standard, size: 192, out: 'public/pwa-192x192.png' },
  { input: standard, size: 512, out: 'public/pwa-512x512.png' },
  { input: maskable, size: 512, out: 'public/pwa-maskable-512x512.png' },
  { input: standard, size: 180, out: 'public/apple-touch-icon.png' },
]

for (const { input, size, out } of targets) {
  await sharp(input).resize(size, size).png().toFile(fileURLToPath(new URL(`../${out}`, import.meta.url)))
  console.log(`wrote ${out}`)
}
