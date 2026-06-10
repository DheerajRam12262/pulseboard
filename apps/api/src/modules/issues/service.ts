import type { CreateIssueInput, IssueDTO } from "@pulseboard/shared";
import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { generateKeyBetween } from "fractional-indexing";
import type { Database } from "../../db/client.js";
import { comments, issueLabels, issues, labels, projects, users } from "../../db/schema.js";
import { toUserLite } from "../../lib/serializers.js";

const assigneeUsers = alias(users, "assignee_users");
const reporterUsers = alias(users, "reporter_users");

// hydrates issues (assignee, reporter, labels, comment counts) in three
// queries total, no matter how many issues we're loading
export async function loadIssueDTOs(
  db: Database,
  filter: { projectId?: string; issueIds?: string[] },
): Promise<IssueDTO[]> {
  if (filter.issueIds && filter.issueIds.length === 0) return [];

  const conditions = [];
  if (filter.projectId) conditions.push(eq(issues.projectId, filter.projectId));
  if (filter.issueIds) conditions.push(inArray(issues.id, filter.issueIds));

  const rows = await db
    .select({
      issue: issues,
      assignee: {
        id: assigneeUsers.id,
        name: assigneeUsers.name,
        avatarColor: assigneeUsers.avatarColor,
      },
      reporter: {
        id: reporterUsers.id,
        name: reporterUsers.name,
        avatarColor: reporterUsers.avatarColor,
      },
    })
    .from(issues)
    .leftJoin(assigneeUsers, eq(issues.assigneeId, assigneeUsers.id))
    .leftJoin(reporterUsers, eq(issues.reporterId, reporterUsers.id))
    .where(and(...conditions))
    .orderBy(asc(issues.rank), asc(issues.createdAt));

  const ids = rows.map((r) => r.issue.id);
  if (ids.length === 0) return [];

  const labelRows = await db
    .select({
      issueId: issueLabels.issueId,
      id: labels.id,
      name: labels.name,
      color: labels.color,
    })
    .from(issueLabels)
    .innerJoin(labels, eq(issueLabels.labelId, labels.id))
    .where(inArray(issueLabels.issueId, ids));

  const commentCounts = await db
    .select({ issueId: comments.issueId, n: count() })
    .from(comments)
    .where(inArray(comments.issueId, ids))
    .groupBy(comments.issueId);

  const labelsByIssue = new Map<string, { id: string; name: string; color: string }[]>();
  for (const row of labelRows) {
    const list = labelsByIssue.get(row.issueId) ?? [];
    list.push({ id: row.id, name: row.name, color: row.color });
    labelsByIssue.set(row.issueId, list);
  }
  const countByIssue = new Map(commentCounts.map((c) => [c.issueId, Number(c.n)]));

  return rows.map(({ issue, assignee, reporter }) => ({
    id: issue.id,
    projectId: issue.projectId,
    number: issue.number,
    title: issue.title,
    description: issue.description,
    status: issue.status,
    priority: issue.priority,
    rank: issue.rank,
    assignee: toUserLite(assignee),
    reporter: toUserLite(reporter),
    labels: labelsByIssue.get(issue.id) ?? [],
    commentCount: countByIssue.get(issue.id) ?? 0,
    createdAt: issue.createdAt.toISOString(),
    updatedAt: issue.updatedAt.toISOString(),
  }));
}

export async function loadIssueDTO(db: Database, issueId: string): Promise<IssueDTO | null> {
  const [dto] = await loadIssueDTOs(db, { issueIds: [issueId] });
  return dto ?? null;
}

// a rank that sorts after everything currently in the column
async function rankAtColumnEnd(
  db: Database,
  projectId: string,
  status: string,
): Promise<string> {
  const [last] = await db
    .select({ rank: issues.rank })
    .from(issues)
    .where(and(eq(issues.projectId, projectId), eq(issues.status, status as never)))
    .orderBy(desc(issues.rank))
    .limit(1);
  return generateKeyBetween(last?.rank ?? null, null);
}

export async function createIssue(
  db: Database,
  args: { projectId: string; reporterId: string; input: CreateIssueInput },
): Promise<string> {
  const { projectId, reporterId, input } = args;

  return db.transaction(async (tx) => {
    // bump the counter atomically so two concurrent creates can't get the same number
    const [counter] = await tx
      .update(projects)
      .set({ issueCounter: sql`${projects.issueCounter} + 1` })
      .where(eq(projects.id, projectId))
      .returning({ value: projects.issueCounter });
    if (!counter) throw new Error("Project disappeared during issue creation");

    const rank = await rankAtColumnEnd(tx as unknown as Database, projectId, input.status);

    const [issue] = await tx
      .insert(issues)
      .values({
        projectId,
        number: counter.value,
        title: input.title,
        description: input.description ?? null,
        status: input.status,
        priority: input.priority,
        assigneeId: input.assigneeId ?? null,
        reporterId,
        rank,
      })
      .returning({ id: issues.id });
    if (!issue) throw new Error("Issue insert failed");

    if (input.labelIds && input.labelIds.length > 0) {
      await tx
        .insert(issueLabels)
        .values(input.labelIds.map((labelId) => ({ issueId: issue.id, labelId })));
    }
    return issue.id;
  });
}

// beforeIssueId/afterIssueId are the cards above and below the drop slot, from
// the client's (possibly stale) view of the board. anything that already left
// the target column gets ignored, and if the rank math still fails we just put
// the card at the bottom.
export async function computeMoveRank(
  db: Database,
  args: {
    projectId: string;
    status: string;
    beforeIssueId?: string | null;
    afterIssueId?: string | null;
  },
): Promise<string> {
  const neighborIds = [args.beforeIssueId, args.afterIssueId].filter(
    (id): id is string => typeof id === "string",
  );
  let beforeRank: string | null = null;
  let afterRank: string | null = null;

  if (neighborIds.length > 0) {
    const neighbors = await db
      .select({ id: issues.id, rank: issues.rank, status: issues.status })
      .from(issues)
      .where(and(eq(issues.projectId, args.projectId), inArray(issues.id, neighborIds)));
    for (const n of neighbors) {
      if (n.status !== args.status) continue; // moved away since the client looked
      if (n.id === args.beforeIssueId) beforeRank = n.rank;
      if (n.id === args.afterIssueId) afterRank = n.rank;
    }
  }

  try {
    return generateKeyBetween(beforeRank, afterRank);
  } catch {
    return rankAtColumnEnd(db, args.projectId, args.status);
  }
}
