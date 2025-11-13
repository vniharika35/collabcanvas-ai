from __future__ import annotations

import contextlib
import logging
import os
from typing import Iterator

from fastapi import FastAPI

logger = logging.getLogger(__name__)

try:  # Optional dependency: fall back to no-op tracer when OTEL packages are absent
  from opentelemetry import trace
  from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
  from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
  from opentelemetry.instrumentation.requests import RequestsInstrumentor
  from opentelemetry.sdk.resources import Resource
  from opentelemetry.sdk.trace import TracerProvider
  from opentelemetry.sdk.trace.export import BatchSpanProcessor

  _OTEL_AVAILABLE = True
except ModuleNotFoundError:  # pragma: no cover - executed only when deps missing locally
  trace = None  # type: ignore[assignment]
  OTLPSpanExporter = None  # type: ignore[assignment]
  FastAPIInstrumentor = None  # type: ignore[assignment]
  RequestsInstrumentor = None  # type: ignore[assignment]
  Resource = None  # type: ignore[assignment]
  TracerProvider = None  # type: ignore[assignment]
  BatchSpanProcessor = None  # type: ignore[assignment]
  _OTEL_AVAILABLE = False

_provider: "TracerProvider | None" = None


class _NullSpan:
  def set_attribute(self, *_args, **_kwargs) -> None:
    return None


@contextlib.contextmanager
def _null_span_context() -> Iterator[_NullSpan]:
  yield _NullSpan()


class _NullTracer:
  def start_as_current_span(self, _name: str):
    return _null_span_context()


def _exporter_endpoint() -> str:
  endpoint = os.getenv("OTEL_EXPORTER_OTLP_TRACES_ENDPOINT") or os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
  if endpoint:
    endpoint = endpoint.rstrip("/")
    if not endpoint.endswith("/v1/traces"):
      endpoint = f"{endpoint}/v1/traces"
    return endpoint
  return "http://localhost:4318/v1/traces"


def _exporter_headers() -> dict[str, str]:
  header_string = os.getenv("OTEL_EXPORTER_OTLP_HEADERS", "")
  headers: dict[str, str] = {}
  for pair in header_string.split(","):
    if not pair.strip() or "=" not in pair:
      continue
    key, value = pair.split("=", 1)
    headers[key.strip()] = value.strip()
  return headers


def init_telemetry(app: FastAPI) -> None:
  global _provider

  if os.getenv("OTEL_SDK_DISABLED", "false").lower() == "true":
    logger.info("OTEL_SDK_DISABLED=true; skipping telemetry init")
    return

  if not _OTEL_AVAILABLE:
    logger.warning("OpenTelemetry packages not installed; broker telemetry disabled.")
    return

  if _provider is not None:
    return

  resource = Resource.create({
    "service.name": "collabcanvas-ai-broker",
    "service.version": os.getenv("SERVICE_VERSION", "0.3.0"),
    "deployment.environment": os.getenv("DEPLOYMENT_ENV", os.getenv("NODE_ENV", "development")),
  })

  exporter = OTLPSpanExporter(endpoint=_exporter_endpoint(), headers=_exporter_headers(), timeout=5)
  provider = TracerProvider(resource=resource)
  provider.add_span_processor(BatchSpanProcessor(exporter))
  trace.set_tracer_provider(provider)

  RequestsInstrumentor().instrument()
  FastAPIInstrumentor.instrument_app(app, tracer_provider=provider)

  _provider = provider


def get_tracer():
  if _OTEL_AVAILABLE and trace is not None:
    return trace.get_tracer("collabcanvas-ai-broker")
  return _NullTracer()
