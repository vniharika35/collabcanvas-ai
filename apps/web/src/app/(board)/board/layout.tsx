import type { ReactNode } from "react";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function BoardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border/60 px-6 py-4">
        <Link href="/" className="text-sm font-semibold tracking-wide">
          CollabCanvas.ai
        </Link>
        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Presence
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Currently online</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="justify-between">
                You
                <span className="text-xs text-muted-foreground">editing</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="justify-between">
                Canvas AI
                <span className="text-xs text-muted-foreground">idle</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                Invite teammate
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite collaborators</DialogTitle>
                <DialogDescription>
                  Share this board with a teammate or AI assistant. Links will respect
                  board roles once auth is wired up.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-3 text-sm text-muted-foreground">
                <p>Coming soon: copy invite link, manage access, add AI teammates.</p>
              </div>
              <DialogFooter>
                <Button variant="secondary" size="sm">
                  Copy invite link
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button size="sm">AI hand-off</Button>
        </div>
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
