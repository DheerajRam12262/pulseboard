import type { ActivityDTO, ActivityType, CommentDTO, UserDTO, UserLite } from "@pulseboard/shared";
import type { comments, users } from "../db/schema.js";

type UserRow = typeof users.$inferSelect;
type CommentRow = typeof comments.$inferSelect;

export function toUserDTO(row: UserRow): UserDTO {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    avatarColor: row.avatarColor,
    createdAt: row.createdAt.toISOString(),
  };
}

export interface UserLiteRow {
  id: string | null;
  name: string | null;
  avatarColor: string | null;
}

export function toUserLite(row: UserLiteRow | null | undefined): UserLite | null {
  if (!row || row.id == null) return null;
  return { id: row.id, name: row.name ?? "", avatarColor: row.avatarColor ?? "#64748b" };
}

export function toCommentDTO(row: CommentRow, author: UserLiteRow | null): CommentDTO {
  return {
    id: row.id,
    issueId: row.issueId,
    body: row.body,
    author: toUserLite(author),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toActivityDTO(row: {
  id: string;
  issueId: string | null;
  type: string;
  data: unknown;
  createdAt: Date;
  actor: UserLiteRow | null;
}): ActivityDTO {
  return {
    id: row.id,
    issueId: row.issueId,
    type: row.type as ActivityType,
    data: (row.data ?? {}) as Record<string, unknown>,
    actor: toUserLite(row.actor),
    createdAt: row.createdAt.toISOString(),
  };
}
