import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { BoardClient } from "@/components/board/board-client";

// Force dynamic rendering so board data stays fresh while realtime syncs.
export const dynamic = "force-dynamic";

interface BoardPageProps {
  params: Promise<{
    boardId: string;
  }>;
}

/**
 * Server component that hydrates the initial board payload before the client
 * component (Yjs-powered) takes over.
 */
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
