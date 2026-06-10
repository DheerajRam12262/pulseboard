import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  authHeaders,
  createTestApp,
  createWorkspaceAndProject,
  registerUser,
  type TestContext,
  type TestSession,
} from "./helpers.js";

describe("issues and board flow", () => {
  let ctx: TestContext;
  let owner: TestSession;
  let outsider: TestSession;
  let workspaceId: string;
  let projectId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    owner = await registerUser(ctx.app, { email: "owner@test.dev", name: "Owner" });
    outsider = await registerUser(ctx.app, { email: "outsider@test.dev", name: "Outsider" });
    ({ workspaceId, projectId } = await createWorkspaceAndProject(ctx.app, owner));
  });

  afterAll(async () => {
    await ctx.close();
  });

  async function createIssue(title: string, status = "todo") {
    const res = await ctx.app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/issues`,
      headers: authHeaders(owner),
      payload: { title, status },
    });
    expect(res.statusCode).toBe(201);
    return res.json().issue as { id: string; number: number; rank: string; status: string };
  }

  it("creates issues with sequential per-project numbers", async () => {
    const first = await createIssue("Set up CI");
    const second = await createIssue("Design landing page");
    expect(first.number).toBe(1);
    expect(second.number).toBe(2);
  });

  it("hides the project from non-members (404, not 403)", async () => {
    const res = await ctx.app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/issues`,
      headers: authHeaders(outsider),
    });
    expect(res.statusCode).toBe(404);
  });

  it("moves an issue between columns and keeps rank ordering", async () => {
    const a = await createIssue("Issue A", "in_progress");
    const b = await createIssue("Issue B", "in_progress");
    const c = await createIssue("Issue C", "in_progress");

    // Move C between A and B.
    const move = await ctx.app.inject({
      method: "POST",
      url: `/api/issues/${c.id}/move`,
      headers: authHeaders(owner),
      payload: { status: "in_progress", beforeIssueId: a.id, afterIssueId: b.id },
    });
    expect(move.statusCode).toBe(200);
    const movedRank = move.json().issue.rank as string;
    expect(movedRank > a.rank).toBe(true);
    expect(movedRank < b.rank).toBe(true);

    // Board ordering reflects ranks.
    const board = await ctx.app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/issues`,
      headers: authHeaders(owner),
    });
    const inProgress = (board.json().issues as { id: string; status: string }[]).filter(
      (i) => i.status === "in_progress",
    );
    expect(inProgress.map((i) => i.id)).toEqual([a.id, c.id, b.id]);
  });

  it("moves an issue to another column and records activity", async () => {
    const issue = await createIssue("Ship it", "todo");
    const move = await ctx.app.inject({
      method: "POST",
      url: `/api/issues/${issue.id}/move`,
      headers: authHeaders(owner),
      payload: { status: "done" },
    });
    expect(move.statusCode).toBe(200);
    expect(move.json().issue.status).toBe("done");

    const activity = await ctx.app.inject({
      method: "GET",
      url: `/api/issues/${issue.id}/activity`,
      headers: authHeaders(owner),
    });
    const types = (activity.json().activity as { type: string }[]).map((a) => a.type);
    expect(types).toContain("status_changed");
    expect(types).toContain("issue_created");
  });

  it("updates fields and tracks the diff", async () => {
    const issue = await createIssue("Rename me");
    const res = await ctx.app.inject({
      method: "PATCH",
      url: `/api/issues/${issue.id}`,
      headers: authHeaders(owner),
      payload: { title: "Renamed", priority: "high" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().issue.title).toBe("Renamed");
    expect(res.json().issue.priority).toBe("high");
  });

  it("supports comments with live counts", async () => {
    const issue = await createIssue("Discuss approach");
    const comment = await ctx.app.inject({
      method: "POST",
      url: `/api/issues/${issue.id}/comments`,
      headers: authHeaders(owner),
      payload: { body: "I think we should use fractional indexing." },
    });
    expect(comment.statusCode).toBe(201);
    expect(comment.json().comment.author.name).toBe("Owner");

    const detail = await ctx.app.inject({
      method: "GET",
      url: `/api/issues/${issue.id}`,
      headers: authHeaders(owner),
    });
    expect(detail.json().issue.commentCount).toBe(1);
  });

  it("adds a member who then gains access", async () => {
    const add = await ctx.app.inject({
      method: "POST",
      url: `/api/workspaces/${workspaceId}/members`,
      headers: authHeaders(owner),
      payload: { email: "outsider@test.dev", role: "member" },
    });
    expect(add.statusCode).toBe(201);

    const res = await ctx.app.inject({
      method: "GET",
      url: `/api/projects/${projectId}/issues`,
      headers: authHeaders(outsider),
    });
    expect(res.statusCode).toBe(200);
  });

  it("finds issues via full-text search", async () => {
    await createIssue("Implement webhook retries with exponential backoff");
    const res = await ctx.app.inject({
      method: "GET",
      url: `/api/search?workspaceId=${workspaceId}&q=${encodeURIComponent("webhook retries")}`,
      headers: authHeaders(owner),
    });
    expect(res.statusCode).toBe(200);
    const titles = (res.json().results as { title: string }[]).map((r) => r.title);
    expect(titles.some((t) => t.includes("webhook retries"))).toBe(true);
  });

  it("validates input with helpful errors", async () => {
    const res = await ctx.app.inject({
      method: "POST",
      url: `/api/projects/${projectId}/issues`,
      headers: authHeaders(owner),
      payload: { title: "" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("VALIDATION_ERROR");
  });
});
