import type { Metadata } from "next";
import { Providers } from "@/lib/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "PulseBoard", template: "%s · PulseBoard" },
  description:
    "Real-time project tracking for fast-moving teams. Kanban boards, live collaboration, and full-text search.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
