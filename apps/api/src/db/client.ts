import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";

// written against node-postgres; tests cast a pglite-backed drizzle instance
// to this same type since the query api is identical
export type Database = NodePgDatabase<typeof schema>;

export function createDb(databaseUrl: string): { db: Database; pool: pg.Pool } {
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    max: 10,
    // neon (and most hosted postgres) wants TLS
    ssl: databaseUrl.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined,
  });
  const db = drizzle(pool, { schema });
  return { db, pool };
}

export { schema };
