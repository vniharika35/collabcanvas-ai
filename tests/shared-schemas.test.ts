import {
  clusterRequestSchema,
  outlineRequestSchema,
  traceRecordSchema,
} from "@collabcanvas/shared";

describe("shared schemas", () => {
  it("validates cluster request", () => {
    const parsed = clusterRequestSchema.parse({ boardId: "b1", nodeIds: ["n1", "n2"] });
    expect(parsed.boardId).toBe("b1");
  });

  it("rejects cluster requests without nodes", () => {
    expect(() => clusterRequestSchema.parse({ boardId: "b1", nodeIds: [] })).toThrow();
  });

  it("validates outline request with optional style", () => {
    const parsed = outlineRequestSchema.parse({ boardId: "b1", clusterId: "cluster-1", style: "concise" });
    expect(parsed.style).toBe("concise");
  });

  it("disallows unknown trace actors", () => {
    expect(() =>
      traceRecordSchema.parse({
        id: "t1",
        boardId: "b1",
        actor: "SYSTEM",
        action: "CLUSTER",
        latencyMs: null,
        model: null,
        tokensIn: null,
        tokensOut: null,
        createdAt: new Date().toISOString(),
      })
    ).toThrow();
  });
});
