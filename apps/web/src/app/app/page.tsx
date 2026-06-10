"use client";

import type { WorkspaceDTO } from "@pulseboard/shared";
import { FolderKanban, Plus, UserPlus, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Avatar, Badge, Button, Dialog, ErrorText, Input, Label, Select, Spinner } from "@/components/ui";
import {
  useAddMember,
  useCreateProject,
  useCreateWorkspace,
  useMembers,
  useProjects,
  useRemoveMember,
  useWorkspaces,
} from "@/hooks/queries";
import { useAuth } from "@/lib/auth-context";

const LAST_WS_KEY = "pb:last-workspace";

function suggestKey(name: string): string {
  const letters = name.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return letters.slice(0, 3) || "PRJ";
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { data: workspaces, isLoading } = useWorkspaces();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // restore the last-used workspace, fall back to the first one
  useEffect(() => {
    if (!workspaces || workspaces.length === 0) return;
    const saved = localStorage.getItem(LAST_WS_KEY);
    const found = workspaces.find((w) => w.id === saved);
    setSelectedId((current) => current ?? (found ?? workspaces[0]!).id);
  }, [workspaces]);

  useEffect(() => {
    if (selectedId) localStorage.setItem(LAST_WS_KEY, selectedId);
  }, [selectedId]);

  const selected = useMemo(
    () => workspaces?.find((w) => w.id === selectedId) ?? null,
    [workspaces, selectedId],
  );

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex flex-wrap items-center gap-2">
        {workspaces?.map((ws) => (
          <button
            key={ws.id}
            onClick={() => setSelectedId(ws.id)}
            className={`cursor-pointer rounded-md px-3 py-1.5 text-sm transition-colors ${
              ws.id === selectedId
                ? "bg-surface-3 font-medium text-ink"
                : "text-ink-dim hover:text-ink"
            }`}
          >
            {ws.name}
          </button>
        ))}
        <NewWorkspaceButton onCreated={setSelectedId} />
      </div>

      {!selected ? (
        <EmptyState />
      ) : (
        <WorkspaceView workspace={selected} currentUserId={user?.id ?? ""} />
      )}
    </main>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-edge-strong py-20 text-center">
      <FolderKanban className="mx-auto mb-3 h-8 w-8 text-ink-faint" />
      <h2 className="mb-1 font-medium">Create your first workspace</h2>
      <p className="text-sm text-ink-dim">
        Workspaces hold your projects and teammates. Click “New workspace” above.
      </p>
    </div>
  );
}

function NewWorkspaceButton({ onCreated }: { onCreated: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const createWorkspace = useCreateWorkspace();

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5" /> New workspace
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)}>
        <form
          className="space-y-4 p-6"
          onSubmit={(e) => {
            e.preventDefault();
            createWorkspace.mutate(name.trim(), {
              onSuccess: (res) => {
                setOpen(false);
                setName("");
                onCreated(res.workspace.id);
              },
              onError: (err) => setError(err.message),
            });
          }}
        >
          <h2 className="text-base font-semibold">New workspace</h2>
          <div>
            <Label>Name</Label>
            <Input
              autoFocus
              placeholder="Acme Inc"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <ErrorText>{error}</ErrorText>
          <div className="flex justify-end">
            <Button type="submit" loading={createWorkspace.isPending}>
              Create
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

function WorkspaceView({
  workspace,
  currentUserId,
}: {
  workspace: WorkspaceDTO;
  currentUserId: string;
}) {
  const { data: projects = [], isLoading } = useProjects(workspace.id);
  const isAdmin = workspace.role === "owner" || workspace.role === "admin";

  return (
    <div className="space-y-10">
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium tracking-wide text-ink-dim uppercase">Projects</h2>
          <NewProjectButton workspaceId={workspace.id} />
        </div>
        {isLoading ? (
          <Spinner />
        ) : projects.length === 0 ? (
          <p className="rounded-xl border border-dashed border-edge-strong py-12 text-center text-sm text-ink-dim">
            No projects yet — create one to get a board.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/app/projects/${project.id}`}
                className="group rounded-xl border border-edge bg-surface-1 p-5 transition-colors hover:border-accent"
              >
                <div className="mb-2 flex items-center gap-2.5">
                  <span
                    className="h-3 w-3 rounded"
                    style={{ backgroundColor: project.color }}
                  />
                  <span className="font-medium group-hover:text-accent-hover">
                    {project.name}
                  </span>
                  <Badge>{project.key}</Badge>
                </div>
                {project.description && (
                  <p className="mb-2 line-clamp-2 text-sm text-ink-dim">{project.description}</p>
                )}
                <p className="text-xs text-ink-faint">
                  {project.issueCount} issue{project.issueCount === 1 ? "" : "s"}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <MembersSection workspaceId={workspace.id} isAdmin={isAdmin} currentUserId={currentUserId} />
    </div>
  );
}

function NewProjectButton({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [keyTouched, setKeyTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const createProject = useCreateProject(workspaceId);

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5" /> New project
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)}>
        <form
          className="space-y-4 p-6"
          onSubmit={(e) => {
            e.preventDefault();
            createProject.mutate(
              { name: name.trim(), key: key.trim().toUpperCase(), description: description.trim() || undefined },
              {
                onSuccess: () => {
                  setOpen(false);
                  setName("");
                  setKey("");
                  setKeyTouched(false);
                  setDescription("");
                },
                onError: (err) => setError(err.message),
              },
            );
          }}
        >
          <h2 className="text-base font-semibold">New project</h2>
          <div>
            <Label>Name</Label>
            <Input
              autoFocus
              placeholder="Mobile App"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!keyTouched) setKey(suggestKey(e.target.value));
              }}
            />
          </div>
          <div>
            <Label>Key (used in issue ids, e.g. APP-42)</Label>
            <Input
              placeholder="APP"
              value={key}
              maxLength={5}
              onChange={(e) => {
                setKeyTouched(true);
                setKey(e.target.value.toUpperCase());
              }}
            />
          </div>
          <div>
            <Label>Description</Label>
            <Input
              placeholder="Optional"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <ErrorText>{error}</ErrorText>
          <div className="flex justify-end">
            <Button type="submit" loading={createProject.isPending}>
              Create project
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

function MembersSection({
  workspaceId,
  isAdmin,
  currentUserId,
}: {
  workspaceId: string;
  isAdmin: boolean;
  currentUserId: string;
}) {
  const { data: members = [] } = useMembers(workspaceId);
  const addMember = useAddMember(workspaceId);
  const removeMember = useRemoveMember(workspaceId);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [error, setError] = useState<string | null>(null);

  return (
    <section>
      <h2 className="mb-4 text-sm font-medium tracking-wide text-ink-dim uppercase">Members</h2>
      <div className="space-y-2">
        {members.map((member) => (
          <div
            key={member.userId}
            className="flex items-center gap-3 rounded-lg border border-edge bg-surface-1 px-4 py-2.5"
          >
            <Avatar name={member.name} color={member.avatarColor} size={26} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {member.name}
                {member.userId === currentUserId && (
                  <span className="ml-1.5 text-xs text-ink-faint">(you)</span>
                )}
              </p>
              <p className="truncate text-xs text-ink-faint">{member.email}</p>
            </div>
            <Badge>{member.role}</Badge>
            {isAdmin && member.role !== "owner" && member.userId !== currentUserId && (
              <button
                onClick={() => removeMember.mutate(member.userId)}
                title="Remove member"
                className="ml-auto cursor-pointer rounded p-1.5 text-ink-faint hover:bg-surface-3 hover:text-red-400"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      {isAdmin && (
        <form
          className="mt-4 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            addMember.mutate(
              { email: email.trim(), role },
              {
                onSuccess: () => setEmail(""),
                onError: (err) => setError(err.message),
              },
            );
          }}
        >
          <div className="min-w-52 flex-1">
            <Label>Add member by email</Label>
            <Input
              type="email"
              placeholder="teammate@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="w-28">
            <Label>Role</Label>
            <Select value={role} onChange={(e) => setRole(e.target.value as "member" | "admin")}>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </Select>
          </div>
          <Button type="submit" loading={addMember.isPending}>
            <UserPlus className="h-4 w-4" /> Add
          </Button>
          {error && <ErrorText>{error}</ErrorText>}
        </form>
      )}
    </section>
  );
}
