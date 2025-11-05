# CollabCanvas Realtime Service

TypeScript WebSocket server that coordinates shared canvases with Yjs documents and presence state backed by Redis.

## Features
- One WebSocket channel per board (`ws://localhost:3011/ws?boardId=<id>`).
- Persisted Yjs document per board; broadcasts binary updates to connected clients.
- Presence payloads (`{ userId, name, color, cursor, selection }`) fan out to all clients and propagate across instances through Redis pub/sub.
- Idle board docs release after five minutes with no connections.
- Graceful shutdown hooks for SIGINT/SIGTERM.

## Local Development
1. Install dependencies from the repo root (requires network access):
   ```bash
   pnpm install
   ```
2. Copy environment variables:
   ```bash
   cp .env.example services/realtime/.env.example
   ```
   (or export `REDIS_URL`/`PORT` directly).
3. Start Redis (or reuse the instance declared in `REDIS_URL`).
4. Run the realtime dev server:
   ```bash
   pnpm --filter @collabcanvas/realtime dev
   ```
5. Connect a client:
   ```bash
   wscat -c "ws://localhost:3011/ws?boardId=demo"
   ```

## Environment Variables
- `PORT` (default `3011`) – HTTP/WebSocket port.
- `REDIS_URL` – optional Redis connection string; if omitted the server runs single-instance only.
- `HEARTBEAT_INTERVAL_MS` – interval between heartbeat checks (future use).
- `DOC_IDLE_TTL_MS` – milliseconds before an idle board doc is released (default 5 minutes).

## Scripts
- `pnpm --filter @collabcanvas/realtime dev` – run with live reload (`tsx watch`).
- `pnpm --filter @collabcanvas/realtime build` – emit JS to `dist/`.
- `pnpm --filter @collabcanvas/realtime start` – run compiled output.

## Next Steps
- Store awareness heartbeats in Redis to evict stale presence across instances.
- Integrate authentication/authorization (JWT or session token) during the handshake.
- Enrich telemetry with OpenTelemetry spans for `ws.join`, `realtime.broadcast`, etc.
