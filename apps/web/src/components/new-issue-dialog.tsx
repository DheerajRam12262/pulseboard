"use client";

import type { IssuePriority, IssueStatus } from "@pulseboard/shared";
import {
  ISSUE_PRIORITIES,
  ISSUE_PRIORITY_LABELS,
  ISSUE_STATUSES,
  ISSUE_STATUS_LABELS,
} from "@pulseboard/shared";
import { useEffect, useState } from "react";
import { useCreateIssue, useMembers } from "@/hooks/queries";
import { Button, Dialog, ErrorText, Input, Label, Select, Textarea } from "./ui";

export function NewIssueDialog({
  open,
  initialStatus,
  projectId,
  workspaceId,
  onClose,
}: {
  open: boolean;
  initialStatus: IssueStatus;
  projectId: string;
  workspaceId: string;
  onClose: () => void;
}) {
  const createIssue = useCreateIssue(projectId);
  const { data: members = [] } = useMembers(workspaceId);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<IssueStatus>(initialStatus);
  const [priority, setPriority] = useState<IssuePriority>("none");
  const [assigneeId, setAssigneeId] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStatus(initialStatus);
      setError(null);
    }
  }, [open, initialStatus]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return setError("Title is required");
    createIssue.mutate(
      {
        title: trimmed,
        description: description.trim() || undefined,
        status,
        priority,
        assigneeId: assigneeId || undefined,
      },
      {
        onSuccess: () => {
          setTitle("");
          setDescription("");
          setPriority("none");
          setAssigneeId("");
          onClose();
        },
        onError: (err) => setError(err.message),
      },
    );
  }

  return (
    <Dialog open={open} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4 p-6">
        <h2 className="text-base font-semibold text-ink">New issue</h2>
        <div>
          <Label>Title</Label>
          <Input
            autoFocus
            placeholder="What needs to be done?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div>
          <Label>Description</Label>
          <Textarea
            rows={3}
            placeholder="Optional details…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label>Status</Label>
            <Select value={status} onChange={(e) => setStatus(e.target.value as IssueStatus)}>
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
              value={priority}
              onChange={(e) => setPriority(e.target.value as IssuePriority)}
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
            <Select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <ErrorText>{error}</ErrorText>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={createIssue.isPending}>
            Create issue
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
