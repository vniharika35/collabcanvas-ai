import { createRealtimeServer } from "./server.js";
import { initTelemetry } from "./telemetry.js";

initTelemetry().catch((error) => {
  console.warn("[telemetry] failed to init realtime telemetry", error);
});

createRealtimeServer();
