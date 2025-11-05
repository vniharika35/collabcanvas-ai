import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

const createNodeSchema = z.object({
  kind: z.enum(["STICKY", "GROUP", "OUTLINE"]).default("STICKY"),
  x: z.number().default(0),
  y: z.number().default(0),
  content: z
    .object({
      text: z.string().default("New sticky note"),
      color: z.string().optional(),
    })
    .catch(() => ({ text: "New sticky note" })),
});

export async function GET(
  _request: Request,
  { params }: { params: { boardId: string } }
) {
  const { boardId } = params;

  try {
    const nodes = await prisma.node.findMany({
      where: { boardId },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(nodes);
  } catch (error) {
    console.error("Failed to load board nodes", error);
    return NextResponse.json({ error: "Failed to load board nodes" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { boardId: string } }) {
  const { boardId } = params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createNodeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  try {
    const node = await prisma.node.create({
      data: {
        boardId,
        kind: parsed.data.kind,
        x: parsed.data.x,
        y: parsed.data.y,
        content: parsed.data.content,
      },
    });

    return NextResponse.json(node, { status: 201 });
  } catch (error) {
    console.error("Failed to create node", error);
    return NextResponse.json({ error: "Failed to create node" }, { status: 500 });
  }
}
