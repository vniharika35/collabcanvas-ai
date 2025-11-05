# Phase 1 — Repo & MVP Skeleton

This phase locks in the foundation for CollabCanvas.ai: the pnpm workspace, shared package, FastAPI broker scaffold, and Prisma data model that the vertical slice depends on.

## Goals
- Establish the monorepo layout with `apps/`, `packages/`, `services/`, and `prisma/` directories managed via pnpm workspaces.
- Ship a working AI broker stub and shared SDK so the web app can exercise `/cluster` and `/outline` locally.
- Define the canonical Prisma schema and seed script for demo data that drives the first board experience.
- Capture environment requirements and bootstrap instructions for repeating the setup.

## What Shipped in Phase 1
- **Workspace scaffolding**: root `pnpm-workspace.yaml`, unified scripts (`dev:web`, `db:seed`, `db:migrate`), and `.env.example` covering database, Redis, AI, and telemetry variables.
- **Prisma schema**: models aligned with the product spec (`User`, `Board`, `Membership`, `Node`, `Trace`) plus enums for membership role, node kind, and trace metadata.
- **Seed data**: `prisma/seed.ts` provisions a launch board with twelve sticky notes, baseline cluster + outline traces, and an owner account for demos.
- **Shared client updates**: `@collabcanvas/shared` now exposes Zod schemas for the agreed contracts (`cluster`/`outline`) and a thin `AiBrokerClient` that enforces them.
- **AI broker stub**: FastAPI endpoints mirror the contracts, generate dummy cluster assignments/outline nodes, and log trace metadata for observability.
- **Dev preview**: `/dev/ai-preview` uses the shared client to call the stub, deriving an outline cluster from the cluster response.
- **Documentation**: `docs/setup.md` and this log track prerequisites, scaffolding commands, design choices, and call out pending integrations (Realtime, AI models, telemetry).

## How to Test Locally
1. Install dependencies (one-time): `pnpm install --no-frozen-lockfile` at repo root and `pip install -e "services/ai-broker/.[dev]"` in a Python venv.
2. Generate the Prisma client: `pnpm db:generate`.
3. Seed demo data: `pnpm db:seed` (requires a running Postgres instance pointed to by `DATABASE_URL`).
4. Start services:
   - Web: `pnpm dev:web`
   - AI broker: `uvicorn app.main:app --reload --app-dir services/ai-broker`
5. Visit `http://localhost:3000/dev/ai-preview` and run both sample buttons to validate the end-to-end contract.

## Pending for Phase 2
- Build the authenticated board route, load seeded nodes via Prisma, and render them on a canvas.
- Add REST (or tRPC) endpoints for board/node CRUD in the web app.
- Create a Trace sidebar UI that hydrates from Prisma instead of placeholder arrays.
- Expand documentation with API route details and database migration steps once CRUD lands.
