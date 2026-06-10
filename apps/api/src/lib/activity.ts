import type { ActivityType } from "@pulseboard/shared";
import type { Database } from "../db/client.js";
import { activities } from "../db/schema.js";

export async function recordActivity(
  db: Database,
  entry: {
    projectId: string;
    issueId?: string | null;
    actorId: string;
    type: ActivityType;
    data?: Record<string, unknown>;
  },
): Promise<void> {
  await db.insert(activities).values({
    projectId: entry.projectId,
    issueId: entry.issueId ?? null,
    actorId: entry.actorId,
    type: entry.type,
    data: entry.data ?? {},
  });
}
