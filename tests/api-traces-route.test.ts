import { NextResponse } from "next/server";
import { describe, expect, it, beforeEach, vi } from "vitest";

import { POST, traceInputSchema } from "@/app/api/boards/[boardId]/traces/route";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    trace: {
      create: vi.fn(),
    },
  },
}));

type PrismaMock = {
  trace: {
    create: ReturnType<typeof vi.fn>;
  };
};

const prismaMock = prisma as unknown as PrismaMock;

describe("POST /api/boards/[boardId]/traces", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists a trace and returns 201", async () => {
    prismaMock.trace.create.mockResolvedValueOnce({
      id: "trace-123",
      boardId: "board-1",
      actor: "AI",
      action: "CLUSTER",
      prompt: {},
      response: {},
      latencyMs: 1200,
      model: "test",
      tokensIn: null,
      tokensOut: null,
      createdAt: new Date().toISOString(),
    });

    const payload = traceInputSchema.parse({ action: "CLUSTER", prompt: {}, response: {} });
    const req = new Request("http://localhost/api/boards/board-1/traces", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const res = (await POST(req, { params: { boardId: "board-1" } })) as NextResponse;
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.id).toBe("trace-123");
    expect(prismaMock.trace.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ boardId: "board-1", action: "CLUSTER" }),
    });
  });

  it("returns 400 for invalid payloads", async () => {
    const req = new Request("http://localhost/api/boards/board-1/traces", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const res = (await POST(req, { params: { boardId: "board-1" } })) as NextResponse;
    expect(res.status).toBe(400);
    expect(prismaMock.trace.create).not.toHaveBeenCalled();
  });

  it("returns 500 when persistence fails", async () => {
    prismaMock.trace.create.mockRejectedValueOnce(new Error("db down"));

    const req = new Request("http://localhost/api/boards/board-1/traces", {
      method: "POST",
      body: JSON.stringify({ action: "OUTLINE", prompt: {}, response: {} }),
    });

    const res = (await POST(req, { params: { boardId: "board-1" } })) as NextResponse;
    expect(res.status).toBe(500);
  });
});
