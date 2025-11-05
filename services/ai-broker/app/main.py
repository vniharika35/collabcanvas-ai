import random
import time
import uuid
from typing import Any

from fastapi import FastAPI

from .models import (
    ClusterAssignment,
    ClusterRequest,
    ClusterResponse,
    OutlineNode,
    OutlineRequest,
    OutlineResponse,
    TraceRecord,
)

app = FastAPI(
    title="CollabCanvas AI Broker",
    description="Stub service for AI-assisted clustering and outlining.",
    version="0.3.0",
)


@app.get("/health")
async def health_check() -> dict[str, str]:
    """Simple health probe for local and deployment checks."""
    return {"status": "ok"}


@app.get("/")
async def root() -> dict[str, str]:
    return {"message": "CollabCanvas AI Broker ready to serve /cluster and /outline"}


@app.post("/cluster", response_model=ClusterResponse)
async def cluster_board(req: ClusterRequest) -> ClusterResponse:
    start = time.monotonic()
    num_clusters = min(4, max(2, len(req.node_ids) // 3 or 2))

    assignments: list[ClusterAssignment] = []
    for idx, node_id in enumerate(req.node_ids):
        assignments.append(
            ClusterAssignment(node_id=node_id, cluster_id=f"cluster-{idx % num_clusters}")
        )

    embeddings_ms = random.randint(420, 860)
    trace = TraceRecord(
        traceId=uuid.uuid4().hex,
        action="CLUSTER",
        latencyMs=int((time.monotonic() - start) * 1000),
        model="gpt-4.1-mini",
        tokensIn=512 + len(req.node_ids) * 32,
        tokensOut=128,
    )
    _log_trace("/cluster", trace.model_dump(by_alias=True), req.model_dump(by_alias=True))

    return ClusterResponse(assignments=assignments, embeddingsMs=embeddings_ms)


@app.post("/outline", response_model=OutlineResponse)
async def outline_board(req: OutlineRequest) -> OutlineResponse:
    start = time.monotonic()

    outline_nodes: list[OutlineNode] = []
    baseline_x = 320.0
    baseline_y = -120.0
    for idx in range(4):
        outline_nodes.append(
            OutlineNode(
                title=f"{req.cluster_id.replace('cluster-', '').title()} Step {idx + 1}",
                x=baseline_x,
                y=baseline_y + idx * 120,
            )
        )

    trace = TraceRecord(
        traceId=uuid.uuid4().hex,
        action="OUTLINE",
        latencyMs=int((time.monotonic() - start) * 1000),
        model="gpt-4.1-mini",
        tokensIn=420,
        tokensOut=256,
    )
    _log_trace("/outline", trace.model_dump(by_alias=True), req.model_dump(by_alias=True))

    latency_ms = random.randint(800, 1500)
    return OutlineResponse(outlineNodes=outline_nodes, latencyMs=latency_ms)


def _log_trace(endpoint: str, trace: dict[str, Any], request_payload: dict[str, Any]) -> None:
    """Placeholder observability hook until Prisma + telemetry are wired up."""
    print(  # noqa: T201 - intentional stdout logging during stub phase
        {
            "endpoint": endpoint,
            "trace": trace,
            "request": request_payload,
        }
    )
