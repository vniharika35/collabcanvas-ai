import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { withSpan } from "@/lib/tracing";
import { BoardClient } from "@/components/board/board-client";

interface BoardPageProps {
  params: {
    boardId: string;
  };
}

export default async function BoardPage({ params }: BoardPageProps) {
  const { boardId } = params;

  const board = await withSpan(
    "app.board.fetch",
    (span) => {
      span.setAttributes({ "board.id": boardId });
      return prisma.board.findUnique({
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
    },
    { "span.kind": "server" }
  );

  if (!board) {
    notFound();
  }

  return <BoardClient board={board} />;
}
