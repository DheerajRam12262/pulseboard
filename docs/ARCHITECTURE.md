# PulseBoard Architecture

This document explains the non-obvious design decisions. The codebase is a pnpm/Turborepo monorepo with three packages:

- `packages/shared` — Zod schemas, DTO types, and socket event contracts. Both apps import from here, so the API and UI can never disagree about a payload shape.
- `apps/api` — Fastify 5 + Socket.IO + Drizzle ORM.
- `apps/web` — Next.js 15 App Router client.

## Authentication

Access tokens are 15-minute HS256 JWTs (`jose`), held **in memory only** on the client — never in localStorage, so XSS can't exfiltrate a persisted credential. Sessions survive reloads via a 30-day **refresh token** in an httpOnly cookie scoped to `/api/auth`.

Refresh flow (`apps/api/src/modules/auth/routes.ts`):

1. Only the SHA-256 hash of a refresh token is stored (`refresh_tokens.token_hash`), so a database leak doesn't leak usable tokens.
2. Every `/api/auth/refresh` **rotates**: the presented token is revoked and a new one is issued.
3. **Reuse detection**: if a *revoked* token is presented again, someone is replaying a stolen token — all active sessions for that user are revoked immediately. This mirrors the OAuth 2.0 Security BCP's refresh-token rotation guidance.

Concurrent 401s on the client share a single-flight refresh (`apps/web/src/lib/api.ts`), then retry once.

In production the web (Vercel) and API (Render) live on different sites, so the cookie ships `SameSite=None; Secure`. In dev, `localhost:3000 → localhost:4000` is same-site, so `Lax` suffices; this is driven by `COOKIE_SECURE`.

## Multi-tenancy & authorization

Hierarchy: **user → workspace (role) → project → issue**. Every route resolves the resource up to its workspace and checks membership in one join (`requireProjectAccess`). Two deliberate choices:

- Non-members receive **404, not 403**, for workspaces/projects — ids aren't probeable.
- Cross-tenant references are filtered server-side: label ids are intersected with the project's labels, assignees must be workspace members.

## Board ordering under concurrency

Naive `position: integer` ordering needs O(n) renumbering per move and corrupts under concurrent writes. PulseBoard stores a **fractional index** (`rank: text`, via the `fractional-indexing` package): the key for a position between neighbors A and B is a string strictly between them, so

- a move is a **single-row UPDATE**;
- two users reordering the same column concurrently produce distinct, valid orderings (last-writer-wins per card, never a corrupted column).

The client sends `{ status, beforeIssueId, afterIssueId }` (its view of the drop neighbors). The server re-reads those neighbors' ranks — ignoring any that have since left the target column — and computes the canonical rank, falling back to bottom-of-column if the neighbors are stale. The client computes the same rank optimistically for zero-flicker drags; the server response then overwrites it.

## Realtime design

Socket.IO namespaces aren't used; instead each project is a **room** (`project:{id}`).

- The handshake is authenticated with the JWT (`io.use` middleware); joining a room re-checks workspace membership against the database — a socket can't subscribe to a project it can't read.
- After a successful REST mutation, the route broadcasts the hydrated DTO to the project room. The mutation request carries the client's socket id in an `x-socket-id` header and the broadcast uses `.except(socketId)`, so the **acting client never receives its own echo** (it already applied the change optimistically).
- Presence is an in-memory `projectId → userId → socket set` map, broadcast on join/leave/disconnect. Multiple tabs from one user collapse into one presence entry.

Consciously deferred for single-instance deployment: the Socket.IO Redis adapter and a Redis-backed presence map would make this horizontally scalable; the seams (`Realtime` interface in `apps/api/src/realtime/index.ts`) are in place.

## Search

`/api/search` runs Postgres full-text search: `to_tsvector('english', title || ' ' || coalesce(description, '')) @@ websearch_to_tsquery(...)`, with an ILIKE fallback for short/partial tokens. A custom migration adds an **expression GIN index** using the identical expression so the planner can use it. Scoped to one workspace and gated by membership.

## Error handling

All errors converge in one Fastify `setErrorHandler` to a single envelope `{ error: { code, message, details? } }`:

- `ZodError` → 400 `VALIDATION_ERROR` with flattened field issues
- `AppError` (domain) → its status/code (`EMAIL_TAKEN`, `KEY_TAKEN`, …)
- Fastify-generated (rate limit, bad JSON) → passed through
- everything else → logged, opaque 500

## Testing strategy

Integration tests boot the **entire Fastify app** against **PGlite** (in-process WASM Postgres) with the real drizzle-kit migrations applied — real enums, FK cascades, unique constraints, and tsvector behavior, zero containers. Requests go through `app.inject()`, so routing, validation, auth hooks, and serialization are all exercised. The suite covers token rotation/reuse, permission boundaries, move-rank ordering, comment counts, and search.

The same embedded-Postgres trick powers `pnpm dev:demo`, letting anyone run the full stack with nothing but Node installed.

## Scaling path

Current free-tier deployment is a single API instance. The path to N instances:

1. Socket.IO Redis adapter (`@socket.io/redis-adapter`) for cross-instance broadcasts; presence moves to Redis hashes.
2. `@fastify/rate-limit` already accepts a Redis store — swap the in-memory default.
3. Postgres is the system of record throughout; no instance-local state blocks horizontal scaling besides the above.
4. Read-heavy boards could add keyset pagination + `updated_at` cursors; the board query is already index-covered (`project_id, status, rank`).
