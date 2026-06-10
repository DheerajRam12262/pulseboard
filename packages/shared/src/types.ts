import type { IssuePriority, IssueStatus, WorkspaceRole } from "./constants";

export interface UserDTO {
  id: string;
  email: string;
  name: string;
  avatarColor: string;
  createdAt: string;
}

// minimal user shape embedded in other resources
export interface UserLite {
  id: string;
  name: string;
  avatarColor: string;
}

export interface WorkspaceDTO {
  id: string;
  name: string;
  slug: string;
  // the requesting user's role
  role: WorkspaceRole;
  createdAt: string;
}

export interface WorkspaceMemberDTO {
  userId: string;
  name: string;
  email: string;
  avatarColor: string;
  role: WorkspaceRole;
}

export interface ProjectDTO {
  id: string;
  workspaceId: string;
  name: string;
  key: string;
  description: string | null;
  color: string;
  issueCount: number;
  createdAt: string;
}

export interface LabelDTO {
  id: string;
  name: string;
  color: string;
}

export interface IssueDTO {
  id: string;
  projectId: string;
  number: number;
  title: string;
  description: string | null;
  status: IssueStatus;
  priority: IssuePriority;
  rank: string;
  assignee: UserLite | null;
  reporter: UserLite | null;
  labels: LabelDTO[];
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CommentDTO {
  id: string;
  issueId: string;
  body: string;
  author: UserLite | null;
  createdAt: string;
  updatedAt: string;
}

export type ActivityType =
  | "issue_created"
  | "title_changed"
  | "description_changed"
  | "status_changed"
  | "priority_changed"
  | "assignee_changed"
  | "labels_changed"
  | "comment_added";

export interface ActivityDTO {
  id: string;
  issueId: string | null;
  type: ActivityType;
  // type-specific payload, e.g. { from: "todo", to: "done" }
  data: Record<string, unknown>;
  actor: UserLite | null;
  createdAt: string;
}

export interface SearchResultDTO {
  issueId: string;
  projectId: string;
  projectKey: string;
  projectName: string;
  number: number;
  title: string;
  status: IssueStatus;
  priority: IssuePriority;
}

export interface AuthResponse {
  user: UserDTO;
  accessToken: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
