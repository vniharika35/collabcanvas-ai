import { startWebTelemetry } from "./src/lib/otel";

export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") {
    return;
  }

  try {
    await startWebTelemetry();
    console.info("[telemetry] Web SDK initialised");
  } catch (error) {
    console.error("[telemetry] Failed to start web SDK", error);
  }
}
