# CollabCanvas AI Broker

FastAPI service that will host AI-assisted endpoints like `/cluster` and `/outline`.

## Quickstart
1. Create a virtual environment (example):
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```
2. Install dependencies:
   ```bash
   pip install -e ".[dev]"
   ```
3. Run the dev server:
   ```bash
   uvicorn app.main:app --reload
   ```
4. Hit the health check:
   ```bash
   curl http://localhost:8000/health
   ```

## Environment variables
- `OPENAI_API_KEY` (future): required once real AI providers are wired in.
- `TRACES_BUCKET` (future): destination for long-lived prompt/response archives.

## Roadmap
- [x] Define request/response models for `/cluster` and `/outline`.
- [x] Log prompt traces and token usage for each AI call (stubbed console output).
- [ ] Stream partial responses to improve perceived latency.
- [ ] Persist traces and payloads using Prisma once the data layer is connected.
