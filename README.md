# CollabCanvas.ai

A realtime canvas where humans and AI teammates co-create ideas, cluster sticky notes, and draft outlines on the same board.

## Vision
- Keep brainstorms in one multiplayer surface with live cursors and traceable AI edits.
- Let AI cluster, outline, and expand selections while people stay in control through accept/undo flows.
- Capture observability end to end so operators can inspect prompts, latency, and token usage.

## Monorepo Layout
```
collabcanvas-ai/
  apps/web/                 # Next.js App Router UI (Tailwind + shadcn/ui)
  services/ai-broker/       # FastAPI endpoints powering /cluster and /outline
  services/realtime/        # Node/TS WebSocket + Yjs server (coming in Phase 3)
  packages/shared/          # Shared Zod schemas + API client
  prisma/                   # Prisma schema, migrations, and seed data
  docs/                     # Phase-by-phase documentation and setup log
```

## Getting Started
1. **Install dependencies** (requires external network access):
   ```bash
   pnpm install --no-frozen-lockfile
   python3 -m venv services/ai-broker/.venv && source services/ai-broker/.venv/bin/activate
   pip install -e "services/ai-broker/.[dev]"
   ```
2. **Environment variables**: copy `.env.example` to `.env` at the repo root and fill in real values as needed.
3. **Database**: ensure Postgres is running and reachable via `DATABASE_URL`. Redis is required once realtime work starts.
4. **Prisma client & seed data**:
   ```bash
   pnpm db:generate
   pnpm db:seed
   ```
5. **Run services**:
   ```bash
   pnpm dev:web                                # Next.js dev server
   pnpm --filter @collabcanvas/realtime dev    # Realtime WebSocket service
   uvicorn app.main:app --reload \
     --app-dir services/ai-broker              # FastAPI broker (port 8000)
   ```
6. Visit `http://localhost:3000/dev/ai-preview` to trigger `/cluster` and `/outline` stub calls end-to-end.
7. Visit `http://localhost:3000/board/<your-board-id>` (from the seed output) to interact with the persisted sticky note canvas.
8. Use the board toolbar to run `/cluster` and `/outline`, then accept or undo ghost outline nodes.
9. Open the board in a second tab to watch live cursors, selections, and edits sync through the realtime service.

> **Note:** The workspace currently operates offline in CI, so rebuilding `packages/shared` uses the pre-generated `dist/` output until pnpm can fetch dependencies locally.

## Data Model (Prisma)
- `User` — `{ id, email, name?, createdAt }`
- `Board` — `{ id, title, ownerId, createdAt }`
- `Membership` — `{ id, boardId, userId, role (OWNER|EDITOR|VIEWER) }`
- `Node` — `{ id, boardId, kind (STICKY|GROUP|OUTLINE), x, y, content JSON, clusterId?, createdAt, updatedAt }`
- `Trace` — `{ id, boardId, actor (USER|AI), action (CLUSTER|OUTLINE), prompt JSON?, response JSON?, latencyMs?, model?, tokensIn?, tokensOut?, createdAt }`

`prisma/seed.ts` provisions a launch-planning board with twelve sticky notes and starter trace rows so the UI has meaningful demo data.

Configure the web client by copying `apps/web/.env.example` (includes `NEXT_PUBLIC_AI_BROKER_URL` and `NEXT_PUBLIC_REALTIME_URL`).

## API Contracts (shared across TS + Python)
- `POST /cluster`
  - Request: `{ boardId: string, nodeIds: string[] }`
  - Response: `{ assignments: Array<{ nodeId: string, clusterId: string }>, embeddingsMs: number }`
- `POST /outline`
  - Request: `{ boardId: string, clusterId: string, style?: "concise" | "detailed" }`
  - Response: `{ outlineNodes: Array<{ title: string, x: number, y: number }>, latencyMs: number }`

These schemas live in `packages/shared` and are mirrored by FastAPI Pydantic models.

## Current Status
- ✅ Phase 1 (Repo & MVP skeleton) — workspace, shared SDK, AI broker stubs, Prisma schema + seed, dev preview page.
- ✅ Phase 2 (Board + Persistence) — Prisma-backed board route with sticky note CRUD + trace sidebar.
- ✅ Phase 3 (Realtime Presence & Yjs) — realtime service with live cursors + selections.
- ✅ Phase 4 (Realtime data sync) — Yjs-powered sticky note state persisted to Postgres.
- ✅ Phase 5 (AI ghost edits) — `/cluster` colours sticky notes and `/outline` streams ghost nodes with accept/undo flows.
- 🚧 Phase 6 (Observability & polish) — telemetry, trace streaming, automated tests, and launch hardening.

Follow progress in `docs/phase-01-repo-and-mvp-skeleton.md`, `docs/phase-02-board-and-persistence.md`, `docs/phase-03-realtime.md`, `docs/phase-04-realtime-sync.md`, `docs/phase-05-ai-ghost-edits.md`, and the running log in `docs/setup.md`.

## Useful Commands
- `pnpm dev:web` — run the Next.js dev server.
- `pnpm --filter @collabcanvas/realtime dev` — start the realtime WebSocket service.
- `pnpm db:migrate` — apply Prisma migrations.
- `pnpm db:seed` — reset + seed the database (uses `tsx`; install deps first).
- `pnpm --filter @collabcanvas/shared build` — rebuild the shared package once pnpm deps are installed.
- `uvicorn app.main:app --reload --app-dir services/ai-broker` — start the AI broker.

## Next Up
1. Broadcast trace updates and AI status over the realtime channel instead of polling.
2. Instrument services with OpenTelemetry (collector, Grafana dashboards) and surface spans in the Trace panel.
3. Restore automated checks: lint/typecheck, schema tests, and an end-to-end flow covering `/cluster` + `/outline`.
