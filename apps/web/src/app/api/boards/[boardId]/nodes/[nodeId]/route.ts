import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

const updateNodeSchema = z.object({
  x: z.number().optional(),
  y: z.number().optional(),
  content: z
    .object({
      text: z.string().optional(),
      color: z.string().optional(),
    })
    .optional(),
  clusterId: z.string().nullable().optional(),
});

export async function PATCH(request: Request, { params }: { params: { boardId: string; nodeId: string } }) {
  const { nodeId, boardId } = params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateNodeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  try {
    const existing = await prisma.node.findFirst({ where: { id: nodeId, boardId } });

    if (!existing) {
      return NextResponse.json({ error: "Node not found" }, { status: 404 });
    }

    const content = parsed.data.content
      ? { ...((existing.content as Record<string, unknown>) ?? {}), ...parsed.data.content }
      : undefined;

    const node = await prisma.node.update({
      where: { id: nodeId },
      data: {
        x: parsed.data.x ?? existing.x,
        y: parsed.data.y ?? existing.y,
        content: content ?? existing.content,
        clusterId:
          parsed.data.clusterId === undefined ? existing.clusterId : parsed.data.clusterId,
      },
    });

    return NextResponse.json(node);
  } catch (error) {
    console.error("Failed to update node", error);
    return NextResponse.json({ error: "Failed to update node" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { boardId: string; nodeId: string } }
) {
  const { boardId, nodeId } = params;

  try {
    const existing = await prisma.node.findFirst({ where: { id: nodeId, boardId } });

    if (!existing) {
      return NextResponse.json({ error: "Node not found" }, { status: 404 });
    }

    await prisma.node.delete({
      where: { id: nodeId },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete node", error);
    return NextResponse.json({ error: "Failed to delete node" }, { status: 500 });
  }
}
