"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowRight, Copy } from "lucide-react";

interface BoardNavigatorProps {
  defaultBoardId?: string;
}

/**
 * Small helper widget that lets operators paste/copy a board id and deep link
 * into `/board/<id>` without memorising URLs.
 */
export function BoardNavigator({ defaultBoardId }: BoardNavigatorProps) {
  const router = useRouter();
  const [boardId, setBoardId] = useState(defaultBoardId ?? "");
  const [copied, setCopied] = useState(false);
  const canLaunch = boardId.trim().length > 0;

  useEffect(() => {
    setBoardId((current) => current || defaultBoardId || "");
  }, [defaultBoardId]);

  const handleNavigate = useCallback(() => {
    if (!canLaunch) return;
    router.push(`/board/${boardId.trim()}`);
  }, [boardId, canLaunch, router]);

  const handleCopy = useCallback(async () => {
    if (!boardId) return;
    try {
      await navigator.clipboard.writeText(boardId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy board id", error);
    }
  }, [boardId]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="board-id" className="text-xs font-medium uppercase tracking-[0.3em] text-slate-500">
          Board identifier
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="board-id"
            name="board-id"
            value={boardId}
            placeholder="e.g. claunch123"
            onChange={(event) => setBoardId(event.currentTarget.value)}
            className="flex-1 rounded-2xl border border-border/60 bg-background/80 px-4 py-3 text-sm text-foreground shadow-sm focus:border-foreground focus:outline-none"
          />
          <Button
            type="button"
            variant="secondary"
            onClick={handleCopy}
            className="text-sm border border-white/40 bg-white/10 text-white hover:bg-white/20 disabled:border-white/20 disabled:text-white/60"
            disabled={!boardId}
          >
            <Copy className="mr-2 h-4 w-4" /> {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>
      <Button
        type="button"
        className={cn("w-full text-base", !canLaunch && "opacity-50")}
        disabled={!canLaunch}
        onClick={handleNavigate}
      >
        Jump into board <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
      <p className="text-xs text-muted-foreground">
        Paste the ID from the seed script output or pick any existing board from the list below.
      </p>
    </div>
  );
}
