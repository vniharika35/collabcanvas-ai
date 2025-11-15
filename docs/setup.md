# CollabCanvas.ai Setup Log

This log captures the environment checks and scaffolding steps completed so far. Treat it as the reference for reproducing the repo bootstrap or summarising technical choices in docs/PRs.

## Tooling Prerequisites
- Node.js `v20.12.1` — confirmed via `node -v`
- pnpm `10.20.0` — confirmed via `pnpm -v`
- Python `3.11.4` — confirmed via `python3 --version`
- pip `25.2` — confirmed via `pip3 --version`
- Redis `8.2.3` — confirmed via `redis-server --version`

> Why: the web app runs on Next.js (Node + pnpm), the AI broker uses Python, and Redis powers realtime presence/publication. Verifying versions early prevents runtime surprises.

## Repository Structure Recap
- `apps/web` — Next.js App Router client with Tailwind v4 + shadcn/ui.
- `services/ai-broker` — FastAPI service for `/cluster` + `/outline` (stubbed end-to-end).
- `services/realtime` — WebSocket + Yjs sync layer (scaffold pending).
- `prisma` — `schema.prisma`, migrations, and seed data.
- `packages/shared` — Zod schemas and SDK used by web + services.

## Workspace Configuration
1. Created `pnpm-workspace.yaml` to include `apps/*`, `services/*`, and `packages/*`.
2. Added root scripts: `dev:web`, `build:web`, `lint:web`, `db:migrate`, `db:generate`, `db:format`, `db:seed`.
3. Added `.env.example` (root) with required variables for Postgres, Redis, AI model keys, and telemetry endpoints. The web app reads env vars from `apps/web/.env.local`, so copy the same `DATABASE_URL` there before running `pnpm dev:web`.
4. Hydrated dependencies with `pnpm install` (requires external network, run with `--no-frozen-lockfile` when updating the lockfile).

## Web App Scaffold
- Generated the Next.js project via
  ```bash
  CI=1 pnpm create next-app apps/web \
    --ts --tailwind --eslint --app --src-dir \
    --import-alias "@/*" --no-react-compiler
  ```
- Initialised shadcn/ui (`pnpm dlx shadcn@latest init`) and imported Button, Dialog, Dropdown Menu components.
- Landing page copy updated (`apps/web/src/app/page.tsx`) to reflect the CollabCanvas.ai vision.
- Board route scaffolded at `src/app/(board)/board/[boardId]/page.tsx` with a header layout exposing invite/presence affordances.
- Dev preview at `/dev/ai-preview` exercises the AI broker via the shared client and mirrors the latest API contracts.

## Data Layer
- `prisma/schema.prisma` now matches the agreed MVP model:
  - `User`, `Board`, `Membership`, `Node`, `Trace`.
  - Enums: `MembershipRole`, `NodeKind (STICKY|GROUP|OUTLINE)`, `TraceActor (USER|AI)`, `TraceAction (CLUSTER|OUTLINE)`.
  - `Node` tracks position (`x`, `y`), JSON `content`, and optional `clusterId`.
  - `Trace` captures actor, action, latency, model, token counts, and JSON prompt/response payloads.
- Added `prisma/seed.ts` that cleans the schema and loads:
  - Founder user, launch board, twelve sticky notes with seeded positions.
  - Sample trace rows for `/cluster` and `/outline` to populate the UI timeline.
- Root `package.json` exposes:
  ```json
  "scripts": {
    "db:migrate": "prisma migrate dev",
    "db:generate": "prisma generate",
    "db:seed": "prisma db seed"
  },
  "prisma": {
    "seed": "pnpm exec tsx prisma/seed.ts"
  }
  ```
  (Install `tsx` via pnpm before running the seed command.)

## AI Broker Service
- Scaffolded FastAPI app under `services/ai-broker/` with `pyproject.toml` managing runtime + dev dependencies.
- `/cluster`: accepts `{ boardId, nodeIds[] }`, returns 
  `{ assignments: [{ nodeId, clusterId }], embeddingsMs }`.
- `/outline`: accepts `{ boardId, clusterId, style? }`, returns
  `{ outlineNodes: [{ title, x, y }], latencyMs }`.
- Both endpoints generate deterministic-but-randomised placeholder results and log a `TraceRecord` for observability stubs.
- `requests.http` updated to mirror the new payloads.
- Run locally with `uvicorn app.main:app --reload --app-dir services/ai-broker`.

## Shared Type Definitions
- `packages/shared` exposes the latest Zod schemas and `AiBrokerClient` wrapper.
- `dist/` mirrors the updated contract so consumers can import without a fresh build (until network access allows `pnpm --filter @collabcanvas/shared build`).
- Web app imports it via workspace dependency `@collabcanvas/shared`.

## Documentation TODOs
- Create Phase docs per roadmap milestone (starting with `docs/phase-01-repo-and-mvp-skeleton.md`).
- Record Prisma migration commands once schemas stabilise and migrations are generated.
- Document realtime server scaffold + Redis setup when Phase 3 work begins.
- Capture environment variable usage for each service as integration deepens (AI model keys, OTEL collectors, etc.).


## Board Experience (Phase 2)
- Prisma client helper lives in `apps/web/src/lib/prisma.ts` to keep a singleton across dev reloads.
- API routes under `src/app/api/boards/[boardId]/**` expose board hydration, node CRUD (`GET/POST/PATCH/DELETE`).
- Board UI (`/board/[boardId]`) now loads data server-side and hands it to a client canvas that supports add/drag/edit/delete for sticky notes.
- Trace sidebar pulls the 10 most recent rows from Prisma and auto-refreshes after note mutations.
- Use the seeded board ID from `pnpm db:seed` to exercise the flow locally.


## Realtime Service (Phase 3)
- Workspace package lives at `services/realtime` with its own `package.json` + `tsconfig.json`.
- Dependencies: `ws`, `yjs`, `y-protocols`, `ioredis`, `uuid`, `zod`. Install via `pnpm install` at repo root.
- Dev command: `pnpm --filter @collabcanvas/realtime dev` (relies on `tsx`).
- Exposes websocket endpoint `ws://localhost:3011/ws?boardId=<id>` and broadcasts binary Yjs updates + JSON presence events.
- Redis is optional locally; without `REDIS_URL` the service works in single-instance mode.
- Web client connects via `NEXT_PUBLIC_REALTIME_URL` (see `apps/web/.env.example`).


## Realtime Persistence (Phase 4)
- Realtime service now depends on `@prisma/client`; run `pnpm install` after pulling to hydrate new dependencies.
- `services/realtime` loads board nodes from Postgres into a Yjs doc on first connection and persists edits back (debounced).
- Client-side board edits mutate the shared doc directly; HTTP CRUD endpoints remain for compatibility but are no longer used by the UI.
- Presence hook (`useRealtimePresence`) now returns the shared `Y.Doc` for live data binding in the canvas.
- Sticky note changes (text, position, deletion) sync across tabs immediately and flush to Postgres within ~750ms.


## AI Actions (Phase 5)
- Toolbar buttons on the board call the FastAPI broker: `/cluster` recolours sticky notes, `/outline` drops ghost outline nodes.
- Ghost nodes are tagged in the Yjs document (`ghost: true`) and only persist once the user clicks **Accept outline**.
- Outline Accept/Undo mutate the shared doc, triggering the realtime persistence loop and updating Postgres automatically.
- Traces are recorded through `POST /api/boards/[boardId]/traces`, keeping the sidebar up to date with latency/model metadata.

## Testing
- `pnpm test:unit` runs Node's built-in test runner via `tsx` and currently verifies canvas metric calculations; expand the `tests/` directory as more utilities become factored out.

## UX Refresh (Phase 6)
- The landing page now fetches recent boards and ships with a Board Navigator widget so anyone can paste or copy a board id and immediately open `/board/<id>`.
- Workflow + system overview sections explain how realtime sync, the AI broker, and Prisma traces interact, helping contributors understand where data is saved without leaving the UI.
- Board headers display realtime/AI/persistence status badges alongside a “Board guide” card and data-location checklist.
- See `docs/phase-06-ux-polish.md` for the full rationale and follow-up tasks (presence-aware chrome, realtime trace streaming, onboarding tour).
