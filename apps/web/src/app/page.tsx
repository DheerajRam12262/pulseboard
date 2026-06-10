import { Activity, KanbanSquare, Search, Users, Zap } from "lucide-react";
import Link from "next/link";

const features = [
  {
    icon: Zap,
    title: "Real-time by default",
    body: "Boards sync instantly across every open tab and teammate via WebSockets — no refresh button required.",
  },
  {
    icon: KanbanSquare,
    title: "Boards that feel native",
    body: "Drag-and-drop with optimistic updates and fractional indexing, so ordering survives concurrent edits.",
  },
  {
    icon: Users,
    title: "Built for teams",
    body: "Workspaces, role-based permissions, presence indicators, and an activity trail on every issue.",
  },
  {
    icon: Search,
    title: "Find anything fast",
    body: "Postgres full-text search across every issue in your workspace, one ⌘K away.",
  },
];

export default function LandingPage() {
  return (
    <main className="mx-auto max-w-5xl px-6">
      <header className="flex items-center justify-between py-6">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-accent" />
          <span className="text-lg font-semibold tracking-tight">PulseBoard</span>
        </div>
        <nav className="flex items-center gap-2">
          <Link
            href="/login"
            className="rounded-md px-4 py-2 text-sm text-ink-dim transition-colors hover:text-ink"
          >
            Log in
          </Link>
          <Link
            href="/register"
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
          >
            Get started
          </Link>
        </nav>
      </header>

      <section className="py-24 text-center">
        <p className="mb-4 inline-block rounded-full border border-edge-strong px-3 py-1 text-xs text-ink-dim">
          Open-source · Real-time · Free
        </p>
        <h1 className="mx-auto max-w-2xl text-5xl font-bold tracking-tight text-balance">
          Project tracking that moves at the speed of your team
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-ink-dim">
          Kanban boards with live multiplayer collaboration. See your teammates&apos; changes the
          moment they happen.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            href="/register"
            className="rounded-md bg-accent px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
          >
            Start for free
          </Link>
          <a
            href="https://github.com/DheerajRam12262/pulseboard"
            className="rounded-md border border-edge-strong px-6 py-3 text-sm text-ink transition-colors hover:bg-surface-3"
          >
            View source
          </a>
        </div>
      </section>

      <section className="grid gap-4 pb-24 sm:grid-cols-2">
        {features.map((f) => (
          <div
            key={f.title}
            className="rounded-xl border border-edge bg-surface-1 p-6 transition-colors hover:border-edge-strong"
          >
            <f.icon className="mb-3 h-5 w-5 text-accent" />
            <h3 className="mb-1.5 font-semibold">{f.title}</h3>
            <p className="text-sm leading-relaxed text-ink-dim">{f.body}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-edge py-8 text-center text-xs text-ink-faint">
        Built with Next.js, Fastify, PostgreSQL, and Socket.IO · A portfolio project
      </footer>
    </main>
  );
}
