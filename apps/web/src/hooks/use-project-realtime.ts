"use client";

import type { PresenceUser } from "@pulseboard/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { qk, removeBoardIssue, upsertBoardIssue } from "@/hooks/queries";
import { connectSocket } from "@/lib/socket";

// joins the project's socket room, folds incoming events into the query cache,
// and reports who else currently has the board open
export function useProjectRealtime(projectId: string): PresenceUser[] {
  const qc = useQueryClient();
  const [presence, setPresence] = useState<PresenceUser[]>([]);

  useEffect(() => {
    const socket = connectSocket();

    const join = () => socket.emit("project:join", projectId, () => {});
    if (socket.connected) join();
    socket.on("connect", join); // re-join after reconnects

    const onIssueUpserted = (p: { projectId: string; issue: Parameters<typeof upsertBoardIssue>[2] }) => {
      if (p.projectId === projectId) upsertBoardIssue(qc, projectId, p.issue);
    };
    const onIssueDeleted = (p: { projectId: string; issueId: string }) => {
      if (p.projectId === projectId) removeBoardIssue(qc, projectId, p.issueId);
    };
    const onCommentChanged = (p: { projectId: string; issueId: string }) => {
      if (p.projectId !== projectId) return;
      void qc.invalidateQueries({ queryKey: qk.comments(p.issueId) });
      void qc.invalidateQueries({ queryKey: qk.issueActivity(p.issueId) });
      void qc.invalidateQueries({ queryKey: qk.boardIssues(projectId) });
    };
    const onPresence = (p: { projectId: string; users: PresenceUser[] }) => {
      if (p.projectId === projectId) setPresence(p.users);
    };

    socket.on("issue:created", onIssueUpserted);
    socket.on("issue:updated", onIssueUpserted);
    socket.on("issue:deleted", onIssueDeleted);
    socket.on("comment:created", onCommentChanged);
    socket.on("comment:deleted", onCommentChanged);
    socket.on("presence:state", onPresence);

    return () => {
      socket.emit("project:leave", projectId);
      socket.off("connect", join);
      socket.off("issue:created", onIssueUpserted);
      socket.off("issue:updated", onIssueUpserted);
      socket.off("issue:deleted", onIssueDeleted);
      socket.off("comment:created", onCommentChanged);
      socket.off("comment:deleted", onCommentChanged);
      socket.off("presence:state", onPresence);
      setPresence([]);
    };
  }, [projectId, qc]);

  return presence;
}
