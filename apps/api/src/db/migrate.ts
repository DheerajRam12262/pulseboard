import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDb } from "./client.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const { db, pool } = createDb(databaseUrl);

try {
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations applied");
} finally {
  await pool.end();
}
