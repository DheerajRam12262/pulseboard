import type { LabelDTO } from "@pulseboard/shared";
import { createIssueSchema, createLabelSchema } from "@pulseboard/shared";
import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Database } from "../../db/client.js";
import { activities, issues, labels, projects, users, workspaceMembers } from "../../db/schema.js";
import { recordActivity } from "../../lib/activity.js";
import { errors } from "../../lib/errors.js";
import { requireProjectAccess } from "../../lib/guards.js";
import { toActivityDTO } from "../../lib/serializers.js";
import { createIssue, loadIssueDTO, loadIssueDTOs } from "../issues/service.js";
import { toProjectDTO } from "../workspaces/routes.js";

const idParams = z.object({ id: z.string().uuid() });

export async function assertAssigneeIsMember(
  db: Database,
  workspaceId: string,
  assigneeId: string,
): Promise<void> {
  const [member] = await db
    .select({ userId: workspaceMembers.userId })
    .from(workspaceMembers)
    .where(
      and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, assigneeId)),
    )
    .limit(1);
  if (!member) throw errors.badRequest("Assignee must be a member of the workspace");
}

// never trust client label ids - keep only the ones that belong to this project
export async function filterProjectLabelIds(
  db: Database,
  projectId: string,
  labelIds: string[],
): Promise<string[]> {
  if (labelIds.length === 0) return [];
  const rows = await db
    .select({ id: labels.id })
    .from(labels)
    .where(and(eq(labels.projectId, projectId), inArray(labels.id, labelIds)));
  return rows.map((r) => r.id);
}

export default async function projectRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/projects/:id", async (req) => {
    const { id } = idParams.parse(req.params);
    const { project } = await requireProjectAccess(app.db, id, req.user.id);
    const [row] = await app.db
      .select({ n: count() })
      .from(issues)
      .where(eq(issues.projectId, id));
    return { project: toProjectDTO(project, Number(row?.n ?? 0)) };
  });

  app.delete("/projects/:id", async (req, reply) => {
    const { id } = idParams.parse(req.params);
    await requireProjectAccess(app.db, id, req.user.id, "admin");
    await app.db.delete(projects).where(eq(projects.id, id));
    return reply.code(204).send();
  });

  app.get("/projects/:id/issues", async (req) => {
    const { id } = idParams.parse(req.params);
    await requireProjectAccess(app.db, id, req.user.id);
    // TODO: paginate per column once boards get big enough to care
    return { issues: await loadIssueDTOs(app.db, { projectId: id }) };
  });

  app.post("/projects/:id/issues", async (req, reply) => {
    const { id } = idParams.parse(req.params);
    const input = createIssueSchema.parse(req.body);
    const { project } = await requireProjectAccess(app.db, id, req.user.id);

    if (input.assigneeId) {
      await assertAssigneeIsMember(app.db, project.workspaceId, input.assigneeId);
    }
    if (input.labelIds) {
      input.labelIds = await filterProjectLabelIds(app.db, id, input.labelIds);
    }

    const issueId = await createIssue(app.db, {
      projectId: id,
      reporterId: req.user.id,
      input,
    });
    await recordActivity(app.db, {
      projectId: id,
      issueId,
      actorId: req.user.id,
      type: "issue_created",
      data: { title: input.title },
    });

    const issue = await loadIssueDTO(app.db, issueId);
    if (!issue) throw new Error("Issue vanished after creation");

    const socketId = (req.headers["x-socket-id"] as string | undefined) ?? null;
    app.rt.emit(id, "issue:created", { projectId: id, issue }, socketId);

    return reply.code(201).send({ issue });
  });

  app.get("/projects/:id/activity", async (req) => {
    const { id } = idParams.parse(req.params);
    await requireProjectAccess(app.db, id, req.user.id);
    const rows = await app.db
      .select({
        id: activities.id,
        issueId: activities.issueId,
        type: activities.type,
        data: activities.data,
        createdAt: activities.createdAt,
        actor: { id: users.id, name: users.name, avatarColor: users.avatarColor },
      })
      .from(activities)
      .leftJoin(users, eq(activities.actorId, users.id))
      .where(eq(activities.projectId, id))
      .orderBy(desc(activities.createdAt))
      .limit(50);
    return { activity: rows.map(toActivityDTO) };
  });

  app.get("/projects/:id/labels", async (req) => {
    const { id } = idParams.parse(req.params);
    await requireProjectAccess(app.db, id, req.user.id);
    const rows = await app.db
      .select({ id: labels.id, name: labels.name, color: labels.color })
      .from(labels)
      .where(eq(labels.projectId, id))
      .orderBy(asc(labels.name));
    return { labels: rows satisfies LabelDTO[] };
  });

  app.post("/projects/:id/labels", async (req, reply) => {
    const { id } = idParams.parse(req.params);
    const input = createLabelSchema.parse(req.body);
    await requireProjectAccess(app.db, id, req.user.id);

    const [duplicate] = await app.db
      .select({ id: labels.id })
      .from(labels)
      .where(and(eq(labels.projectId, id), eq(labels.name, input.name)))
      .limit(1);
    if (duplicate) throw errors.conflict("LABEL_EXISTS", "A label with that name already exists");

    const [label] = await app.db
      .insert(labels)
      .values({ projectId: id, name: input.name, color: input.color })
      .returning({ id: labels.id, name: labels.name, color: labels.color });
    return reply.code(201).send({ label });
  });
}
