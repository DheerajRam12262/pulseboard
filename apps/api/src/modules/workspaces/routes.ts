import type { ProjectDTO, WorkspaceDTO, WorkspaceMemberDTO } from "@pulseboard/shared";
import {
  addMemberSchema,
  createProjectSchema,
  createWorkspaceSchema,
  randomColor,
} from "@pulseboard/shared";
import { randomBytes } from "node:crypto";
import { and, asc, count, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { issues, labels, projects, users, workspaceMembers, workspaces } from "../../db/schema.js";
import { errors } from "../../lib/errors.js";
import { requireWorkspaceRole } from "../../lib/guards.js";

const idParams = z.object({ id: z.string().uuid() });
const memberParams = z.object({ id: z.string().uuid(), userId: z.string().uuid() });

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 30);
  return `${base || "workspace"}-${randomBytes(3).toString("hex")}`;
}

const DEFAULT_LABELS = [
  { name: "bug", color: "#f43f5e" },
  { name: "feature", color: "#6366f1" },
  { name: "improvement", color: "#14b8a6" },
];

export function toProjectDTO(
  row: typeof projects.$inferSelect,
  issueCount: number,
): ProjectDTO {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    key: row.key,
    description: row.description,
    color: row.color,
    issueCount,
    createdAt: row.createdAt.toISOString(),
  };
}

export default async function workspaceRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/workspaces", async (req): Promise<{ workspaces: WorkspaceDTO[] }> => {
    const rows = await app.db
      .select({ workspace: workspaces, role: workspaceMembers.role })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
      .where(eq(workspaceMembers.userId, req.user.id))
      .orderBy(asc(workspaces.createdAt));
    return {
      workspaces: rows.map(({ workspace, role }) => ({
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        role,
        createdAt: workspace.createdAt.toISOString(),
      })),
    };
  });

  app.post("/workspaces", async (req, reply) => {
    const input = createWorkspaceSchema.parse(req.body);
    const workspace = await app.db.transaction(async (tx) => {
      const [ws] = await tx
        .insert(workspaces)
        .values({ name: input.name, slug: slugify(input.name) })
        .returning();
      if (!ws) throw new Error("Workspace insert returned no row");
      await tx
        .insert(workspaceMembers)
        .values({ workspaceId: ws.id, userId: req.user.id, role: "owner" });
      return ws;
    });
    const dto: WorkspaceDTO = {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      role: "owner",
      createdAt: workspace.createdAt.toISOString(),
    };
    return reply.code(201).send({ workspace: dto });
  });

  app.get("/workspaces/:id", async (req) => {
    const { id } = idParams.parse(req.params);
    const role = await requireWorkspaceRole(app.db, id, req.user.id);
    const [ws] = await app.db.select().from(workspaces).where(eq(workspaces.id, id)).limit(1);
    if (!ws) throw errors.notFound("Workspace");
    const dto: WorkspaceDTO = {
      id: ws.id,
      name: ws.name,
      slug: ws.slug,
      role,
      createdAt: ws.createdAt.toISOString(),
    };
    return { workspace: dto };
  });

  app.get("/workspaces/:id/members", async (req) => {
    const { id } = idParams.parse(req.params);
    await requireWorkspaceRole(app.db, id, req.user.id);
    const rows = await app.db
      .select({
        userId: users.id,
        name: users.name,
        email: users.email,
        avatarColor: users.avatarColor,
        role: workspaceMembers.role,
      })
      .from(workspaceMembers)
      .innerJoin(users, eq(workspaceMembers.userId, users.id))
      .where(eq(workspaceMembers.workspaceId, id))
      .orderBy(asc(workspaceMembers.createdAt));
    return { members: rows satisfies WorkspaceMemberDTO[] };
  });

  app.post("/workspaces/:id/members", async (req, reply) => {
    const { id } = idParams.parse(req.params);
    const input = addMemberSchema.parse(req.body);
    await requireWorkspaceRole(app.db, id, req.user.id, "admin");

    const [target] = await app.db
      .select()
      .from(users)
      .where(eq(users.email, input.email))
      .limit(1);
    if (!target) {
      throw errors.notFound("No PulseBoard account with that email — ask them to sign up first.");
    }

    const [existing] = await app.db
      .select({ userId: workspaceMembers.userId })
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, id), eq(workspaceMembers.userId, target.id)))
      .limit(1);
    if (existing) throw errors.conflict("ALREADY_MEMBER", "That user is already a member");

    await app.db
      .insert(workspaceMembers)
      .values({ workspaceId: id, userId: target.id, role: input.role });

    const member: WorkspaceMemberDTO = {
      userId: target.id,
      name: target.name,
      email: target.email,
      avatarColor: target.avatarColor,
      role: input.role,
    };
    return reply.code(201).send({ member });
  });

  app.delete("/workspaces/:id/members/:userId", async (req, reply) => {
    const { id, userId } = memberParams.parse(req.params);
    await requireWorkspaceRole(app.db, id, req.user.id, "admin");

    const [target] = await app.db
      .select({ role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, id), eq(workspaceMembers.userId, userId)))
      .limit(1);
    if (!target) throw errors.notFound("Member");
    if (target.role === "owner") throw errors.forbidden("The workspace owner cannot be removed");

    await app.db
      .delete(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, id), eq(workspaceMembers.userId, userId)));
    return reply.code(204).send();
  });

  app.get("/workspaces/:id/projects", async (req) => {
    const { id } = idParams.parse(req.params);
    await requireWorkspaceRole(app.db, id, req.user.id);
    const rows = await app.db
      .select({ project: projects, issueCount: count(issues.id) })
      .from(projects)
      .leftJoin(issues, eq(issues.projectId, projects.id))
      .where(eq(projects.workspaceId, id))
      .groupBy(projects.id)
      .orderBy(asc(projects.createdAt));
    return { projects: rows.map((r) => toProjectDTO(r.project, Number(r.issueCount))) };
  });

  app.post("/workspaces/:id/projects", async (req, reply) => {
    const { id } = idParams.parse(req.params);
    const input = createProjectSchema.parse(req.body);
    await requireWorkspaceRole(app.db, id, req.user.id);

    const [duplicate] = await app.db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.workspaceId, id), eq(projects.key, input.key)))
      .limit(1);
    if (duplicate) {
      throw errors.conflict("KEY_TAKEN", `Key "${input.key}" is already used in this workspace`);
    }

    const project = await app.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(projects)
        .values({
          workspaceId: id,
          name: input.name,
          key: input.key,
          description: input.description ?? null,
          color: input.color ?? randomColor(),
        })
        .returning();
      if (!row) throw new Error("Project insert returned no row");
      await tx
        .insert(labels)
        .values(DEFAULT_LABELS.map((l) => ({ ...l, projectId: row.id })));
      return row;
    });

    return reply.code(201).send({ project: toProjectDTO(project, 0) });
  });
}
