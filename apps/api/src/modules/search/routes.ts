import type { SearchResultDTO } from "@pulseboard/shared";
import { searchQuerySchema } from "@pulseboard/shared";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { issues, projects } from "../../db/schema.js";
import { requireWorkspaceRole } from "../../lib/guards.js";

export default async function searchRoutes(app: FastifyInstance) {
  app.addHook("preHandler", app.authenticate);

  app.get("/search", async (req): Promise<{ results: SearchResultDTO[] }> => {
    const input = searchQuerySchema.parse(req.query);
    await requireWorkspaceRole(app.db, input.workspaceId, req.user.id);

    const escaped = input.q.replace(/[\\%_]/g, "\\$&");

    const rows = await app.db
      .select({
        issueId: issues.id,
        projectId: issues.projectId,
        projectKey: projects.key,
        projectName: projects.name,
        number: issues.number,
        title: issues.title,
        status: issues.status,
        priority: issues.priority,
      })
      .from(issues)
      .innerJoin(projects, eq(issues.projectId, projects.id))
      .where(
        and(
          eq(projects.workspaceId, input.workspaceId),
          or(
            // has to match the GIN index expression exactly or postgres won't use it
            sql`to_tsvector('english', ${issues.title} || ' ' || coalesce(${issues.description}, '')) @@ websearch_to_tsquery('english', ${input.q})`,
            ilike(issues.title, `%${escaped}%`),
          ),
        ),
      )
      .orderBy(desc(issues.updatedAt))
      .limit(20);

    return { results: rows };
  });
}
