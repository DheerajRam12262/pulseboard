"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { IssueDTO } from "@pulseboard/shared";
import clsx from "clsx";
import { AlertOctagon, MessageSquare, Minus, SignalHigh, SignalLow, SignalMedium } from "lucide-react";
import { Avatar, Badge } from "@/components/ui";
import { PRIORITY_COLORS } from "./status-meta";

export function PriorityIcon({ priority }: { priority: IssueDTO["priority"] }) {
  const color = PRIORITY_COLORS[priority];
  const props = { className: "h-3.5 w-3.5 shrink-0", style: { color } };
  switch (priority) {
    case "urgent":
      return <AlertOctagon {...props} />;
    case "high":
      return <SignalHigh {...props} />;
    case "medium":
      return <SignalMedium {...props} />;
    case "low":
      return <SignalLow {...props} />;
    default:
      return <Minus {...props} />;
  }
}

export function IssueCardContent({
  issue,
  projectKey,
  dragging = false,
}: {
  issue: IssueDTO;
  projectKey: string;
  dragging?: boolean;
}) {
  return (
    <div
      className={clsx(
        "cursor-pointer rounded-lg border border-edge bg-surface-2 p-3 transition-colors hover:border-edge-strong",
        dragging && "rotate-2 border-accent shadow-xl",
      )}
    >
      <div className="mb-1.5 flex items-center gap-2">
        <PriorityIcon priority={issue.priority} />
        <span className="text-[11px] font-medium text-ink-faint">
          {projectKey}-{issue.number}
        </span>
        {issue.commentCount > 0 && (
          <span className="ml-auto flex items-center gap-1 text-[11px] text-ink-faint">
            <MessageSquare className="h-3 w-3" />
            {issue.commentCount}
          </span>
        )}
      </div>
      <p className="text-sm leading-snug text-ink">{issue.title}</p>
      {(issue.labels.length > 0 || issue.assignee) && (
        <div className="mt-2.5 flex items-center gap-1.5">
          <div className="flex flex-wrap gap-1">
            {issue.labels.map((label) => (
              <Badge key={label.id} color={label.color}>
                {label.name}
              </Badge>
            ))}
          </div>
          {issue.assignee && (
            <span className="ml-auto">
              <Avatar name={issue.assignee.name} color={issue.assignee.avatarColor} size={20} />
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function SortableIssueCard({
  issue,
  projectKey,
  onOpen,
}: {
  issue: IssueDTO;
  projectKey: string;
  onOpen: (issueId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: issue.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={clsx(isDragging && "opacity-40")}
      onClick={() => onOpen(issue.id)}
      {...attributes}
      {...listeners}
    >
      <IssueCardContent issue={issue} projectKey={projectKey} />
    </div>
  );
}
