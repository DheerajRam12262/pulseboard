import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { FastifyInstance } from "fastify";
import { fileURLToPath } from "node:url";
import { buildApp } from "../src/app.js";
import type { AppConfig } from "../src/config.js";
import type { Database } from "../src/db/client.js";
import * as schema from "../src/db/schema.js";

export const testConfig: AppConfig = {
  nodeEnv: "test",
  port: 0,
  host: "127.0.0.1",
  databaseUrl: "pglite://in-memory",
  jwtSecret: "integration-test-secret-at-least-32-chars-long",
  webOrigins: ["http://localhost:3000"],
  cookieSecure: false,
  accessTokenTtlSec: 900,
  refreshTokenTtlSec: 30 * 24 * 60 * 60,
};

export interface TestContext {
  app: FastifyInstance;
  db: Database;
  close: () => Promise<void>;
}

// full app wired to an in-memory postgres, real migrations applied
export async function createTestApp(): Promise<TestContext> {
  const client = new PGlite();
  const pgliteDb = drizzle(client, { schema });
  await migrate(pgliteDb, {
    migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)),
  });
  const db = pgliteDb as unknown as Database;
  const app = await buildApp({ db, config: testConfig, withRealtime: false });
  await app.ready();
  return {
    app,
    db,
    close: async () => {
      await app.close();
      await client.close();
    },
  };
}

export interface TestSession {
  accessToken: string;
  refreshCookie: string;
  user: { id: string; email: string; name: string };
}

export async function registerUser(
  app: FastifyInstance,
  overrides: Partial<{ email: string; name: string; password: string }> = {},
): Promise<TestSession> {
  const email = overrides.email ?? `user-${Math.random().toString(36).slice(2, 10)}@test.dev`;
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: {
      email,
      name: overrides.name ?? "Test User",
      password: overrides.password ?? "hunter2hunter2",
    },
  });
  if (res.statusCode !== 201) {
    throw new Error(`register failed: ${res.statusCode} ${res.body}`);
  }
  const body = res.json() as { accessToken: string; user: TestSession["user"] };
  const cookie = res.cookies.find((c) => c.name === "pb_refresh");
  return {
    accessToken: body.accessToken,
    refreshCookie: cookie?.value ?? "",
    user: body.user,
  };
}

export function authHeaders(session: TestSession): Record<string, string> {
  return { authorization: `Bearer ${session.accessToken}` };
}

// workspace + project in one go, returns both ids
export async function createWorkspaceAndProject(
  app: FastifyInstance,
  session: TestSession,
): Promise<{ workspaceId: string; projectId: string }> {
  const wsRes = await app.inject({
    method: "POST",
    url: "/api/workspaces",
    headers: authHeaders(session),
    payload: { name: "Acme Inc" },
  });
  if (wsRes.statusCode !== 201) throw new Error(`workspace failed: ${wsRes.body}`);
  const workspaceId = (wsRes.json() as { workspace: { id: string } }).workspace.id;

  const projRes = await app.inject({
    method: "POST",
    url: `/api/workspaces/${workspaceId}/projects`,
    headers: authHeaders(session),
    payload: { name: "Apollo", key: "APO" },
  });
  if (projRes.statusCode !== 201) throw new Error(`project failed: ${projRes.body}`);
  const projectId = (projRes.json() as { project: { id: string } }).project.id;

  return { workspaceId, projectId };
}
