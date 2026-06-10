import type { WorkspaceRole } from "@pulseboard/shared";
import { and, eq } from "drizzle-orm";
import type { Database } from "../db/client.js";
import { projects, workspaceMembers } from "../db/schema.js";
import { errors } from "./errors.js";

const ROLE_RANK: Record<WorkspaceRole, number> = { member: 1, admin: 2, owner: 3 };

export async function getWorkspaceRole(
  db: Database,
  workspaceId: string,
  userId: string,
): Promise<WorkspaceRole | null> {
  const [row] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
    .limit(1);
  return row?.role ?? null;
}

export async function requireWorkspaceRole(
  db: Database,
  workspaceId: string,
  userId: string,
  minRole: WorkspaceRole = "member",
): Promise<WorkspaceRole> {
  const role = await getWorkspaceRole(db, workspaceId, userId);
  // 404 on purpose: a 403 would confirm to an outsider that the workspace exists
  if (!role) throw errors.notFound("Workspace");
  if (ROLE_RANK[role] < ROLE_RANK[minRole]) throw errors.forbidden();
  return role;
}

export interface ProjectAccess {
  project: typeof projects.$inferSelect;
  role: WorkspaceRole;
}

export async function getProjectAccess(
  db: Database,
  projectId: string,
  userId: string,
): Promise<ProjectAccess | null> {
  const [row] = await db
    .select({ project: projects, role: workspaceMembers.role })
    .from(projects)
    .innerJoin(
      workspaceMembers,
      and(
        eq(workspaceMembers.workspaceId, projects.workspaceId),
        eq(workspaceMembers.userId, userId),
      ),
    )
    .where(eq(projects.id, projectId))
    .limit(1);
  return row ?? null;
}

export async function requireProjectAccess(
  db: Database,
  projectId: string,
  userId: string,
  minRole: WorkspaceRole = "member",
): Promise<ProjectAccess> {
  const access = await getProjectAccess(db, projectId, userId);
  if (!access) throw errors.notFound("Project");
  if (ROLE_RANK[access.role] < ROLE_RANK[minRole]) throw errors.forbidden();
  return access;
}
