import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required')
}

// postgres.js client with PgBouncer transaction pooler compatibility
// prepare: false is MANDATORY — PgBouncer does not support prepared statements
// max: 10 allows concurrent admin dashboard requests (was 1, caused GET hang on parallel stats)
const client = postgres(process.env.DATABASE_URL, {
  prepare: false,
  max: 10,
})

export const db = drizzle(client, { schema })
