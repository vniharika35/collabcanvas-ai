import { createServer } from "http";
import { randomUUID } from "node:crypto";
import { Buffer } from "node:buffer";
import { WebSocket, WebSocketServer } from "ws";
import * as Y from "yjs";
import { SpanStatusCode } from "@opentelemetry/api";

import { config } from "./config.js";
import { DocManager } from "./doc-manager.js";
import { RedisCoordinator } from "./redis.js";
import { log, warn } from "./logger.js";
import type { ClientMessage, PresenceState, RedisEvent, TraceAppendMessage } from "./types.js";
import { tracer, withSpan } from "./tracing.js";

const redis = new RedisCoordinator(config.redisUrl);
const docManager = new DocManager(redis);

redis.onMessage((event: RedisEvent) => {
  if (event.kind === "doc:update") {
    docManager.applyRemoteDocUpdate(event);
  } else if (event.kind === "presence:update") {
    docManager.applyRemotePresence(event);
  } else if (event.kind === "trace:append") {
    void withSpan(
      "realtime.trace.broadcast",
      () => {
        docManager.broadcastJson(event.boardId, {
          type: "trace:append",
          payload: event.trace
        });
      },
      { "board.id": event.boardId, source: "redis" }
    );
  }
});

function parseBoardId(requestUrl?: string | null): string | null {
  if (!requestUrl) return null;
  try {
    const url = new URL(requestUrl, "http://localhost");
    return url.searchParams.get("boardId");
  } catch (error) {
    warn("Failed to parse boardId from url", requestUrl, error);
    return null;
  }
}

function sendJson(socket: WebSocket, message: unknown) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

function handlePresenceMessage(
  boardId: string,
  clientId: string,
  payload: Omit<PresenceState, "clientId">
) {
  const presence: PresenceState = {
    clientId,
    ...payload,
    updatedAt: Date.now()
  };
  docManager.updatePresence(boardId, clientId, presence);
}

async function handleTraceAppend(boardId: string, clientId: string, message: TraceAppendMessage) {
  await withSpan(
    "realtime.trace.append",
    () => {
      docManager.broadcastJson(
        boardId,
        {
          type: "trace:append",
          payload: message.payload
        },
        clientId
      );

      redis.publish({
        kind: "trace:append",
        boardId,
        trace: message.payload
      });
    },
    { "board.id": boardId }
  );
}

export function createRealtimeServer() {
  const httpServer = createServer((_, response) => {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ status: "ok" }));
  });

  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", async (socket, request) => {
    const boardId = parseBoardId(request.url);

    if (!boardId) {
      warn("Rejecting websocket connection without boardId");
      socket.close(1008, "boardId query parameter required");
      return;
    }

    const clientId = randomUUID();
    const connectionSpan = tracer.startSpan("realtime.connection", {
      attributes: { "board.id": boardId, "client.id": clientId }
    });

    try {
      const context = await docManager.ensureInitialized(boardId);
      docManager.attachConnection(boardId, clientId, socket);

      const docState = Y.encodeStateAsUpdate(context.doc);
      socket.send(docState);

      const presence = docManager.getPresence(boardId);
      sendJson(socket, {
        type: "connection:ack",
        clientId,
        boardId,
        presence
      });
      connectionSpan.end();
    } catch (error) {
      warn("Failed to initialize board doc", { boardId, error });
      connectionSpan.recordException(error as Error);
      connectionSpan.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : "Failed to init"
      });
      connectionSpan.end();
      socket.close(1011, "Failed to initialize board");
      return;
    }

    socket.on("message", (data, isBinary) => {
      if (isBinary) {
        const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
        const update = new Uint8Array(buffer);
        docManager.applyLocalDocUpdate(boardId, update, clientId);
        return;
      }

      const payload = typeof data === "string" ? data : data.toString();

      try {
        const message = JSON.parse(payload) as ClientMessage;
        if (message.type === "presence:update") {
          handlePresenceMessage(boardId, clientId, message.payload);
        } else if (message.type === "trace:append") {
          handleTraceAppend(boardId, clientId, message).catch((error) =>
            warn("Failed to broadcast trace", error)
          );
        }
      } catch (error) {
        warn("Failed to process client message", error);
      }
    });

    socket.on("close", () => {
      docManager.detachConnection(boardId, clientId);
      docManager.removePresence(boardId, clientId);
    });

    socket.on("error", (error) => {
      warn("Websocket error", error);
    });
  });

  httpServer.listen(config.port, () => {
    log(`Realtime server listening on :${config.port}`);
  });

  const shutdown = async () => {
    log("Shutting down realtime service");
    wss.close();
    httpServer.close();
    await redis.disconnect();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  return { httpServer, wss };
}
