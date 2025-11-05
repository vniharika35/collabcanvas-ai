from typing import Literal

from pydantic import BaseModel, Field


class ClusterRequest(BaseModel):
    board_id: str = Field(..., alias="boardId")
    node_ids: list[str] = Field(..., alias="nodeIds", min_length=1)


class ClusterAssignment(BaseModel):
    node_id: str = Field(..., alias="nodeId")
    cluster_id: str = Field(..., alias="clusterId")


class ClusterResponse(BaseModel):
    assignments: list[ClusterAssignment]
    embeddings_ms: int = Field(..., alias="embeddingsMs")


class OutlineRequest(BaseModel):
    board_id: str = Field(..., alias="boardId")
    cluster_id: str = Field(..., alias="clusterId")
    style: Literal["concise", "detailed"] | None = None


class OutlineNode(BaseModel):
    title: str
    x: float
    y: float


class OutlineResponse(BaseModel):
    outline_nodes: list[OutlineNode] = Field(..., alias="outlineNodes")
    latency_ms: int = Field(..., alias="latencyMs")


class TraceRecord(BaseModel):
    trace_id: str = Field(..., alias="traceId")
    action: Literal["CLUSTER", "OUTLINE"]
    latency_ms: int = Field(..., alias="latencyMs")
    model: str
    tokens_in: int = Field(..., alias="tokensIn")
    tokens_out: int = Field(..., alias="tokensOut")

