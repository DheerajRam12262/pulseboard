import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import { ZodError } from "zod";
import type { AppConfig } from "./config.js";
import type { Database } from "./db/client.js";
import { AppError, errors } from "./lib/errors.js";
import { verifyAccessToken } from "./lib/tokens.js";
import authRoutes from "./modules/auth/routes.js";
import issueRoutes from "./modules/issues/routes.js";
import projectRoutes from "./modules/projects/routes.js";
import searchRoutes from "./modules/search/routes.js";
import workspaceRoutes from "./modules/workspaces/routes.js";
import { noopRealtime, setupRealtime } from "./realtime/index.js";
import type { AuthUser } from "./types.js";

export interface BuildAppOptions {
  db: Database;
  config: AppConfig;
  // off in tests - app.inject never opens a real server for sockets to attach to
  withRealtime?: boolean;
}

export async function buildApp({
  db,
  config,
  withRealtime = true,
}: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger:
      config.nodeEnv === "test"
        ? false
        : config.nodeEnv === "development"
          ? { transport: { target: "pino-pretty" } }
          : true,
    trustProxy: true,
  });

  app.decorate("db", db);
  app.decorate("config", config);
  app.decorateRequest("user", null as unknown as AuthUser);

  await app.register(cors, { origin: config.webOrigins, credentials: true });
  await app.register(cookie);
  await app.register(rateLimit, { max: 300, timeWindow: "1 minute" });

  app.decorate("authenticate", async (req: FastifyRequest) => {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
    const payload = token ? await verifyAccessToken(token, config.jwtSecret) : null;
    if (!payload) throw errors.unauthorized();
    req.user = { id: payload.sub, email: payload.email, name: payload.name };
  });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({
        error: { code: "VALIDATION_ERROR", message: "Invalid request", details: err.flatten() },
      });
    }
    if (err instanceof AppError) {
      return reply
        .code(err.statusCode)
        .send({ error: { code: err.code, message: err.message, details: err.details } });
    }
    // fastify's own errors (429 from the rate limiter, malformed json, etc)
    const fastifyErr = err as { statusCode?: number; code?: string; message?: string };
    if (typeof fastifyErr.statusCode === "number" && fastifyErr.statusCode < 500) {
      return reply.code(fastifyErr.statusCode).send({
        error: { code: fastifyErr.code ?? "REQUEST_ERROR", message: fastifyErr.message ?? "" },
      });
    }
    req.log.error({ err }, "unhandled error");
    return reply
      .code(500)
      .send({ error: { code: "INTERNAL_ERROR", message: "Something went wrong" } });
  });

  app.setNotFoundHandler((_req, reply) => {
    reply.code(404).send({ error: { code: "NOT_FOUND", message: "Route not found" } });
  });

  app.decorate("rt", withRealtime ? setupRealtime(app) : noopRealtime);

  app.get("/health", async () => ({ status: "ok", uptime: process.uptime() }));

  await app.register(authRoutes, { prefix: "/api/auth" });
  await app.register(workspaceRoutes, { prefix: "/api" });
  await app.register(projectRoutes, { prefix: "/api" });
  await app.register(issueRoutes, { prefix: "/api" });
  await app.register(searchRoutes, { prefix: "/api" });

  return app;
}
