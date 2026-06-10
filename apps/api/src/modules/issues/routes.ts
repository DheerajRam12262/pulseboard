import type { ActivityType } from "@pulseboard/shared";
import { createCommentSchema, moveIssueSchema, updateIssueSchema } from "@pulseboard/shared";
import { asc, desc, eq } from "drizzle-orm";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { activities, comments, issueLabels, issues, users } from "../../db/schema.js";
import { recordActivity } from "../../lib/activity.js";
import { errors } from "../../lib/errors.js";
import { requireProjectAccess } from "../../lib/guards.js";
import { toActivityDTO, toCommentDTO } from "../../lib/serializers.js";
import { assertAssigneeIsMember, filterProjectLabelIds } from "../projects/routes.js";
import { computeMoveRank, loadIssueDTO } from "./service.js";

const idParams = z.object({ id: z.string().uuid() });

function socketId(req: FastifyRequest): string | null {
  const value = req.headers["x-socket-id"];
  return typeof value === "string" ? value : null;
}

export default async function issueRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  async function getIssueWithAccess(req: FastifyRequest, issueId: string, minRole?: "admin") {
    const [issue] = await app.db.select().from(issues).where(eq(issues.id, issueId)).limit(1);
    if (!issue) throw errors.notFound("Issue");
    const access = await requireProjectAccess(app.db, issue.projectId, req.user.id, minRole);
    return { issue, access };
  }

  app.get("/issues/:id", async (req) => {
    const { id } = idParams.parse(req.params);
    await getIssueWithAccess(req, id);
    const issue = await loadIssueDTO(app.db, id);
    if (!issue) throw errors.notFound("Issue");
    return { issue };
  });

  app.patch("/issues/:id", async (req) => {
    const { id } = idParams.parse(req.params);
    const input = updateIssueSchema.parse(req.body);
    const { issue: existing, access } = await getIssueWithAccess(req, id);

    if (input.assigneeId) {
      await assertAssigneeIsMember(app.db, access.project.workspaceId, input.assigneeId);
    }

    const changes: { type: ActivityType; data: Record<string, unknown> }[] = [];
    if (input.title !== undefined && input.title !== existing.title) {
      changes.push({ type: "title_changed", data: { from: existing.title, to: input.title } });
    }
    if (input.description !== undefined && input.description !== existing.description) {
      changes.push({ type: "description_changed", data: {} });
    }
    if (input.status !== undefined && input.status !== existing.status) {
      changes.push({ type: "status_changed", data: { from: existing.status, to: input.status } });
    }
    if (input.priority !== undefined && input.priority !== existing.priority) {
      changes.push({
        type: "priority_changed",
        data: { from: existing.priority, to: input.priority },
      });
    }
    if (input.assigneeId !== undefined && input.assigneeId !== existing.assigneeId) {
      changes.push({ type: "assignee_changed", data: { to: input.assigneeId } });
    }

    await app.db.transaction(async (tx) => {
      const { labelIds, ...fields } = input;
      if (Object.keys(fields).length > 0 || labelIds !== undefined) {
        await tx
          .update(issues)
          .set({ ...fields, updatedAt: new Date() })
          .where(eq(issues.id, id));
      }
      if (labelIds !== undefined) {
        const valid = await filterProjectLabelIds(app.db, existing.projectId, labelIds);
        await tx.delete(issueLabels).where(eq(issueLabels.issueId, id));
        if (valid.length > 0) {
          await tx.insert(issueLabels).values(valid.map((labelId) => ({ issueId: id, labelId })));
        }
        changes.push({ type: "labels_changed", data: {} });
      }
    });

    for (const change of changes) {
      await recordActivity(app.db, {
        projectId: existing.projectId,
        issueId: id,
        actorId: req.user.id,
        type: change.type,
        data: change.data,
      });
    }

    const issue = await loadIssueDTO(app.db, id);
    if (!issue) throw errors.notFound("Issue");
    app.rt.emit(
      existing.projectId,
      "issue:updated",
      { projectId: existing.projectId, issue },
      socketId(req),
    );
    return { issue };
  });

  app.post("/issues/:id/move", async (req) => {
    const { id } = idParams.parse(req.params);
    const input = moveIssueSchema.parse(req.body);
    const { issue: existing } = await getIssueWithAccess(req, id);

    const rank = await computeMoveRank(app.db, {
      projectId: existing.projectId,
      status: input.status,
      beforeIssueId: input.beforeIssueId,
      afterIssueId: input.afterIssueId,
    });

    await app.db
      .update(issues)
      .set({ status: input.status, rank, updatedAt: new Date() })
      .where(eq(issues.id, id));

    if (input.status !== existing.status) {
      await recordActivity(app.db, {
        projectId: existing.projectId,
        issueId: id,
        actorId: req.user.id,
        type: "status_changed",
        data: { from: existing.status, to: input.status },
      });
    }

    const issue = await loadIssueDTO(app.db, id);
    if (!issue) throw errors.notFound("Issue");
    app.rt.emit(
      existing.projectId,
      "issue:updated",
      { projectId: existing.projectId, issue },
      socketId(req),
    );
    return { issue };
  });

  app.delete("/issues/:id", async (req, reply) => {
    const { id } = idParams.parse(req.params);
    const { issue } = await getIssueWithAccess(req, id);
    await app.db.delete(issues).where(eq(issues.id, id));
    app.rt.emit(
      issue.projectId,
      "issue:deleted",
      { projectId: issue.projectId, issueId: id },
      socketId(req),
    );
    return reply.code(204).send();
  });

  app.get("/issues/:id/comments", async (req) => {
    const { id } = idParams.parse(req.params);
    await getIssueWithAccess(req, id);
    const rows = await app.db
      .select({
        comment: comments,
        author: { id: users.id, name: users.name, avatarColor: users.avatarColor },
      })
      .from(comments)
      .leftJoin(users, eq(comments.authorId, users.id))
      .where(eq(comments.issueId, id))
      .orderBy(asc(comments.createdAt));
    return { comments: rows.map((r) => toCommentDTO(r.comment, r.author)) };
  });

  app.post("/issues/:id/comments", async (req, reply) => {
    const { id } = idParams.parse(req.params);
    const input = createCommentSchema.parse(req.body);
    const { issue } = await getIssueWithAccess(req, id);

    const [row] = await app.db
      .insert(comments)
      .values({ issueId: id, authorId: req.user.id, body: input.body })
      .returning();
    if (!row) throw new Error("Comment insert returned no row");

    await recordActivity(app.db, {
      projectId: issue.projectId,
      issueId: id,
      actorId: req.user.id,
      type: "comment_added",
      data: { excerpt: input.body.slice(0, 80) },
    });

    const [author] = await app.db
      .select({ id: users.id, name: users.name, avatarColor: users.avatarColor })
      .from(users)
      .where(eq(users.id, req.user.id))
      .limit(1);
    const comment = toCommentDTO(row, author ?? null);

    app.rt.emit(
      issue.projectId,
      "comment:created",
      { projectId: issue.projectId, issueId: id, comment },
      socketId(req),
    );
    return reply.code(201).send({ comment });
  });

  app.delete("/comments/:id", async (req, reply) => {
    const { id } = idParams.parse(req.params);
    const [row] = await app.db.select().from(comments).where(eq(comments.id, id)).limit(1);
    if (!row) throw errors.notFound("Comment");

    const [issue] = await app.db
      .select()
      .from(issues)
      .where(eq(issues.id, row.issueId))
      .limit(1);
    if (!issue) throw errors.notFound("Issue");

    const access = await requireProjectAccess(app.db, issue.projectId, req.user.id);
    const isAuthor = row.authorId === req.user.id;
    const isAdmin = access.role === "admin" || access.role === "owner";
    if (!isAuthor && !isAdmin) throw errors.forbidden("Only the author or an admin can delete");

    await app.db.delete(comments).where(eq(comments.id, id));
    app.rt.emit(
      issue.projectId,
      "comment:deleted",
      { projectId: issue.projectId, issueId: issue.id, commentId: id },
      socketId(req),
    );
    return reply.code(204).send();
  });

  app.get("/issues/:id/activity", async (req) => {
    const { id } = idParams.parse(req.params);
    await getIssueWithAccess(req, id);
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
      .where(eq(activities.issueId, id))
      .orderBy(desc(activities.createdAt))
      .limit(50);
    return { activity: rows.map(toActivityDTO) };
  });
}
