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
}
