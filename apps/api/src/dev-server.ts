// zero-setup dev mode: full api on an embedded in-memory postgres (pglite),
// migrations applied. no docker, no DATABASE_URL. data resets on restart -
// use `pnpm dev` with a real postgres if you want anything to stick around.
//
//   pnpm --filter @pulseboard/api dev:demo
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { fileURLToPath } from "node:url";
import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import type { Database } from "./db/client.js";
import * as schema from "./db/schema.js";

const client = new PGlite();
const pgliteDb = drizzle(client, { schema });
await migrate(pgliteDb, {
  migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)),
});

const config = loadConfig({
  ...process.env,
  DATABASE_URL: "embedded://pglite",
  JWT_SECRET: process.env.JWT_SECRET ?? "insecure-demo-secret-do-not-use-in-production",
});

const app = await buildApp({ db: pgliteDb as unknown as Database, config });
await app.listen({ port: config.port, host: config.host });
app.log.info("demo mode: embedded in-memory Postgres (data resets on restart)");
