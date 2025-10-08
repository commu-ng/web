import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as relations from "../drizzle/relations";
import type * as schema from "../drizzle/schema";

// Using a compatible type for both Pool and PoolClient based drizzle instances
type DatabaseSchema = typeof schema & typeof relations;

// This mock is used during tests
// testDb will be set by the test setup
export let db: NodePgDatabase<DatabaseSchema>;

export function setTestDb(testDbInstance: NodePgDatabase<DatabaseSchema>) {
  db = testDbInstance;
}
