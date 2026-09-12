// ─── check-secrets ──────────────────────────────────────────────────────────
// Pre-deploy guard: verifies every required Worker secret exists in the
// secret store for the target env before `wrangler deploy` runs.
// Usage: node scripts/check-secrets.mjs production|staging
// Requires CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID in CI, or an
// authenticated `wrangler login` session locally.

import { execSync } from 'node:child_process'

const env = process.argv[2]
if (env !== 'production' && env !== 'staging') {
  console.error('Usage: node scripts/check-secrets.mjs production|staging')
  process.exit(1)
}

// Fixed command strings per env: argv never interpolates into a shell
// command, so there is no injection surface by construction.
const SECRET_LIST_CMD = {
  production: 'npx wrangler secret list --env production',
  staging: 'npx wrangler secret list --env staging',
}

// Secrets the Worker throws on at runtime if missing (see runtime-env.ts,
// shared/db/index.ts, modules/vault/vault.service.ts, modules/orders).
// Payment provider keys are intentionally excluded: with
// PAYMENT_ACTIVE_PROVIDER=manual (current default) no provider key is needed.
const REQUIRED = ['SUPABASE_SERVICE_ROLE_KEY', 'AES_SECRET_KEY']

let raw
try {
  // shell:true so npx resolves on both cmd.exe and POSIX shells.
  raw = execSync(SECRET_LIST_CMD[env], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
} catch {
  console.error(`[check-secrets] cannot list secrets for --env ${env}.`)
  console.error('Authenticate first: `wrangler login` locally, or set CLOUDFLARE_API_TOKEN in CI.')
  process.exit(1)
}

let stored
try {
  stored = new Set(JSON.parse(raw).map((s) => s.name))
} catch {
  console.error('[check-secrets] unexpected `wrangler secret list` output (expected JSON).')
  process.exit(1)
}

const missing = REQUIRED.filter((k) => !stored.has(k))
if (missing.length > 0) {
  console.error(`[check-secrets] --env ${env} missing required secrets: ${missing.join(', ')}`)
  console.error(`Fix: wrangler secret put <NAME> --env ${env}`)
  process.exit(1)
}

console.log(`[check-secrets] --env ${env} OK (${REQUIRED.length} required secrets present).`)

// Production vars must never trust dev origins. A bare `wrangler deploy`
// footgun or a bad vars edit could ship ngrok/localhost CORS to prod, so
// assert the resolved production bindings are clean via a dry run.
if (env === 'production') {
  let plan
  try {
    plan = execSync('npx wrangler deploy --dry-run --env production', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch {
    console.error('[check-secrets] production dry-run failed, cannot verify CORS vars.')
    process.exit(1)
  }
  const corsLine = plan.split('\n').find((l) => l.includes('CORS_ALLOWED_ORIGINS')) ?? ''
  if (/ngrok|localhost|127\.0\.0\.1|192\.168/.test(corsLine)) {
    console.error(`[check-secrets] production CORS polluted with dev origin: ${corsLine.trim()}`)
    process.exit(1)
  }
  console.log('[check-secrets] production CORS clean (no dev origins).')
}
