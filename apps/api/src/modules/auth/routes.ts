import type { AuthResponse } from "@pulseboard/shared";
import { loginSchema, randomColor, registerSchema } from "@pulseboard/shared";
import { and, eq, isNull } from "drizzle-orm";
import type { FastifyInstance, FastifyReply } from "fastify";
import type { AppConfig } from "../../config.js";
import { refreshTokens, users } from "../../db/schema.js";
import { errors } from "../../lib/errors.js";
import { hashPassword, verifyPassword } from "../../lib/passwords.js";
import { generateRefreshToken, hashRefreshToken, signAccessToken } from "../../lib/tokens.js";
import { toUserDTO } from "../../lib/serializers.js";

export const REFRESH_COOKIE = "pb_refresh";

function cookieOptions(config: AppConfig) {
  return {
    httpOnly: true,
    secure: config.cookieSecure,
    // prod serves web and api from different sites, so the cookie needs SameSite=None there
    sameSite: config.cookieSecure ? ("none" as const) : ("lax" as const),
    path: "/api/auth",
  };
}

const AUTH_RATE_LIMIT = { rateLimit: { max: 10, timeWindow: "1 minute" } };

export default async function authRoutes(app: FastifyInstance) {
  async function issueSession(
    reply: FastifyReply,
    user: typeof users.$inferSelect,
  ): Promise<AuthResponse> {
    const { token, hash } = generateRefreshToken();
    await app.db.insert(refreshTokens).values({
      userId: user.id,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + app.config.refreshTokenTtlSec * 1000),
    });
    reply.setCookie(REFRESH_COOKIE, token, {
      ...cookieOptions(app.config),
      maxAge: app.config.refreshTokenTtlSec,
    });
    const accessToken = await signAccessToken(
      { sub: user.id, email: user.email, name: user.name },
      app.config.jwtSecret,
      app.config.accessTokenTtlSec,
    );
    return { user: toUserDTO(user), accessToken };
  }

  function clearSessionCookie(reply: FastifyReply) {
    reply.clearCookie(REFRESH_COOKIE, cookieOptions(app.config));
  }

  app.post("/register", { config: AUTH_RATE_LIMIT }, async (req, reply) => {
    const input = registerSchema.parse(req.body);

    const [existing] = await app.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, input.email))
      .limit(1);
    if (existing) throw errors.conflict("EMAIL_TAKEN", "An account with this email already exists");

    const passwordHash = await hashPassword(input.password);
    const [user] = await app.db
      .insert(users)
      .values({
        email: input.email,
        name: input.name,
        passwordHash,
        avatarColor: randomColor(),
      })
      .returning();
    if (!user) throw new Error("User insert returned no row");

    return reply.code(201).send(await issueSession(reply, user));
  });

  app.post("/login", { config: AUTH_RATE_LIMIT }, async (req, reply) => {
    const input = loginSchema.parse(req.body);

    const [user] = await app.db.select().from(users).where(eq(users.email, input.email)).limit(1);
    // verify against a dummy hash even when the email is unknown, so response
    // timing doesn't reveal which emails have accounts
    const ok = await verifyPassword(input.password, user?.passwordHash ?? "scrypt:00:00");
    if (!user || !ok) throw errors.unauthorized("Invalid email or password");

    return reply.send(await issueSession(reply, user));
  });

  app.post("/refresh", async (req, reply) => {
    const raw = req.cookies[REFRESH_COOKIE];
    if (!raw) throw errors.unauthorized();

    const [row] = await app.db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, hashRefreshToken(raw)))
      .limit(1);

    if (!row) {
      clearSessionCookie(reply);
      throw errors.unauthorized();
    }

    if (row.revokedAt) {
      // this token was already rotated out once. someone is replaying it, so
      // assume theft and kill every session this user has.
      await app.db
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(refreshTokens.userId, row.userId), isNull(refreshTokens.revokedAt)));
      clearSessionCookie(reply);
      throw errors.unauthorized("Session invalidated, please sign in again");
    }

    if (row.expiresAt.getTime() < Date.now()) {
      clearSessionCookie(reply);
      throw errors.unauthorized("Session expired");
    }

    const [user] = await app.db.select().from(users).where(eq(users.id, row.userId)).limit(1);
    if (!user) {
      clearSessionCookie(reply);
      throw errors.unauthorized();
    }

    // rotate: the presented token dies here, a fresh one goes out below
    await app.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.id, row.id));

    return reply.send(await issueSession(reply, user));
  });

  app.post("/logout", async (req, reply) => {
    const raw = req.cookies[REFRESH_COOKIE];
    if (raw) {
      await app.db
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(eq(refreshTokens.tokenHash, hashRefreshToken(raw)));
    }
    clearSessionCookie(reply);
    return reply.code(204).send();
  });

  app.get("/me", { preHandler: [app.authenticate] }, async (req) => {
    const [user] = await app.db.select().from(users).where(eq(users.id, req.user.id)).limit(1);
    if (!user) throw errors.unauthorized();
    return { user: toUserDTO(user) };
  });
}
