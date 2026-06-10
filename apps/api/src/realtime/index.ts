import type {
  ClientToServerEvents,
  PresenceUser,
  ServerToClientEvents,
  UserLite,
} from "@pulseboard/shared";
import { projectRoom } from "@pulseboard/shared";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { Server } from "socket.io";
import { users } from "../db/schema.js";
import { getProjectAccess } from "../lib/guards.js";
import { verifyAccessToken } from "../lib/tokens.js";

export interface Realtime {
  emit<E extends keyof ServerToClientEvents>(
    projectId: string,
    event: E,
    payload: Parameters<ServerToClientEvents[E]>[0],
    exceptSocketId?: string | null,
  ): void;
}

// tests run without sockets
export const noopRealtime: Realtime = { emit: () => {} };

interface SocketData {
  user: UserLite;
}

export function setupRealtime(app: FastifyInstance): Realtime {
  const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    Record<string, never>,
    SocketData
  >(app.server, {
    cors: { origin: app.config.webOrigins, credentials: true },
  });

  app.addHook("onClose", async () => {
    await io.close();
  });

  io.use(async (socket, next) => {
    const token: unknown = socket.handshake.auth?.token;
    const payload =
      typeof token === "string" ? await verifyAccessToken(token, app.config.jwtSecret) : null;
    if (!payload) return next(new Error("unauthorized"));
    const [user] = await app.db
      .select({ id: users.id, name: users.name, avatarColor: users.avatarColor })
      .from(users)
      .where(eq(users.id, payload.sub))
      .limit(1);
    if (!user) return next(new Error("unauthorized"));
    socket.data.user = user;
    next();
  });

  // projectId -> userId -> { user, socketIds }
  // TODO: lives in process memory, so this only works on a single instance.
  // move to redis (along with the socket.io adapter) if we ever scale out.
  const presence = new Map<string, Map<string, { user: UserLite; sockets: Set<string> }>>();

  function presenceList(projectId: string): PresenceUser[] {
    const room = presence.get(projectId);
    if (!room) return [];
    return [...room.values()].map(({ user, sockets }) => ({
      ...user,
      connections: sockets.size,
    }));
  }

  function broadcastPresence(projectId: string) {
    io.to(projectRoom(projectId)).emit("presence:state", {
      projectId,
      users: presenceList(projectId),
    });
  }

  function trackJoin(projectId: string, socketId: string, user: UserLite) {
    const room = presence.get(projectId) ?? new Map();
    const entry = room.get(user.id) ?? { user, sockets: new Set<string>() };
    entry.sockets.add(socketId);
    room.set(user.id, entry);
    presence.set(projectId, room);
  }

  function trackLeave(projectId: string, socketId: string, userId: string) {
    const room = presence.get(projectId);
    const entry = room?.get(userId);
    if (!room || !entry) return;
    entry.sockets.delete(socketId);
    if (entry.sockets.size === 0) room.delete(userId);
    if (room.size === 0) presence.delete(projectId);
  }

  io.on("connection", (socket) => {
    const user = socket.data.user;

    socket.on("project:join", async (projectId, ack) => {
      try {
        if (typeof projectId !== "string") return ack?.(false);
        // being logged in isn't enough - you have to be a member to listen in
        const access = await getProjectAccess(app.db, projectId, user.id);
        if (!access) return ack?.(false);
        await socket.join(projectRoom(projectId));
        trackJoin(projectId, socket.id, user);
        ack?.(true);
        broadcastPresence(projectId);
      } catch (err) {
        app.log.error({ err }, "project:join failed");
        ack?.(false);
      }
    });

    socket.on("project:leave", (projectId) => {
      if (typeof projectId !== "string") return;
      void socket.leave(projectRoom(projectId));
      trackLeave(projectId, socket.id, user.id);
      broadcastPresence(projectId);
    });

    socket.on("disconnecting", () => {
      for (const room of socket.rooms) {
        if (!room.startsWith("project:")) continue;
        const projectId = room.slice("project:".length);
        trackLeave(projectId, socket.id, user.id);
        // wait until the socket has actually left before broadcasting
        setImmediate(() => broadcastPresence(projectId));
      }
    });
  });

  return {
    emit(projectId, event, payload, exceptSocketId) {
      const op = exceptSocketId
        ? io.to(projectRoom(projectId)).except(exceptSocketId)
        : io.to(projectRoom(projectId));
      (op.emit as (ev: string, body: unknown) => void)(event, payload);
    },
  };
}
