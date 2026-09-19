import { createApp } from './app'
import { setRuntimeEnv, type WorkerEnv } from './shared/lib/runtime-env'

// ─── Workers Entrypoint ─────────────────────────────────────────────────────
// Bindings arrive as `env`. Push them into the runtime store BEFORE first
// request so getEnv() resolves inside handlers. App constructed lazily:
// module top-level has no env access, and createApp() reads CORS origins
// at construction time.

let app: ReturnType<typeof createApp> | null = null

export default {
  fetch(request: Request, env: WorkerEnv) {
    setRuntimeEnv(env as Record<string, unknown>)
    if (!app) app = createApp()
    return app.fetch(request)
  },

  // Keepalive: Supabase pauses the database after 7 days of inactivity
  // (free tier, 10-30s cold start after). One cheap anon SELECT per day
  // via cron trigger (wrangler.jsonc) keeps it warm.
  async scheduled(_event: ScheduledController, env: WorkerEnv, ctx: ExecutionContext) {
    const url = `${env.SUPABASE_URL}/rest/v1/products?select=id&limit=1`
    await ctx.waitUntil(
      fetch(url, { headers: { apikey: env.SUPABASE_ANON_KEY ?? '' } })
    )
  },
}
