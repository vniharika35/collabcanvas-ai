import type { ReactNode } from "react";

import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * Board routes share this shell so navigation + onboarding helpers stay
 * consistent regardless of which board page renders inside.
 */
export default function BoardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex flex-col gap-3 border-b border-border/60 px-6 py-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-base font-semibold tracking-wide text-foreground">
            CollabCanvas.ai
          </Link>
          <nav className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.3em]">
            <Link href="/" className="text-foreground hover:text-primary">
              Home
            </Link>
            <Link href="/dev/ai-preview" className="text-foreground hover:text-primary">
              AI preview
            </Link>
            <Link href="https://github.com/vniharika35/collabcanvas-ai/tree/main/docs" target="_blank" rel="noreferrer" className="hover:text-primary">
              Docs
            </Link>
          </nav>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-muted-foreground">
            Need an ID? Run <code className="rounded bg-muted px-1 py-0.5">pnpm db:seed</code> and paste it on the home page.
          </span>
          <Button asChild size="sm">
            <Link href="https://github.com/vniharika35/collabcanvas-ai" target="_blank" rel="noreferrer">
              Repo
            </Link>
          </Button>
        </div>
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
