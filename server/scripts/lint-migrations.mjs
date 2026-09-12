// ─── lint-migrations ────────────────────────────────────────────────────────
// Offline CI lint over Drizzle SQL migrations. Fails on destructive patterns
// that need human review before they reach production. Runs with plain node,
// no database connection required.
// Usage: node scripts/lint-migrations.mjs

import { readdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'db', 'migrations')

// pattern -> allowlist of files where it is reviewed and accepted.
const RULES = [
  {
    // 0006 drops a temporary probe table it created earlier in the same file.
    pattern: /DROP\s+TABLE/i,
    allow: ['0006_audit_actor_backfill.sql'],
  },
  { pattern: /DROP\s+COLUMN/i, allow: ['0009_drop_avatar_url.sql'] },
  { pattern: /TRUNCATE/i, allow: [] },
  { pattern: /DISABLE\s+ROW\s+LEVEL\s+SECURITY/i, allow: ['0006_audit_actor_backfill.sql'] },
]

const files = readdirSync(dir).filter((f) => f.endsWith('.sql'))
if (files.length === 0) {
  console.error('[lint-migrations] no .sql files found.')
  process.exit(1)
}

let failures = 0
for (const file of files) {
  const sql = readFileSync(join(dir, file), 'utf8')
  for (const { pattern, allow } of RULES) {
    if (pattern.test(sql) && !allow.includes(file)) {
      console.error(`[lint-migrations] ${file}: matches ${pattern} (not allowlisted).`)
      failures += 1
    }
  }
}

if (failures > 0) process.exit(1)
console.log(`[lint-migrations] OK (${files.length} migration files clean).`)
