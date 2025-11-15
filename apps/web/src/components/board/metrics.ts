export interface CanvasMetricNode {
  x: number;
  y: number;
}

export interface CanvasMetrics {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
}

const FALLBACK_METRICS: CanvasMetrics = {
  width: 1200,
  height: 900,
  offsetX: -200,
  offsetY: -200,
};

export function computeCanvasMetrics(nodes: CanvasMetricNode[]): CanvasMetrics {
  if (nodes.length === 0) {
    return FALLBACK_METRICS;
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const node of nodes) {
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    maxX = Math.max(maxX, node.x);
    maxY = Math.max(maxY, node.y);
  }

  const padding = 240;
  const noteWidth = 320;
  const noteHeight = 220;

  const offsetX = Math.min(0, minX - padding);
  const offsetY = Math.min(0, minY - padding);
  const width = Math.max(maxX - offsetX + padding + noteWidth, FALLBACK_METRICS.width);
  const height = Math.max(maxY - offsetY + padding + noteHeight, FALLBACK_METRICS.height);

  return { width, height, offsetX, offsetY };
}
