"use client";

import type { PresenceUser } from "@pulseboard/shared";
import { Avatar } from "./ui";

// avatar stack for everyone who has this board open right now
export function PresenceAvatars({ users }: { users: PresenceUser[] }) {
  if (users.length === 0) return null;
  const shown = users.slice(0, 5);
  const extra = users.length - shown.length;
  return (
    <div className="flex items-center" title={users.map((u) => u.name).join(", ")}>
      {shown.map((user) => (
        <span key={user.id} className="-ml-1.5 rounded-full ring-2 ring-surface-0 first:ml-0">
          <Avatar name={user.name} color={user.avatarColor} size={26} />
        </span>
      ))}
      {extra > 0 && (
        <span className="-ml-1.5 flex h-[26px] w-[26px] items-center justify-center rounded-full bg-surface-3 text-[10px] font-medium text-ink-dim ring-2 ring-surface-0">
          +{extra}
        </span>
      )}
      <span className="ml-2 flex items-center gap-1.5 text-xs text-ink-faint">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
        live
      </span>
    </div>
  );
}
