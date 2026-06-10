"use client";

import type { ClientToServerEvents, ServerToClientEvents } from "@pulseboard/shared";
import { io, type Socket } from "socket.io-client";
import { API_URL, getAccessToken, setSocketId } from "./api";

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: AppSocket | null = null;

export function connectSocket(): AppSocket {
  if (socket) return socket;
  socket = io(API_URL, {
    transports: ["websocket"],
    // auth is a function so reconnects always grab the current token
    auth: (cb) => cb({ token: getAccessToken() ?? "" }),
  });
  socket.on("connect", () => setSocketId(socket?.id ?? null));
  socket.on("disconnect", () => setSocketId(null));
  return socket;
}

export function getSocket(): AppSocket | null {
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
  setSocketId(null);
}
