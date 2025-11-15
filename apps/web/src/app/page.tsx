import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { BoardNavigator } from "@/components/home/board-navigator";
import { ArrowUpRight, Compass, Database, Share2, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

const highlightSteps = [
  {
    title: "Add sticky notes",
    description:
      "Capture thoughts directly on the canvas. Everything you type syncs through Yjs and lands in Postgres within a second.",
  },
  {
    title: "Call /cluster",
    description:
      "Send sticky IDs through the FastAPI broker to colour groupings. A new trace row logs latency, model, and token info.",
  },
  {
    title: "Outline with AI",
    description:
      "Select a cluster, run /outline, and decide whether to accept or undo the ghost nodes the AI drafts for you.",
  },
];

const systemCards = [
  {
    title: "Next.js board UI",
    body: "App Router + shadcn/ui drive the realtime canvas. Presence is powered by a websocket hook that hydrates a Yjs doc.",
    icon: Sparkles,
  },
  {
    title: "FastAPI AI broker",
    body: "Stub endpoints return deterministic data now, but the contract already matches the shared Zod schemas.",
    icon: Share2,
  },
  {
    title: "Realtime + Redis",
    body: "A Node/TypeScript websocket server fans out doc updates and awareness, persisting edits back to Postgres.",
    icon: Compass,
  },
  {
    title: "Postgres traces",
    body: "Sticky notes, clusters, and trace records live in Prisma models so every change is auditable.",
    icon: Database,
  },
];

/**
 * Marketing/entry page that tees up the board, AI preview, and latest boards.
 * Fetches a handful of boards so visitors can jump right into the experience.
 */
export default async function Home() {
  const boards = await prisma.board.findMany({
    orderBy: { createdAt: "desc" },
    take: 3,
    select: { id: true, title: true, createdAt: true },
  });
  const primaryBoard = boards[0];

  return (
    <main className="flex min-h-screen flex-col bg-slate-950">
      <section className="relative overflow-hidden border-b border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-black px-6 py-20 sm:px-12">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 text-white">
          <div className="space-y-6 text-center sm:text-left">
            <p className="text-xs uppercase tracking-[0.45em] text-slate-400">CollabCanvas.ai</p>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              Ship realtime brainstorms with AI teammates you can trust.
            </h1>
            <p className="text-base text-slate-300 sm:text-lg">
              Start on the board, watch edits sync through the realtime service, and inspect every AI action through traces.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {primaryBoard ? (
              <Button asChild size="lg" className="min-w-[12rem]">
                <Link href={`/board/${primaryBoard.id}`}>
                  Open demo board <ArrowUpRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <Button size="lg" disabled className="min-w-[12rem]">
                Seed a board first
              </Button>
            )}
            <Button
              asChild
              size="lg"
              variant="secondary"
              className="min-w-[12rem] border border-white/60 bg-white/10 text-white hover:bg-white/20 focus-visible:ring-white"
            >
              <Link
                href="https://github.com/vniharika35/collabcanvas-ai"
                target="_blank"
                rel="noreferrer"
              >
                View repository
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary" className="min-w-[12rem] border border-white/40 bg-white/10 text-white hover:bg-white/20">
              <Link href="/dev/ai-preview">Run AI preview</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="px-6 py-12 sm:px-12">
        <div className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-white shadow-xl backdrop-blur">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Board access</p>
                <h2 className="mt-2 text-2xl font-semibold">Jump into a workspace</h2>
              </div>
              <span className="text-sm text-slate-400">Seed output → Paste ID → Launch</span>
            </div>
            <div className="mt-6">
              <BoardNavigator defaultBoardId={primaryBoard?.id} />
            </div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-8 text-white shadow-xl">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Latest boards</p>
            <ul className="mt-4 space-y-4 text-sm">
              {boards.length === 0 ? (
                <li className="text-slate-400">Run `pnpm db:seed` to create a demo board.</li>
              ) : (
                boards.map((board) => (
                  <li key={board.id} className="flex items-center justify-between rounded-2xl border border-white/10 px-4 py-3">
                    <div>
                      <p className="text-base font-medium">{board.title}</p>
                      <p className="text-xs text-slate-400">{board.id}</p>
                    </div>
                    <Link
                      href={`/board/${board.id}`}
                      className="text-xs font-medium uppercase tracking-[0.3em] text-emerald-300 hover:text-emerald-200"
                    >
                      Open
                    </Link>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </section>

      <section className="border-t border-white/5 bg-slate-900/60 px-6 py-16 sm:px-12">
        <div className="mx-auto w-full max-w-6xl">
          <div className="text-center text-white">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Workflow</p>
            <h2 className="mt-3 text-3xl font-semibold">From sticky notes to AI outlines</h2>
            <p className="mt-3 text-base text-slate-300">
              Follow the three-step loop and keep the Trace panel open to understand which service is acting at each step.
            </p>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {highlightSteps.map((step, index) => (
              <div key={step.title} className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white">
                <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Step {index + 1}</p>
                <h3 className="mt-3 text-xl font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-slate-300">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-16 sm:px-12">
        <div className="mx-auto w-full max-w-6xl space-y-8">
          <div className="text-center text-white">
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">System overview</p>
            <h2 className="mt-3 text-3xl font-semibold">Everything working together</h2>
            <p className="mt-3 text-base text-slate-300">
              These layers explain where your data travels every time you press a button in the UI.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {systemCards.map((card) => (
              <div key={card.title} className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 text-white shadow-md">
                <card.icon className="h-6 w-6 text-emerald-300" />
                <h3 className="mt-4 text-xl font-semibold">{card.title}</h3>
                <p className="mt-2 text-sm text-slate-300">{card.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
