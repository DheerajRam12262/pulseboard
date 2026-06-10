import type { IssuePriority, IssueStatus } from "@pulseboard/shared";

export const STATUS_COLORS: Record<IssueStatus, string> = {
  backlog: "#5c5c70",
  todo: "#0ea5e9",
  in_progress: "#eab308",
  in_review: "#8b5cf6",
  done: "#22c55e",
};

export const PRIORITY_COLORS: Record<IssuePriority, string> = {
  none: "#5c5c70",
  low: "#64748b",
  medium: "#0ea5e9",
  high: "#f97316",
  urgent: "#f43f5e",
};
