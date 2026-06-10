import type { CommentDTO, IssueDTO, UserLite } from "./types";

export interface PresenceUser extends UserLite {
  // how many sockets this user has in the room (multiple tabs count as one person)
  connections: number;
}

// server -> clients subscribed to a project room
export interface ServerToClientEvents {
  "issue:created": (payload: { projectId: string; issue: IssueDTO }) => void;
  "issue:updated": (payload: { projectId: string; issue: IssueDTO }) => void;
  "issue:deleted": (payload: { projectId: string; issueId: string }) => void;
  "comment:created": (payload: { projectId: string; issueId: string; comment: CommentDTO }) => void;
  "comment:deleted": (payload: { projectId: string; issueId: string; commentId: string }) => void;
  "presence:state": (payload: { projectId: string; users: PresenceUser[] }) => void;
}

// client -> server
export interface ClientToServerEvents {
  "project:join": (projectId: string, ack: (ok: boolean) => void) => void;
  "project:leave": (projectId: string) => void;
}

export const projectRoom = (projectId: string) => `project:${projectId}`;
