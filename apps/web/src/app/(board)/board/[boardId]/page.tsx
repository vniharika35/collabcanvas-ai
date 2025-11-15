import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { BoardClient } from "@/components/board/board-client";

export const dynamic = "force-dynamic";

interface BoardPageProps {
  params: Promise<{
    boardId: string;
  }>;
}

export default async function BoardPage({ params }: BoardPageProps) {
  const { boardId } = await params;

  if (!boardId) {
    notFound();
  }

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
    notFound();
  }

  return <BoardClient board={board} />;
}
