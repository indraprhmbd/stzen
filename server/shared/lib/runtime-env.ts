// ─── Runtime Env ────────────────────────────────────────────────────────────
// Workers have no process.env by default. Bindings arrive as the `env`
// argument of fetch(). workers-entry.ts pushes them here via setRuntimeEnv()
// before first request. Everything else reads through getEnv(), which falls
// back to process.env for `tsx` node dev. One lookup path, both runtimes.
// Env is constant per Worker isolate, so module-level storage is safe.

export interface SecretKeys {
  SUPABASE_SERVICE_ROLE_KEY?: string
  AES_SECRET_KEY?: string
  GCAL_SA_JSON?: string
  PAYMENT_SUMOPOD_API_KEY?: string
  PAYMENT_SUMOPOD_WEBHOOK_SECRET?: string
  PAYMENT_SUMOPOD_WEBHOOK_TOKEN?: string
  PAYMENT_SUMOPOD_CAPTURE?: string
  PAYMENT_DUITKU_MERCHANT_CODE?: string
  PAYMENT_DUITKU_API_KEY?: string
}

// Var keys come from wrangler.jsonc via `wrangler types` (regenerate after
// config edits). The generated file declares a global Env (script, no exports),
// referenced directly below. Secret keys are declared here because the secret
// store is invisible to the type generator. Both stay visible to getEnv().
export interface WorkerEnv extends Partial<Env>, SecretKeys {}

const runtime: Record<string, string | undefined> = {}

export function setRuntimeEnv(env: Record<string, unknown>): void {
  for (const [k, v] of Object.entries(env)) {
    if (typeof v === 'string') runtime[k] = v
  }
}

export function getEnv(key: keyof WorkerEnv): string {
  return runtime[key as string] ?? process.env[key as string] ?? ''
}

export function isProd(): boolean {
  return getEnv('ENV') === 'production'
}
