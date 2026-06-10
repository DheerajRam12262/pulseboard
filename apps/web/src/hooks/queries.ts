"use client";

import type {
  ActivityDTO,
  CommentDTO,
  CreateIssueInput,
  IssueDTO,
  LabelDTO,
  ProjectDTO,
  SearchResultDTO,
  UpdateIssueInput,
  WorkspaceDTO,
  WorkspaceMemberDTO,
} from "@pulseboard/shared";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const qk = {
  workspaces: ["workspaces"] as const,
  members: (wsId: string) => ["workspaces", wsId, "members"] as const,
  projects: (wsId: string) => ["workspaces", wsId, "projects"] as const,
  project: (projectId: string) => ["projects", projectId] as const,
  boardIssues: (projectId: string) => ["projects", projectId, "issues"] as const,
  labels: (projectId: string) => ["projects", projectId, "labels"] as const,
  issue: (issueId: string) => ["issues", issueId] as const,
  comments: (issueId: string) => ["issues", issueId, "comments"] as const,
  issueActivity: (issueId: string) => ["issues", issueId, "activity"] as const,
};

/* ------------------------------- queries ------------------------------- */

export function useWorkspaces() {
  return useQuery({
    queryKey: qk.workspaces,
    queryFn: () => api.get<{ workspaces: WorkspaceDTO[] }>("/api/workspaces"),
    select: (d) => d.workspaces,
  });
}

export function useMembers(workspaceId: string | null) {
  return useQuery({
    queryKey: qk.members(workspaceId ?? ""),
    queryFn: () =>
      api.get<{ members: WorkspaceMemberDTO[] }>(`/api/workspaces/${workspaceId}/members`),
    select: (d) => d.members,
    enabled: !!workspaceId,
  });
}

export function useProjects(workspaceId: string | null) {
  return useQuery({
    queryKey: qk.projects(workspaceId ?? ""),
    queryFn: () => api.get<{ projects: ProjectDTO[] }>(`/api/workspaces/${workspaceId}/projects`),
    select: (d) => d.projects,
    enabled: !!workspaceId,
  });
}

export function useProject(projectId: string) {
  return useQuery({
    queryKey: qk.project(projectId),
    queryFn: () => api.get<{ project: ProjectDTO }>(`/api/projects/${projectId}`),
    select: (d) => d.project,
  });
}

export function useBoardIssues(projectId: string) {
  return useQuery({
    queryKey: qk.boardIssues(projectId),
    queryFn: () => api.get<{ issues: IssueDTO[] }>(`/api/projects/${projectId}/issues`),
    select: (d) => d.issues,
  });
}

export function useLabels(projectId: string) {
  return useQuery({
    queryKey: qk.labels(projectId),
    queryFn: () => api.get<{ labels: LabelDTO[] }>(`/api/projects/${projectId}/labels`),
    select: (d) => d.labels,
  });
}

export function useIssue(issueId: string | null) {
  return useQuery({
    queryKey: qk.issue(issueId ?? ""),
    queryFn: () => api.get<{ issue: IssueDTO }>(`/api/issues/${issueId}`),
    select: (d) => d.issue,
    enabled: !!issueId,
  });
}

export function useComments(issueId: string | null) {
  return useQuery({
    queryKey: qk.comments(issueId ?? ""),
    queryFn: () => api.get<{ comments: CommentDTO[] }>(`/api/issues/${issueId}/comments`),
    select: (d) => d.comments,
    enabled: !!issueId,
  });
}

export function useIssueActivity(issueId: string | null) {
  return useQuery({
    queryKey: qk.issueActivity(issueId ?? ""),
    queryFn: () => api.get<{ activity: ActivityDTO[] }>(`/api/issues/${issueId}/activity`),
    select: (d) => d.activity,
    enabled: !!issueId,
  });
}

export function useSearch(workspaceId: string | null, q: string) {
  return useQuery({
    queryKey: ["search", workspaceId, q],
    queryFn: () =>
      api.get<{ results: SearchResultDTO[] }>(
        `/api/search?workspaceId=${workspaceId}&q=${encodeURIComponent(q)}`,
      ),
    select: (d) => d.results,
    enabled: !!workspaceId && q.trim().length > 0,
    placeholderData: (prev) => prev,
  });
}

/* ----------------------------- cache helpers ---------------------------- */

export function upsertBoardIssue(qc: QueryClient, projectId: string, issue: IssueDTO) {
  qc.setQueryData<{ issues: IssueDTO[] }>(qk.boardIssues(projectId), (old) => {
    if (!old) return old;
    const exists = old.issues.some((i) => i.id === issue.id);
    return {
      issues: exists ? old.issues.map((i) => (i.id === issue.id ? issue : i)) : [...old.issues, issue],
    };
  });
  qc.setQueryData<{ issue: IssueDTO }>(qk.issue(issue.id), { issue });
}

export function removeBoardIssue(qc: QueryClient, projectId: string, issueId: string) {
  qc.setQueryData<{ issues: IssueDTO[] }>(qk.boardIssues(projectId), (old) =>
    old ? { issues: old.issues.filter((i) => i.id !== issueId) } : old,
  );
}

/* ------------------------------ mutations ------------------------------ */

export function useCreateWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      api.post<{ workspace: WorkspaceDTO }>("/api/workspaces", { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.workspaces }),
  });
}

export function useCreateProject(workspaceId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; key: string; description?: string }) =>
      api.post<{ project: ProjectDTO }>(`/api/workspaces/${workspaceId}/projects`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.projects(workspaceId ?? "") }),
  });
}

export function useAddMember(workspaceId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; role: "admin" | "member" }) =>
      api.post(`/api/workspaces/${workspaceId}/members`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.members(workspaceId ?? "") }),
  });
}

export function useRemoveMember(workspaceId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.delete(`/api/workspaces/${workspaceId}/members/${userId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.members(workspaceId ?? "") }),
  });
}

export function useCreateIssue(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<CreateIssueInput> & { title: string }) =>
      api.post<{ issue: IssueDTO }>(`/api/projects/${projectId}/issues`, body),
    onSuccess: (res) => upsertBoardIssue(qc, projectId, res.issue),
  });
}

export function useUpdateIssue(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ issueId, ...body }: UpdateIssueInput & { issueId: string }) =>
      api.patch<{ issue: IssueDTO }>(`/api/issues/${issueId}`, body),
    onSuccess: (res) => {
      upsertBoardIssue(qc, projectId, res.issue);
      void qc.invalidateQueries({ queryKey: qk.issueActivity(res.issue.id) });
    },
  });
}

export interface MoveIssueVars {
  issueId: string;
  status: IssueDTO["status"];
  beforeIssueId: string | null;
  afterIssueId: string | null;
  // computed client-side so the card doesn't jump while the request is in flight
  optimisticRank: string | null;
}

export function useMoveIssue(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ issueId, optimisticRank: _o, ...body }: MoveIssueVars) =>
      api.post<{ issue: IssueDTO }>(`/api/issues/${issueId}/move`, body),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: qk.boardIssues(projectId) });
      const prev = qc.getQueryData<{ issues: IssueDTO[] }>(qk.boardIssues(projectId));
      if (prev) {
        qc.setQueryData<{ issues: IssueDTO[] }>(qk.boardIssues(projectId), {
          issues: prev.issues.map((i) =>
            i.id === vars.issueId
              ? { ...i, status: vars.status, rank: vars.optimisticRank ?? i.rank }
              : i,
          ),
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.boardIssues(projectId), ctx.prev);
    },
    onSuccess: (res) => {
      upsertBoardIssue(qc, projectId, res.issue);
      void qc.invalidateQueries({ queryKey: qk.issueActivity(res.issue.id) });
    },
  });
}

export function useDeleteIssue(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (issueId: string) => api.delete(`/api/issues/${issueId}`),
    onSuccess: (_d, issueId) => removeBoardIssue(qc, projectId, issueId),
  });
}

export function useAddComment(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ issueId, body }: { issueId: string; body: string }) =>
      api.post<{ comment: CommentDTO }>(`/api/issues/${issueId}/comments`, { body }),
    onSuccess: (res, vars) => {
      qc.setQueryData<{ comments: CommentDTO[] }>(qk.comments(vars.issueId), (old) =>
        old ? { comments: [...old.comments, res.comment] } : old,
      );
      void qc.invalidateQueries({ queryKey: qk.issueActivity(vars.issueId) });
      void qc.invalidateQueries({ queryKey: qk.boardIssues(projectId) });
    },
  });
}

export function useDeleteComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId }: { commentId: string; issueId: string }) =>
      api.delete(`/api/comments/${commentId}`),
    onSuccess: (_d, vars) => {
      qc.setQueryData<{ comments: CommentDTO[] }>(qk.comments(vars.issueId), (old) =>
        old ? { comments: old.comments.filter((c) => c.id !== vars.commentId) } : old,
      );
    },
  });
}
