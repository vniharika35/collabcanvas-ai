import Link from "next/link";

import { Button } from "@/components/ui/button";

const highlights = [
  "Drop sticky notes, images, and documents in a multiplayer board.",
  "Call /cluster or /outline to let AI organize and draft in place.",
  "Review the trace timeline to accept, nudge, or undo any change."
];

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-24 sm:px-12">
      <section className="flex w-full max-w-4xl flex-col gap-10 rounded-3xl border border-border bg-card/60 p-10 shadow-sm backdrop-blur-sm">
        <div className="space-y-4 text-center sm:text-left">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
            CollabCanvas.ai
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Real-time idea canvases where humans and AI ship together.
          </h1>
          <p className="text-base text-muted-foreground sm:text-lg">
            Capture every idea, hand work off to AI teammates, and keep the whole team in sync with traces you can trust.
          </p>
        </div>
        <ul className="grid gap-4 text-left sm:grid-cols-3">
          {highlights.map((item) => (
            <li
              key={item}
              className="rounded-2xl border border-border/60 bg-background/80 px-5 py-4 text-sm text-foreground shadow-sm"
            >
              {item}
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            Week 1 goal: sticky notes → /cluster → /outline → trace timeline.
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild className="min-w-[9rem]">
              <Link
                href="https://github.com/vniharika35/collabcanvas-ai"
                target="_blank"
                rel="noreferrer"
              >
                View Repository
              </Link>
            </Button>
            <Button asChild variant="outline" className="min-w-[9rem]">
              <Link href="#roadmap">Explore Roadmap</Link>
            </Button>
          </div>
        </div>
      </section>
      <section id="roadmap" className="mt-12 w-full max-w-4xl rounded-3xl border border-dashed border-border/60 bg-background/40 p-10 text-sm text-muted-foreground shadow-inner">
        Roadmap coming soon: document milestones for realtime canvas, AI broker, and telemetry polish.
      </section>
    </main>
  );
}
