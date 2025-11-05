/* eslint-disable no-console */
export function log(...args: unknown[]) {
  console.log("[realtime]", ...args);
}

export function warn(...args: unknown[]) {
  console.warn("[realtime]", ...args);
}

export function error(...args: unknown[]) {
  console.error("[realtime]", ...args);
}
