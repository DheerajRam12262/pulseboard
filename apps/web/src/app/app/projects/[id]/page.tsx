"use client";

import type { IssueStatus } from "@pulseboard/shared";
import { ArrowLeft, Plus } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Board } from "@/components/board/board";
import { IssueDialog } from "@/components/issue-dialog";
import { NewIssueDialog } from "@/components/new-issue-dialog";
import { PresenceAvatars } from "@/components/presence";
import { SearchCommand } from "@/components/search-command";
import { Badge, Button, Spinner } from "@/components/ui";
import { useProject } from "@/hooks/queries";
import { useProjectRealtime } from "@/hooks/use-project-realtime";

export default function ProjectBoardPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const { data: project, isLoading, isError } = useProject(projectId);
  const presence = useProjectRealtime(projectId);

  const [openIssueId, setOpenIssueId] = useState<string | null>(null);
  const [newIssue, setNewIssue] = useState<{ open: boolean; status: IssueStatus }>({
    open: false,
    status: "todo",
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (isError || !project) {
    return (
      <div className="py-20 text-center">
        <p className="mb-3 text-ink-dim">Project not found, or you don&apos;t have access.</p>
        <Link href="/app" className="text-sm text-accent hover:underline">
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col px-4 pt-4 sm:px-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link
          href="/app"
          className="rounded-md p-1.5 text-ink-faint transition-colors hover:bg-surface-3 hover:text-ink"
          title="Back to dashboard"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <span className="h-3 w-3 rounded" style={{ backgroundColor: project.color }} />
        <h1 className="text-lg font-semibold">{project.name}</h1>
        <Badge>{project.key}</Badge>
        <div className="ml-auto flex items-center gap-3">
          <PresenceAvatars users={presence} />
          <SearchCommand
            workspaceId={project.workspaceId}
            onSelect={(result) => {
              // results can point at other projects in the workspace - only
              // issues from this board open in place
              if (result.projectId === projectId) setOpenIssueId(result.issueId);
              else window.location.href = `/app/projects/${result.projectId}`;
            }}
          />
          <Button size="sm" onClick={() => setNewIssue({ open: true, status: "todo" })}>
            <Plus className="h-3.5 w-3.5" /> New issue
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <Board
          projectId={projectId}
          projectKey={project.key}
          onOpenIssue={setOpenIssueId}
          onNewIssue={(status) => setNewIssue({ open: true, status })}
        />
      </div>

      <IssueDialog
        issueId={openIssueId}
        projectId={projectId}
        workspaceId={project.workspaceId}
        onClose={() => setOpenIssueId(null)}
      />
      <NewIssueDialog
        open={newIssue.open}
        initialStatus={newIssue.status}
        projectId={projectId}
        workspaceId={project.workspaceId}
        onClose={() => setNewIssue((s) => ({ ...s, open: false }))}
      />
    </div>
  );
}
