"use client";

import { Activity, LogOut } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Avatar, Spinner } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, ready, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && !user) router.replace("/login");
  }, [ready, user, router]);

  if (!ready || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 shrink-0 items-center gap-4 border-b border-edge px-4 sm:px-6">
        <Link href="/app" className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-accent" />
          <span className="font-semibold tracking-tight">PulseBoard</span>
        </Link>
        <div className="ml-auto flex items-center gap-3">
          <Avatar name={user.name} color={user.avatarColor} size={28} />
          <button
            onClick={async () => {
              await logout();
              router.replace("/login");
            }}
            title="Log out"
            className="cursor-pointer rounded-md p-2 text-ink-faint transition-colors hover:bg-surface-3 hover:text-ink"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
