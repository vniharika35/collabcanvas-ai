# Phase 5 — AI Ghost Edits

AI helpers now participate directly on the board. The `/cluster` flow colours sticky notes in realtime, while `/outline` writes ghost outline nodes into the Yjs document so teammates can review and accept (or undo) the draft before it persists to Postgres.

## Goals
- Call the FastAPI broker from the board UI and reflect results immediately in the shared Yjs document.
- Represent AI-generated outline items as **ghost nodes** until a human accepts them.
- Keep the Prisma-backed trace log and sticky notes in sync with realtime edits.

## What Shipped
- **Cluster command**: top-bar button calls `aiClient.cluster`, sets `clusterId` on sticky notes, and logs a trace via `POST /api/boards/[boardId]/traces`.
- **Outline command**: outlines the selected cluster, creates ghost `OUTLINE` nodes in Yjs, and surfaces Accept / Undo controls that toggle the `ghost` flag or remove nodes.
- **Realtime persistence**: doc snapshots store `{ id, kind, x, y, text, clusterId, ghost }`; ghost nodes are skipped during Prisma upserts until accepted.
- **Trace updates**: new traces append to the sidebar without reloads, keeping latency/model metadata visible.
- **UI polish**: cluster colours, ghost badges, disabled actions while AI runs, and selection-aware outline gating.

## How to Demo
1. Run the realtime service, FastAPI broker, and web app (`pnpm --filter @collabcanvas/realtime dev`, `pnpm dev:web`).
2. Open `http://localhost:3000/board/<board-id>` in two tabs.
3. Click **/cluster** – sticky notes recolour instantly across both tabs.
4. Select a clustered note and click **/outline** – ghost outline cards appear; Accept commits them, Undo removes them.
5. Observe the Trace panel logging both actions with latency/model metadata.

## Follow-ups
- Stream trace updates over websockets instead of refreshing from Prisma.
- Incorporate AI ghosts for additional actions (undo/redo, nudge) and enrich outline payloads.
- Harden error states (retry, partial failures) and add user-facing toast notifications.
