import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

// Fetch latest board snapshot (nodes + traces) for client hydration.
export async function GET(
  _: Request,
  { params }: { params: Promise<{ boardId: string }> }
) {
  const { boardId } = await params;

  try {
    const board = await prisma.board.findUnique({
      where: { id: boardId },
      include: {
        nodes: {
          orderBy: { createdAt: "asc" },
        },
        traces: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    if (!board) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }

    return NextResponse.json(board);
  } catch (error) {
    console.error("Failed to fetch board", error);
    return NextResponse.json({ error: "Failed to fetch board" }, { status: 500 });
  }
}
