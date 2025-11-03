# CollabCanvas.ai

A real-time canvas where humans and AI co-create ideas, cluster notes, and draft outlines together in the same board.

## Why this exists
- Brainstorms stay in one multiplayer space with live cursors and tracked AI actions.
- AI teammates cluster, outline, and expand ideas directly on the board.
- Traceable AI interactions keep humans in control with quick accept, nudge, or undo flows.

## Repository structure
- `apps/web/` – Next.js App Router UI with shadcn/ui components.
- `services/ai-broker/` – FastAPI (or Go) service that hosts `/cluster` and `/outline` endpoints.
- `services/realtime/` – WebSocket + Yjs awareness layer with Redis for presence.
- `prisma/` – Prisma schema, migrations, and seeds for users, boards, nodes, and traces.
- `packages/shared/` – Shared zod types, API clients, and utilities across services.

## Initial setup
1. Install dependencies for each package (e.g. `pnpm install` for web, `pip install -r requirements.txt` for FastAPI).
2. Copy `.env.example` to `.env` in each service and fill in required secrets.
3. Run database migrations with `pnpm prisma migrate dev` (exact commands TBD).
4. Start the realtime service, AI broker, and web app (compose file coming soon).

## Demo checklist
- [ ] Drop sticky notes or pasted content onto a shared board.
- [ ] Trigger `/cluster` for semantic grouping via embeddings.
- [ ] Trigger `/outline` to structure the board into sections/tasks.
- [ ] Hand off a selection to the AI and review streamed edits.
- [ ] Inspect the trace sidebar for prompts, latency, and token metrics.

> Next steps: add Prisma schema, implement initial API handlers, and wire up the realtime collaboration loop.
