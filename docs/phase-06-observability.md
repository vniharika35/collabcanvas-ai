# Phase 06 – Observability & Launch Polish

Phase 6 focused on delivering realtime trace updates, instrumenting every service with OpenTelemetry, and restoring automated checks so the stack is ready for launch.

## Highlights

- **Realtime Trace Streaming** – trace entries are now broadcast over the WebSocket channel. Clients append traces instantly without polling and the panel copy reflects the live feed.
- **Telemetry Across Services**
  - `apps/web` boots a NodeSDK in `instrumentation.ts`, exposes a `withSpan` helper, and wraps Prisma + API handlers.
  - `services/realtime` starts its own SDK, instruments the Redis/doc storage hot paths, and ships trace append spans.
  - `services/ai-broker` configures OTLP exporters, instruments FastAPI via OpenTelemetry, and wraps `/cluster` + `/outline` spans.
- **Collector + Dashboards** – `observability/otel-collector.yaml` exposes OTLP/HTTP + Prometheus spanmetrics, while `observability/grafana/*.json` contains import-ready Grafana dashboards for service health and trace insights.
- **Automated Tests** – Vitest covers shared schemas and the trace handler, while Playwright drives a full sticky note → `/cluster` → `/outline` acceptance flow. New npm scripts run both suites.
- **Board Polish** – data-test hooks for automation, aria-live error messaging, and refreshed trace panel messaging.

## Telemetry Quickstart

1. Export collector details (example):
   ```bash
   export OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:4318"
   export OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer supersecret"
   ```
2. Start the OTLP collector:
   ```bash
   docker run --rm -v "$PWD/observability/otel-collector.yaml":/etc/otel.yaml -p 4317:4317 -p 4318:4318 -p 8889:8889 otel/opentelemetry-collector:0.104.0 --config=/etc/otel.yaml
   ```
3. Boot services normally (`pnpm dev:web`, realtime dev server, FastAPI). Spans will flow to the collector and Prometheus endpoint (`:8889`) for Grafana dashboards.
4. Import dashboards from `observability/grafana/service-health.json` and `observability/grafana/trace-insights.json`, pointing their datasource variables to your Prometheus + Tempo backends.

## Testing

- **Unit tests**: `pnpm test:unit` (Vitest). Covers shared schemas plus the `POST /api/boards/[boardId]/traces` handler.
- **E2E flow**: `pnpm test:e2e` (Playwright). Requires the web app, realtime server, AI broker, and Postgres with seed data. Install browsers via `pnpm exec playwright install` the first time.
- **Combined**: `pnpm test:all` runs both suites sequentially.

## Developer Notes

- Realtime trace streaming relies on the existing WebSocket connection. Clients broadcast the persisted trace payload so peers update instantly.
- Telemetry is opt-out via `OTEL_SDK_DISABLED=true`.
- The collector config enables spanmetrics → Prometheus for dashboards; adjust `OTLP_UPSTREAM_*` env vars when forwarding traces to Grafana Cloud/Tempo.
