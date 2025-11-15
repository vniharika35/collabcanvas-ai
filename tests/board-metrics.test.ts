import assert from "node:assert/strict";
import test from "node:test";

import { computeCanvasMetrics } from "../apps/web/src/components/board/metrics";

test("returns fallback metrics when no nodes", () => {
  const metrics = computeCanvasMetrics([]);
  assert.equal(metrics.width, 1200);
  assert.equal(metrics.height, 900);
  assert.equal(metrics.offsetX, -200);
  assert.equal(metrics.offsetY, -200);
});

test("expands canvas based on node spread", () => {
  const metrics = computeCanvasMetrics([
    { x: -100, y: -50 },
    { x: 600, y: 400 }
  ]);

  assert.ok(metrics.width > 1200);
  assert.ok(metrics.height > 900);
  assert.ok(metrics.offsetX <= -100);
  assert.ok(metrics.offsetY <= -50);
});

test("adds padding to tight clusters", () => {
  const metrics = computeCanvasMetrics([
    { x: 0, y: 0 },
    { x: 20, y: 20 }
  ]);

  assert.ok(metrics.width > 320);
  assert.ok(metrics.height > 220);
});
