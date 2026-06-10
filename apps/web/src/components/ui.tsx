"use client";

import clsx from "clsx";
import { Loader2, X } from "lucide-react";
import { useEffect } from "react";
import { initials } from "@/lib/format";

export { clsx as cn };

type ButtonVariant = "primary" | "ghost" | "outline" | "danger";

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  children,
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "sm" | "md";
  loading?: boolean;
}) {
  const variants: Record<ButtonVariant, string> = {
    primary: "bg-accent hover:bg-accent-hover text-white",
    ghost: "text-ink-dim hover:text-ink hover:bg-surface-3",
    outline: "border border-edge-strong text-ink hover:bg-surface-3",
    danger: "bg-red-500/10 text-red-400 hover:bg-red-500/20",
  };
  return (
    <button
      className={clsx(
        "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-7 px-2.5 text-xs" : "h-9 px-4 text-sm",
        variants[variant],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {children}
    </button>
  );
}

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={clsx(
        "h-9 w-full rounded-md border border-edge-strong bg-surface-1 px-3 text-sm text-ink",
        "placeholder:text-ink-faint focus:border-accent focus:outline-none",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={clsx(
        "w-full rounded-md border border-edge-strong bg-surface-1 px-3 py-2 text-sm text-ink",
        "placeholder:text-ink-faint focus:border-accent focus:outline-none",
        className,
      )}
      {...props}
    />
  );
}

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={clsx(
        "h-8 w-full cursor-pointer rounded-md border border-edge-strong bg-surface-1 px-2 text-sm text-ink",
        "focus:border-accent focus:outline-none",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1 block text-xs font-medium tracking-wide text-ink-dim uppercase">
      {children}
    </span>
  );
}

export function Avatar({
  name,
  color,
  size = 24,
  title,
}: {
  name: string;
  color: string;
  size?: number;
  title?: string;
}) {
  return (
    <span
      title={title ?? name}
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white select-none"
      style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.38 }}
    >
      {initials(name)}
    </span>
  );
}

export function Badge({
  color,
  children,
}: {
  color?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-edge-strong px-2 py-0.5 text-[11px] text-ink-dim"
      style={color ? { borderColor: `${color}55`, color } : undefined}
    >
      {color && (
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      )}
      {children}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx("h-5 w-5 animate-spin text-ink-dim", className)} />;
}

// TODO: trap focus while open
export function Dialog({
  open,
  onClose,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fade-up fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-[10vh] backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={clsx(
          "relative max-h-[80vh] w-full overflow-y-auto rounded-xl border border-edge-strong bg-surface-1 shadow-2xl",
          wide ? "max-w-3xl" : "max-w-md",
        )}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 cursor-pointer rounded-md p-1 text-ink-faint hover:bg-surface-3 hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>
        {children}
      </div>
    </div>
  );
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return <p className="text-sm text-red-400">{children}</p>;
}
