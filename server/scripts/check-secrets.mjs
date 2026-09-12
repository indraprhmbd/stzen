// ─── check-secrets ──────────────────────────────────────────────────────────
// Pre-deploy guard: verifies every required Worker secret exists in the
// secret store for the target env before `wrangler deploy` runs.
// Usage: node scripts/check-secrets.mjs production|staging
// Requires CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID in CI, or an
// authenticated `wrangler login` session locally.

import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

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
// Provider keys are added dynamically below when the target env actually
// activates a gateway provider (fail-closed: manual needs nothing).
const REQUIRED = ['SUPABASE_SERVICE_ROLE_KEY', 'AES_SECRET_KEY']

// Read PAYMENT_ACTIVE_PROVIDER for the target env out of wrangler.jsonc so
// the guard tracks the config instead of a second hardcoded list. Anchor on
// the env KEY (`"staging": {`), not any `"staging"` value (e.g. ENV vars).
function activeProvider(fileText, env) {
  const keyRe = new RegExp(`"${env}"\\s*:\\s*\\{`)
  const m = keyRe.exec(fileText)
  if (!m) return null
  const pm = /"PAYMENT_ACTIVE_PROVIDER"\s*:\s*"([a-z]+)"/.exec(fileText.slice(m.index))
  return pm ? pm[1] : null
}

const PROVIDER_SECRETS = {
  sumopod: ['PAYMENT_SUMOPOD_API_KEY'],
  duitku: ['PAYMENT_DUITKU_MERCHANT_CODE', 'PAYMENT_DUITKU_API_KEY'],
}

let fileText = ''
try {
  fileText = readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8')
} catch {}
const provider = activeProvider(fileText, env)
if (provider && PROVIDER_SECRETS[provider]) {
  REQUIRED.push(...PROVIDER_SECRETS[provider])
}
console.log(`[check-secrets] --env ${env} active provider: ${provider ?? 'unknown (default manual)'}`)

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
