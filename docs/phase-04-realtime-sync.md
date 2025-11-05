# Phase 4 — Yjs Persistence & Canvas Sync

This phase elevates the realtime layer from presence-only to full sticky-note synchronization. Yjs now holds the source of truth for board notes, with automatic persistence to Postgres so the web app, realtime service, and database stay aligned.

## Goals
- Load board notes from Postgres into a shared Yjs document when the first client connects.
- Broadcast local edits (create, drag, type, delete) through Yjs so other clients see updates instantly.
- Debounce writes back to Postgres for durability without hammering the database.
- Update the web client to author changes via Yjs instead of HTTP endpoints.

## What Shipped
- **Doc initialization**: `DocManager.ensureInitialized` hydrates each board doc from Prisma using `loadBoardNodes`. Idle docs persist back and tear down cleanly.
- **Persistence loop**: local Yjs updates schedule a debounced flush via `persistBoardNodes`, performing `upsert` + `deleteMany` transactions.
- **Realtime hook upgrade**: `useRealtimePresence` now exposes the shared `Y.Doc`, letting the UI observe and mutate the document alongside presence.
- **Canvas rewrite**: `BoardClient` consumes the Yjs map for sticky notes, calling `doc.transact` for add/move/edit/delete. Text changes stream live and highlight remote selections.
- **Redis coordination**: doc updates still fan out through Redis, while only the origin instance persists (remote replicas apply with origin "remote").

## How to Test Locally
1. Install new dependencies: `pnpm install` (adds `@prisma/client` to the realtime package).
2. Run services:
   ```bash
   pnpm --filter @collabcanvas/realtime dev
   pnpm dev:web
   ```
3. Open `http://localhost:3000/board/<board-id>` in two tabs.
4. Create a sticky note in tab A → appears instantly in tab B and auto-selects.
5. Drag a note around or type in it → movement/text mirror live in the other tab.
6. Delete a note → it disappears everywhere and is removed from Postgres (verify with Prisma or reload the page).

## Follow-ups
- Feed `/cluster` and `/outline` ghost edits into the same Yjs doc so AI changes respect realtime persistence.
- Broadcast trace updates via the realtime channel instead of polling.
- Add optimistic conflict resolution / locking semantics for richer node structures (groups, outlines, AI drafts).
- Instrument the new persistence path with OpenTelemetry spans.
