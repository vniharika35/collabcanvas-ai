import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";

let sdk: NodeSDK | null = null;

function exporterEndpoint() {
  const explicit = process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;
  if (explicit) return explicit;
  const base = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (base) {
    return `${base.replace(/\/$/, "")}/v1/traces`;
  }
  return "http://localhost:4318/v1/traces";
}

function parseHeaders(raw?: string) {
  if (!raw) return {};
  return raw.split(",").reduce<Record<string, string>>((acc, part) => {
    const [key, value] = part.split("=", 2);
    if (key && value) {
      acc[key.trim()] = value.trim();
    }
    return acc;
  }, {});
}

export async function initTelemetry() {
  if (sdk || typeof window !== "undefined") return sdk;
  if (process.env.OTEL_SDK_DISABLED === "true") return null;

  if (process.env.OTEL_LOG_LEVEL === "debug") {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
  }

  const traceExporter = new OTLPTraceExporter({
    url: exporterEndpoint(),
    headers: parseHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS)
  });

  sdk = new NodeSDK({
    traceExporter,
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: "collabcanvas-realtime",
      [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version ?? "0.1.0",
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV ?? "development",
    })
  });

  await sdk.start();

  const shutdown = async () => {
    await sdk?.shutdown().catch((error: unknown) => {
      console.warn("[telemetry] failed to shutdown realtime sdk", error);
    });
    sdk = null;
  };

  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);

  return sdk;
}
