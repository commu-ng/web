/**
 * Test setup using PostgreSQL transactions with automatic rollback
 * Each test runs in its own transaction that is rolled back after the test
 *
 * Setup:
 * 1. Create test database: createdb commu_ng_test
 * 2. Set DATABASE_URL in .env.test
 * 3. Run migrations: DATABASE_URL=postgresql:///commu_ng_test pnpm db:migrate
 */

import * as dotenv from "dotenv";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool, type PoolClient } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach } from "vitest";
import { setTestDb } from "../__mocks__/db";
import * as relations from "../drizzle/relations";
import * as schema from "../drizzle/schema";

// Load test environment
dotenv.config({ path: ".env.test" });

type DatabaseSchema = typeof schema & typeof relations;

let pool: Pool;
let client: PoolClient;
export let testDb: NodePgDatabase<DatabaseSchema>;

export async function setupTestDatabase() {
  // Create connection pool
  pool = new Pool({
    connectionString: process.env.DATABASE_URL || "postgresql:///commu_ng_test",
  });

  return pool;
}

export async function beginTransaction() {
  // Get a dedicated client for this test
  client = await pool.connect();

  // Start transaction
  await client.query("BEGIN");

  // Create a drizzle instance using the transaction client
  testDb = drizzle(client, {
    schema: { ...schema, ...relations },
  });

  // Update the mock to use the transaction db
  setTestDb(testDb);

  return testDb;
}

export async function rollbackTransaction() {
  if (client) {
    // Rollback the transaction
    await client.query("ROLLBACK");
    // Release the client back to the pool
    client.release();
  }
}

export async function teardownTestDatabase() {
  await pool.end();
}

// Global setup/teardown hooks
beforeAll(async () => {
  await setupTestDatabase();
});

beforeEach(async () => {
  await beginTransaction();
});

afterEach(async () => {
  await rollbackTransaction();
});

afterAll(async () => {
  await teardownTestDatabase();
});
