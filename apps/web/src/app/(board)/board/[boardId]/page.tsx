import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { BoardClient } from "@/components/board/board-client";

interface BoardPageProps {
  params: {
    boardId: string;
  };
}

export default async function BoardPage({ params }: BoardPageProps) {
  const { boardId } = params;

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
