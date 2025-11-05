# Phase 2 — Board & Persistence

This phase delivers the first interactive board experience: sticky notes persisted with Prisma, editable in the UI, and paired with a trace stream sourced from the database.

## Goals
- Turn the board route into a data-backed surface that hydrates from Postgres via Prisma.
- Allow users to create, drag, edit, and delete sticky notes with optimistic UI updates.
- Expose RESTful API endpoints for board metadata and node CRUD operations.
- Render a Trace sidebar that lists recent AI/human actions from the `Trace` model.

## What Shipped in Phase 2
- **Prisma client wrapper**: `apps/web/src/lib/prisma.ts` ensures a single Prisma instance during Next.js hot reloads.
- **Board API**: `GET /api/boards/[boardId]` returns board details, nodes, and the latest traces. `/api/boards/[boardId]/nodes` handles `GET` + `POST`, while `/api/boards/[boardId]/nodes/[nodeId]` supports `PATCH` + `DELETE` with Zod validation.
- **Board UI**: the `/board/[boardId]` page is now an async server component that loads Prisma data, passing it to the new `BoardClient` client component for interaction.
- **Sticky note interactions**: users can add notes, drag them around the canvas, edit text inline, and delete notes. Position/text updates persist through the API.
- **Trace panel**: right sidebar lists the 10 most recent traces with action, actor, latency, and model metadata, fed by Prisma and refreshed after mutations.

## How to Test Locally
1. Ensure dependencies are installed (`pnpm install`) and the Prisma client is generated (`pnpm db:generate`).
2. Seed the database with demo data via `pnpm db:seed`.
3. Run the web app: `pnpm dev:web`.
4. Visit `http://localhost:3000/board/<seeded-board-id>` (seed logs the ID) to confirm:
   - Notes load in their seeded positions.
   - “Add sticky note” creates a new persisted note.
   - Dragging a note updates its position; refreshing keeps the new coordinates.
   - Editing note text and blurring saves the change.
   - Delete removes the note immediately.
   - The Trace panel shows the seeded `/cluster` and `/outline` actions.
5. Use `curl` or REST client to hit the new endpoints, e.g. `GET http://localhost:3000/api/boards/<id>`.

## Pending for Phase 3
- Wire the realtime service so note edits propagate across clients instantly.
- Broadcast trace updates in realtime instead of on manual refresh.
- Introduce presence indicators and selection syncing on top of the canvas.
- Formalise API error handling (problem responses, rate limits) once auth is integrated.
