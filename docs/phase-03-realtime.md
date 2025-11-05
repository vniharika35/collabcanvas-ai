# Phase 3 — Realtime Presence & Yjs

This phase introduces the realtime substrate that keeps multiple board viewers in sync: a WebSocket service built on Yjs and Redis, plus client hooks that surface live cursors and selections on the canvas.

## Goals
- Stand up the realtime Node/TypeScript service with WebSocket transport, Yjs doc management, and Redis pub/sub fan-out.
- Stream sticky note presence (cursor + selection) between clients, proving the infrastructure before syncing board content.
- Instrument the web app to consume realtime events and render multiplayer affordances (cursors, selection outlines).

## What Shipped in Phase 3
- **Realtime service package** (`services/realtime/`):
  - WebSocket server with `ws`, `yjs`, `y-protocols`, and `ioredis`.
  - Per-board document manager that applies local updates, broadcasts to connected clients, and relays cross-instance events via Redis.
  - Presence channel storing `{ userId, name, color, cursor, selection }` payloads with idle TTL cleanup.
  - Graceful shutdown, optional Redis support, and service-level README + `.env.example`.
- **Web client hook** (`useRealtimePresence`): encapsulates WebSocket lifecycle, merges Yjs state, and emits presence patches (`cursor`, `selection`).
- **Board UI updates**:
  - Live cursor indicators with user badges.
  - Remote selection highlights layered onto sticky notes.
  - Presence-aware interactions: selection changes and pointer moves broadcast through the realtime hook.
  - New env config (`NEXT_PUBLIC_REALTIME_URL`) to point the client at different realtime deployments.

## How to Test Locally
1. Install dependencies (`pnpm install`) so the realtime package can compile.
2. (Optional) start Redis (`docker compose up redis`) or rely on single-instance mode.
3. Run the realtime service: `pnpm --filter @collabcanvas/realtime dev`.
4. Start the web app: `pnpm dev:web`.
5. Open `http://localhost:3000/board/<board-id>` in two browser windows:
   - Move the cursor around the canvas — a colored pointer appears in the other tab.
   - Select a sticky note — the peer sees a tinted outline showing your selection.
   - Drag sticky notes — positions persist via Prisma while presence stays in sync.

## Pending for Phase 4
- Persist sticky note updates through Yjs + Prisma reconciliation (today the doc tracks presence only).
- Broadcast trace updates via realtime instead of polling.
- Integrate authentication/authorization into the WebSocket handshake.
- Add telemetry spans (`ws.join`, `realtime.broadcast`) and dashboard panels to observe presence load.
