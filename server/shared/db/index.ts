import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required')
}

// postgres.js client with PgBouncer transaction pooler compatibility
// prepare: false is MANDATORY — PgBouncer does not support prepared statements
// max: 1 for serverless — one connection per request
const client = postgres(process.env.DATABASE_URL, {
  prepare: false,
  max: 1,
})

export const db = drizzle(client, { schema })
