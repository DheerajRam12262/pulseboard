"use client";

import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearch } from "@/hooks/queries";
import { PriorityIcon } from "./board/issue-card";
import { STATUS_COLORS } from "./board/status-meta";

// cmd/ctrl+k palette over the workspace-wide search endpoint
export function SearchCommand({
  workspaceId,
  onSelect,
}: {
  workspaceId: string;
  onSelect: (result: { issueId: string; projectId: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const { data: results = [], isFetching } = useSearch(open ? workspaceId : null, debounced);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-8 cursor-pointer items-center gap-2 rounded-md border border-edge-strong px-3 text-sm text-ink-faint transition-colors hover:border-accent hover:text-ink-dim"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Search issues…</span>
        <kbd className="hidden rounded border border-edge-strong px-1 text-[10px] sm:inline">
          ⌘K
        </kbd>
      </button>

      {open && (
        <div
          className="fade-up fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-[15vh] backdrop-blur-sm"
          onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="w-full max-w-lg overflow-hidden rounded-xl border border-edge-strong bg-surface-1 shadow-2xl">
            <div className="flex items-center gap-2 border-b border-edge px-4">
              <Search className="h-4 w-4 text-ink-faint" />
              <input
                autoFocus
                placeholder="Search issues in this workspace…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-12 w-full bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none"
              />
            </div>
            <div className="thin-scroll max-h-80 overflow-y-auto p-2">
              {results.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-ink-faint">
                  {debounced.trim()
                    ? isFetching
                      ? "Searching…"
                      : "No issues found"
                    : "Type to search by title or description"}
                </p>
              )}
              {results.map((result) => (
                <button
                  key={result.issueId}
                  onClick={() => {
                    setOpen(false);
                    setQuery("");
                    onSelect(result);
                  }}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-surface-3"
                >
                  <PriorityIcon priority={result.priority} />
                  <span className="shrink-0 text-xs font-medium text-ink-faint">
                    {result.projectKey}-{result.number}
                  </span>
                  <span className="truncate text-sm text-ink">{result.title}</span>
                  <span
                    className="ml-auto h-2 w-2 shrink-0 rounded-full"
                    title={result.status}
                    style={{ backgroundColor: STATUS_COLORS[result.status] }}
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
