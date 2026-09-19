// Bundle budget gate. Run AFTER `vite build`. Gzips every dist JS chunk and
// enforces per-chunk ceilings (worst regression: silent vendor bloat pushing
// the storefront main bundle over budget). Exit 1 prints offender + overage.
import { gzipSync } from 'node:zlib'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// Run from client/ (npm run build && node scripts/check-bundle.mjs).
const dist = join(process.cwd(), 'dist', 'assets')

// name-prefix -> max gzip KB
const BUDGETS = {
  'index': 90, // storefront entry (react, supabase client, layout, header)
  'vendor-charts': 130, // recharts + d3, admin Overview only
  'vendor-markdown': 60, // react-markdown + remark-gfm
}

const files = readdirSync(dist).filter((f) => f.endsWith('.js'))
if (files.length === 0) {
  console.error('check-bundle: no JS chunks found in', dist)
  process.exit(1)
}

let failed = false
const seen = new Set()
for (const f of files) {
  const name = f.replace(/-[A-Za-z0-9_-]{8}\.js$/, '')
  if (!(name in BUDGETS)) continue
  seen.add(name)
  const kb = gzipSync(readFileSync(join(dist, f))).length / 1024
  const limit = BUDGETS[name]
  const status = kb <= limit ? 'OK ' : 'OVER'
  if (kb > limit) failed = true
  console.log(`${status} ${name.padEnd(16)} ${kb.toFixed(1).padStart(7)} KB gzip / limit ${limit} KB`)
}

for (const missing of Object.keys(BUDGETS).filter((b) => !seen.has(b))) {
  console.error(`MISSING expected chunk '${missing}' — manualChunks renamed?`)
  failed = true
}

process.exit(failed ? 1 : 0)
