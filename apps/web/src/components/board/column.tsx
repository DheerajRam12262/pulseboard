"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { IssueDTO, IssueStatus } from "@pulseboard/shared";
import { ISSUE_STATUS_LABELS } from "@pulseboard/shared";
import clsx from "clsx";
import { Plus } from "lucide-react";
import { SortableIssueCard } from "./issue-card";
import { STATUS_COLORS } from "./status-meta";

export function BoardColumn({
  status,
  issues,
  projectKey,
  onOpenIssue,
  onNewIssue,
}: {
  status: IssueStatus;
  issues: IssueDTO[];
  projectKey: string;
  onOpenIssue: (issueId: string) => void;
  onNewIssue: (status: IssueStatus) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${status}` });

  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className="mb-2 flex items-center gap-2 px-1">
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: STATUS_COLORS[status] }}
        />
        <h3 className="text-sm font-medium text-ink">{ISSUE_STATUS_LABELS[status]}</h3>
        <span className="text-xs text-ink-faint">{issues.length}</span>
        <button
          onClick={() => onNewIssue(status)}
          aria-label={`New issue in ${ISSUE_STATUS_LABELS[status]}`}
          className="ml-auto cursor-pointer rounded p-1 text-ink-faint hover:bg-surface-3 hover:text-ink"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <div
        ref={setNodeRef}
        className={clsx(
          "thin-scroll flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto rounded-lg p-1 transition-colors",
          isOver && "bg-surface-2/60 outline-1 outline-dashed outline-edge-strong",
        )}
      >
        <SortableContext items={issues.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {issues.map((issue) => (
            <SortableIssueCard
              key={issue.id}
              issue={issue}
              projectKey={projectKey}
              onOpen={onOpenIssue}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
