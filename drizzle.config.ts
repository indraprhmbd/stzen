import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './server/db/schema.ts',
  out: './server/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    // Use DIRECT_URL (port 5432) for migrations - transaction pooler doesn't support DDL well
    url: process.env.DATABASE_DIRECT_URL!,
  },
})
