import * as dotenv from "dotenv";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "./config/env";
import * as relations from "./drizzle/relations";
import * as schema from "./drizzle/schema";

dotenv.config();

/**
 * Main connection pool for interactive queries (API requests, real-time operations)
 * - Higher max connections for concurrent user requests
 * - Lower idle timeout to free connections quickly
 */
const interactivePool = new Pool({
  connectionString: env.databaseUrl,
  max: 20, // Max connections for interactive queries
  idleTimeoutMillis: 30000, // 30 seconds idle timeout
  connectionTimeoutMillis: 5000, // 5 seconds connection timeout
});

/**
 * Separate connection pool for batch jobs (exports, migrations, heavy operations)
 * - Fewer connections to prevent blocking interactive queries
 * - Higher idle timeout for long-running operations
 */
const batchPool = new Pool({
  connectionString: env.databaseUrl,
  max: 5, // Fewer connections for batch jobs
  idleTimeoutMillis: 600000, // 10 minutes idle timeout for long operations
  connectionTimeoutMillis: 10000, // 10 seconds connection timeout
});

// Main database instance for interactive queries
export const db = drizzle(interactivePool, {
  schema: { ...schema, ...relations },
});

// Database instance for batch operations (exports, heavy queries)
export const batchDb = drizzle(batchPool, {
  schema: { ...schema, ...relations },
});

export type Database = typeof db;
