import type { Prisma } from "@prisma/client";
import { NodeKind } from "@prisma/client";

import { prisma } from "./prisma.js";
import { warn } from "./logger.js";
import { withSpan } from "./tracing.js";

export interface DocNodeState {
  id: string;
  kind: "STICKY" | "GROUP" | "OUTLINE";
  x: number;
  y: number;
  text: string;
  clusterId: string | null;
  ghost: boolean;
}

export async function loadBoardNodes(boardId: string): Promise<DocNodeState[]> {
  return withSpan(
    "realtime.storage.load",
    async (span) => {
      span.setAttributes({ "board.id": boardId });
      const nodes = await prisma.node.findMany({
        where: { boardId },
        orderBy: { createdAt: "asc" },
      });

      return nodes.map((node) => ({
        id: node.id,
        kind: node.kind,
        x: node.x,
        y: node.y,
        text: typeof node.content === "object" && node.content !== null && "text" in node.content
          ? String((node.content as Prisma.JsonObject).text ?? "")
          : "",
        clusterId: node.clusterId,
        ghost: false,
      }));
    },
    { "board.id": boardId }
  );
}

export async function persistBoardNodes(boardId: string, nodes: DocNodeState[]): Promise<void> {
  try {
    await withSpan(
      "realtime.storage.persist",
      async (span) => {
        span.setAttributes({ "board.id": boardId, "nodes.persisted": nodes.length });
        const committed = nodes.filter((node) => !node.ghost);
        const ids = committed.map((node) => node.id);
        const operations: Prisma.PrismaPromise<unknown>[] = [];

        committed.forEach((node) => {
          operations.push(
            prisma.node.upsert({
              where: { id: node.id },
              update: {
                kind: node.kind as NodeKind,
                x: node.x,
                y: node.y,
                content: { text: node.text },
                clusterId: node.clusterId,
              },
              create: {
                id: node.id,
                boardId,
                kind: node.kind as NodeKind,
                x: node.x,
                y: node.y,
                content: { text: node.text },
                clusterId: node.clusterId,
              },
            })
          );
        });

        if (committed.length > 0) {
          operations.push(
            prisma.node.deleteMany({
              where: {
                boardId,
                id: { notIn: ids },
              },
            })
          );
        } else if (nodes.length === 0) {
          operations.push(
            prisma.node.deleteMany({
              where: { boardId },
            })
          );
        }

        if (operations.length > 0) {
          await prisma.$transaction(operations);
        }
      },
      { "board.id": boardId, "nodes.persisted": nodes.length }
    );
  } catch (error) {
    warn("Failed to persist board nodes", { boardId, error });
    throw error;
  }
}
