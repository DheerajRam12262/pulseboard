import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp, registerUser, type TestContext } from "./helpers.js";

describe("auth", () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.close();
  });

  it("registers a user and returns a session", async () => {
    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email: "ada@test.dev", name: "Ada Lovelace", password: "correct-horse-1" },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.user.email).toBe("ada@test.dev");
    expect(body.accessToken).toBeTruthy();
    expect(res.cookies.some((c) => c.name === "pb_refresh" && c.httpOnly)).toBe(true);
  });

  it("rejects duplicate emails", async () => {
    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email: "ada@test.dev", name: "Imposter", password: "correct-horse-1" },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe("EMAIL_TAKEN");
  });

  it("rejects invalid credentials", async () => {
    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "ada@test.dev", password: "wrong-password" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("logs in with valid credentials", async () => {
    const res = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "ada@test.dev", password: "correct-horse-1" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().accessToken).toBeTruthy();
  });

  it("returns the current user from /me", async () => {
    const session = await registerUser(ctx.app, { email: "me@test.dev" });
    const res = await ctx.app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { authorization: `Bearer ${session.accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.email).toBe("me@test.dev");
  });

  it("rejects requests without a token", async () => {
    const res = await ctx.app.inject({ method: "GET", url: "/api/auth/me" });
    expect(res.statusCode).toBe(401);
  });

  it("rotates refresh tokens and detects reuse", async () => {
    const session = await registerUser(ctx.app, { email: "rotate@test.dev" });

    // First refresh: succeeds and rotates the token.
    const first = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/refresh",
      cookies: { pb_refresh: session.refreshCookie },
    });
    expect(first.statusCode).toBe(200);
    const rotated = first.cookies.find((c) => c.name === "pb_refresh");
    expect(rotated?.value).toBeTruthy();
    expect(rotated?.value).not.toBe(session.refreshCookie);

    // Replaying the original (now revoked) token must fail...
    const replay = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/refresh",
      cookies: { pb_refresh: session.refreshCookie },
    });
    expect(replay.statusCode).toBe(401);

    // ...and reuse detection revokes the whole session family.
    const afterReuse = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/refresh",
      cookies: { pb_refresh: rotated!.value },
    });
    expect(afterReuse.statusCode).toBe(401);
  });
});
