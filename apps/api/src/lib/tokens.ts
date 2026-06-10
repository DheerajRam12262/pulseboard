import { createHash, randomBytes } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";

export interface AccessTokenPayload {
  sub: string;
  email: string;
  name: string;
}

export async function signAccessToken(
  payload: AccessTokenPayload,
  secret: string,
  ttlSec: number,
): Promise<string> {
  return new SignJWT({ email: payload.email, name: payload.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttlSec)
    .sign(new TextEncoder().encode(secret));
}

export async function verifyAccessToken(
  token: string,
  secret: string,
): Promise<AccessTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    if (!payload.sub) return null;
    return {
      sub: payload.sub,
      email: String(payload.email ?? ""),
      name: String(payload.name ?? ""),
    };
  } catch {
    return null;
  }
}

// opaque token - only its sha256 ever touches the database
export function generateRefreshToken(): { token: string; hash: string } {
  const token = randomBytes(48).toString("base64url");
  return { token, hash: hashRefreshToken(token) };
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
