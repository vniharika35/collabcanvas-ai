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
from .telemetry import get_tracer, init_telemetry

app = FastAPI(
    title="CollabCanvas AI Broker",
    description="Stub service for AI-assisted clustering and outlining.",
    version="0.3.0",
)

init_telemetry(app)
tracer = get_tracer()


@app.get("/health")
async def health_check() -> dict[str, str]:
    """Simple health probe for local and deployment checks."""
    return {"status": "ok"}


@app.get("/")
async def root() -> dict[str, str]:
    return {"message": "CollabCanvas AI Broker ready to serve /cluster and /outline"}


@app.post("/cluster", response_model=ClusterResponse)
async def cluster_board(req: ClusterRequest) -> ClusterResponse:
    with tracer.start_as_current_span("broker.cluster") as span:
        span.set_attribute("board.id", req.board_id)
        span.set_attribute("request.node_count", len(req.node_ids))
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
        span.set_attribute("latency.ms", trace.latency_ms)
        span.set_attribute("cluster.groups", num_clusters)
        _log_trace("/cluster", trace.model_dump(by_alias=True), req.model_dump(by_alias=True))

        return ClusterResponse(assignments=assignments, embeddingsMs=embeddings_ms)


@app.post("/outline", response_model=OutlineResponse)
async def outline_board(req: OutlineRequest) -> OutlineResponse:
    with tracer.start_as_current_span("broker.outline") as span:
        span.set_attribute("board.id", req.board_id)
        span.set_attribute("cluster.id", req.cluster_id)
        if req.style:
            span.set_attribute("outline.style", req.style)

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
        span.set_attribute("latency.ms", trace.latency_ms)
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
