// ─── Runtime Env ────────────────────────────────────────────────────────────
// Workers have no process.env by default. Bindings arrive as the `env`
// argument of fetch(). workers-entry.ts pushes them here via setRuntimeEnv()
// before first request. Everything else reads through getEnv(), which falls
// back to process.env for `tsx` node dev. One lookup path, both runtimes.
// Env is constant per Worker isolate, so module-level storage is safe.

export interface WorkerEnv {
  SUPABASE_URL?: string
  SUPABASE_ANON_KEY?: string
  SUPABASE_SERVICE_ROLE_KEY?: string
  AES_SECRET_KEY?: string
  CORS_ALLOWED_ORIGINS?: string
  PAYMENT_APP_BASE_URL?: string
  PAYMENT_ACTIVE_PROVIDER?: string
  PAYMENT_DEFAULT_EXPIRY_MINUTES?: string
  PAYMENT_SUMOPOD_API_KEY?: string
  PAYMENT_SUMOPOD_BASE_URL?: string
  PAYMENT_SUMOPOD_METHOD_CODE?: string
  PAYMENT_SUMOPOD_WEBHOOK_SECRET?: string
  PAYMENT_SUMOPOD_WEBHOOK_TOKEN?: string
  PAYMENT_SUMOPOD_CAPTURE?: string
  PAYMENT_DUITKU_MERCHANT_CODE?: string
  PAYMENT_DUITKU_API_KEY?: string
  PAYMENT_DUITKU_BASE_URL?: string
  ENV?: string
}

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
