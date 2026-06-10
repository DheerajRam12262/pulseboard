import "fastify";
import type { AppConfig } from "./config.js";
import type { Database } from "./db/client.js";
import type { Realtime } from "./realtime/index.js";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

declare module "fastify" {
  interface FastifyInstance {
    db: Database;
    config: AppConfig;
    rt: Realtime;
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    user: AuthUser;
  }
}
