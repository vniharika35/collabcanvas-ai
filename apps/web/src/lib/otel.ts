import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";

const GLOBAL_KEY = Symbol.for("collabcanvas.web.otelsdk");

interface OtelGlobal extends Global {
  [GLOBAL_KEY]?: NodeSDK | null;
}

function getGlobalScope() {
  return globalThis as OtelGlobal;
}

function buildExporterUrl() {
  const explicit = process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;
  if (explicit) {
    return explicit;
  }
  const base = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (base) {
    return `${base.replace(/\/$/, "")}/v1/traces`;
  }
  return "http://localhost:4318/v1/traces";
}

function parseHeaders(raw?: string) {
  if (!raw) return {};
  return raw.split(",").reduce<Record<string, string>>((acc, entry) => {
    const [key, value] = entry.split("=", 2);
    if (key && value) {
      acc[key.trim()] = value.trim();
    }
    return acc;
  }, {});
}

let shuttingDown = false;

async function shutdownSdk(sdk: NodeSDK) {
  if (shuttingDown) return;
  shuttingDown = true;
  await sdk.shutdown().catch((error: unknown) => {
    console.warn("[telemetry] Failed to shut down web SDK", error);
  });
}

export async function startWebTelemetry() {
  if (typeof window !== "undefined") {
    return null;
  }

  if (process.env.OTEL_SDK_DISABLED === "true") {
    return null;
  }

  const scope = getGlobalScope();
  if (scope[GLOBAL_KEY]) {
    return scope[GLOBAL_KEY];
  }

  if (process.env.OTEL_LOG_LEVEL === "debug") {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
  }

  const exporter = new OTLPTraceExporter({
    url: buildExporterUrl(),
    headers: parseHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS)
  });

  const sdk = new NodeSDK({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: "collabcanvas-web",
      [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version ?? "0.1.0",
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV ?? "development",
    }),
    traceExporter: exporter,
  });

  await sdk.start();
  scope[GLOBAL_KEY] = sdk;

  const stop = () => shutdownSdk(sdk);
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);

  return sdk;
}
