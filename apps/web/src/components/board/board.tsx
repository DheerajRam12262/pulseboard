"use client";

import {
  closestCorners,
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type { IssueDTO, IssueStatus } from "@pulseboard/shared";
import { ISSUE_STATUSES } from "@pulseboard/shared";
import { generateKeyBetween } from "fractional-indexing";
import { useMemo, useState } from "react";
import { useBoardIssues, useMoveIssue } from "@/hooks/queries";
import { IssueCardContent } from "./issue-card";
import { BoardColumn } from "./column";

function byRank(a: IssueDTO, b: IssueDTO): number {
  if (a.rank !== b.rank) return a.rank < b.rank ? -1 : 1;
  return a.createdAt.localeCompare(b.createdAt);
}

export function Board({
  projectId,
  projectKey,
  onOpenIssue,
  onNewIssue,
}: {
  projectId: string;
  projectKey: string;
  onOpenIssue: (issueId: string) => void;
  onNewIssue: (status: IssueStatus) => void;
}) {
  const { data: issues = [] } = useBoardIssues(projectId);
  const moveIssue = useMoveIssue(projectId);
  const [activeId, setActiveId] = useState<string | null>(null);

  const columns = useMemo(() => {
    const map = new Map<IssueStatus, IssueDTO[]>(ISSUE_STATUSES.map((s) => [s, []]));
    for (const issue of [...issues].sort(byRank)) map.get(issue.status)?.push(issue);
    return map;
  }, [issues]);

  const sensors = useSensors(
    // require 5px of travel before a drag starts, otherwise plain clicks would never open cards
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const activeIssue = activeId ? (issues.find((i) => i.id === activeId) ?? null) : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const dragged = issues.find((i) => i.id === String(active.id));
    if (!dragged) return;

    // figure out which column + slot we dropped into
    const overId = String(over.id);
    let targetStatus: IssueStatus;
    let list: IssueDTO[];
    let insertIndex: number;

    if (overId.startsWith("col:")) {
      targetStatus = overId.slice(4) as IssueStatus;
      list = (columns.get(targetStatus) ?? []).filter((i) => i.id !== dragged.id);
      insertIndex = list.length; // dropped on the column itself, append
    } else {
      const overIssue = issues.find((i) => i.id === overId);
      if (!overIssue) return;
      targetStatus = overIssue.status;
      list = (columns.get(targetStatus) ?? []).filter((i) => i.id !== dragged.id);
      const overIndex = list.findIndex((i) => i.id === overIssue.id);
      const activeRect = active.rect.current.translated;
      const droppedBelow =
        !!activeRect &&
        activeRect.top + activeRect.height / 2 > over.rect.top + over.rect.height / 2;
      insertIndex = overIndex + (droppedBelow ? 1 : 0);
    }

    const before = list[insertIndex - 1] ?? null;
    const after = list[insertIndex] ?? null;

    // dropped back where it started, nothing to do
    if (
      dragged.status === targetStatus &&
      (before === null || before.rank < dragged.rank) &&
      (after === null || dragged.rank < after.rank)
    ) {
      return;
    }

    let optimisticRank: string | null = null;
    try {
      optimisticRank = generateKeyBetween(before?.rank ?? null, after?.rank ?? null);
    } catch {
      // stale neighbors; let the server pick a safe rank
    }

    moveIssue.mutate({
      issueId: dragged.id,
      status: targetStatus,
      beforeIssueId: before?.id ?? null,
      afterIssueId: after?.id ?? null,
      optimisticRank,
    });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="thin-scroll flex h-full gap-4 overflow-x-auto pb-4">
        {ISSUE_STATUSES.map((status) => (
          <BoardColumn
            key={status}
            status={status}
            issues={columns.get(status) ?? []}
            projectKey={projectKey}
            onOpenIssue={onOpenIssue}
            onNewIssue={onNewIssue}
          />
        ))}
      </div>
      <DragOverlay>
        {activeIssue && (
          <IssueCardContent issue={activeIssue} projectKey={projectKey} dragging />
        )}
      </DragOverlay>
    </DndContext>
  );
}
