"use client";

import type { ActivityDTO, UpdateIssueInput } from "@pulseboard/shared";
import {
  ISSUE_PRIORITIES,
  ISSUE_PRIORITY_LABELS,
  ISSUE_STATUSES,
  ISSUE_STATUS_LABELS,
} from "@pulseboard/shared";
import clsx from "clsx";
import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { timeAgo } from "@/lib/format";
import {
  useAddComment,
  useComments,
  useDeleteComment,
  useDeleteIssue,
  useIssue,
  useIssueActivity,
  useLabels,
  useMembers,
  useUpdateIssue,
} from "@/hooks/queries";
import { Avatar, Badge, Button, Dialog, Label, Select, Spinner, Textarea } from "./ui";

function describeActivity(entry: ActivityDTO): string {
  const data = entry.data as Record<string, string | undefined>;
  switch (entry.type) {
    case "issue_created":
      return "created this issue";
    case "title_changed":
      return `renamed the issue to "${data.to ?? ""}"`;
    case "description_changed":
      return "updated the description";
    case "status_changed":
      return `moved ${data.from ?? "?"} → ${data.to ?? "?"}`;
    case "priority_changed":
      return `set priority to ${data.to ?? "?"}`;
    case "assignee_changed":
      return "changed the assignee";
    case "labels_changed":
      return "updated labels";
    case "comment_added":
      return "commented";
    default:
      return entry.type;
  }
}

export function IssueDialog({
  issueId,
  projectId,
  workspaceId,
  onClose,
}: {
  issueId: string | null;
  projectId: string;
  workspaceId: string;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const { data: issue, isLoading } = useIssue(issueId);
  const { data: comments = [] } = useComments(issueId);
  const { data: activity = [] } = useIssueActivity(issueId);
  const { data: members = [] } = useMembers(workspaceId);
  const { data: labels = [] } = useLabels(projectId);

  const updateIssue = useUpdateIssue(projectId);
  const deleteIssue = useDeleteIssue(projectId);
  const addComment = useAddComment(projectId);
  const deleteComment = useDeleteComment();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [commentBody, setCommentBody] = useState("");
  const [tab, setTab] = useState<"comments" | "activity">("comments");

  useEffect(() => {
    if (issue) {
      setTitle(issue.title);
      setDescription(issue.description ?? "");
    }
  }, [issue?.id, issue?.title, issue?.description]);

  if (!issueId) return null;

  const patch = (body: UpdateIssueInput) => updateIssue.mutate({ issueId, ...body });

  return (
    <Dialog open onClose={onClose} wide>
      {isLoading || !issue ? (
        <div className="flex h-48 items-center justify-center">
          <Spinner />
        </div>
      ) : (
        <div className="flex flex-col gap-0 md:flex-row">
          {/* Main panel */}
          <div className="min-w-0 flex-1 p-6">
            <p className="mb-2 text-xs font-medium text-ink-faint">Issue #{issue.number}</p>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => {
                const trimmed = title.trim();
                if (trimmed && trimmed !== issue.title) patch({ title: trimmed });
              }}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              className="w-full bg-transparent text-lg font-semibold text-ink focus:outline-none"
            />
            <div className="mt-4">
              <Label>Description</Label>
              <Textarea
                rows={4}
                placeholder="Add a description…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={() => {
                  const next = description.trim() === "" ? null : description;
                  if (next !== (issue.description ?? null)) patch({ description: next });
                }}
              />
            </div>

            {/* Tabs */}
            <div className="mt-6 flex gap-4 border-b border-edge">
              {(["comments", "activity"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={clsx(
                    "cursor-pointer pb-2 text-sm capitalize transition-colors",
                    tab === t
                      ? "border-b-2 border-accent text-ink"
                      : "text-ink-faint hover:text-ink-dim",
                  )}
                >
                  {t} {t === "comments" && comments.length > 0 && `(${comments.length})`}
                </button>
              ))}
            </div>

            {tab === "comments" ? (
              <div className="mt-4 space-y-4">
                {comments.map((comment) => (
                  <div key={comment.id} className="group flex gap-2.5">
                    <Avatar
                      name={comment.author?.name ?? "Unknown"}
                      color={comment.author?.avatarColor ?? "#64748b"}
                      size={26}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-ink-dim">
                        <span className="font-medium text-ink">
                          {comment.author?.name ?? "Unknown"}
                        </span>{" "}
                        · {timeAgo(comment.createdAt)}
                        {comment.author?.id === user?.id && (
                          <button
                            onClick={() =>
                              deleteComment.mutate({ commentId: comment.id, issueId })
                            }
                            className="ml-2 hidden cursor-pointer text-red-400 group-hover:inline"
                          >
                            delete
                          </button>
                        )}
                      </p>
                      <p className="mt-0.5 text-sm whitespace-pre-wrap text-ink">{comment.body}</p>
                    </div>
                  </div>
                ))}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const body = commentBody.trim();
                    if (!body) return;
                    addComment.mutate(
                      { issueId, body },
                      { onSuccess: () => setCommentBody("") },
                    );
                  }}
                >
                  <Textarea
                    rows={2}
                    placeholder="Leave a comment…"
                    value={commentBody}
                    onChange={(e) => setCommentBody(e.target.value)}
                  />
                  <div className="mt-2 flex justify-end">
                    <Button size="sm" type="submit" loading={addComment.isPending}>
                      Comment
                    </Button>
                  </div>
                </form>
              </div>
            ) : (
              <ul className="mt-4 space-y-3">
                {activity.map((entry) => (
                  <li key={entry.id} className="flex items-center gap-2.5 text-sm">
                    <Avatar
                      name={entry.actor?.name ?? "Unknown"}
                      color={entry.actor?.avatarColor ?? "#64748b"}
                      size={20}
                    />
                    <span className="text-ink-dim">
                      <span className="text-ink">{entry.actor?.name ?? "Someone"}</span>{" "}
                      {describeActivity(entry)}
                    </span>
                    <span className="ml-auto shrink-0 text-xs text-ink-faint">
                      {timeAgo(entry.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Sidebar */}
          <div className="w-full shrink-0 space-y-4 border-t border-edge bg-surface-2/40 p-6 md:w-60 md:border-t-0 md:border-l">
            <div>
              <Label>Status</Label>
              <Select
                value={issue.status}
                onChange={(e) => patch({ status: e.target.value as typeof issue.status })}
              >
                {ISSUE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {ISSUE_STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Priority</Label>
              <Select
                value={issue.priority}
                onChange={(e) => patch({ priority: e.target.value as typeof issue.priority })}
              >
                {ISSUE_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {ISSUE_PRIORITY_LABELS[p]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Assignee</Label>
              <Select
                value={issue.assignee?.id ?? ""}
                onChange={(e) => patch({ assigneeId: e.target.value || null })}
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Labels</Label>
              <div className="flex flex-wrap gap-1.5">
                {labels.map((label) => {
                  const selected = issue.labels.some((l) => l.id === label.id);
                  return (
                    <button
                      key={label.id}
                      onClick={() => {
                        const next = selected
                          ? issue.labels.filter((l) => l.id !== label.id).map((l) => l.id)
                          : [...issue.labels.map((l) => l.id), label.id];
                        patch({ labelIds: next });
                      }}
                      className={clsx("cursor-pointer", !selected && "opacity-40 hover:opacity-80")}
                    >
                      <Badge color={label.color}>{label.name}</Badge>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1 border-t border-edge pt-3 text-xs text-ink-faint">
              {issue.reporter && <p>Reported by {issue.reporter.name}</p>}
              <p>Created {timeAgo(issue.createdAt)}</p>
              <p>Updated {timeAgo(issue.updatedAt)}</p>
            </div>
            <Button
              variant="danger"
              size="sm"
              className="w-full"
              loading={deleteIssue.isPending}
              onClick={() => {
                if (confirm("Delete this issue? This cannot be undone.")) {
                  deleteIssue.mutate(issueId, { onSuccess: onClose });
                }
              }}
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete issue
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
