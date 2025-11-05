import { createServer } from "http";
import { randomUUID } from "node:crypto";
import { Buffer } from "node:buffer";
import { WebSocket, WebSocketServer } from "ws";
import * as Y from "yjs";

import { config } from "./config.js";
import { DocManager } from "./doc-manager.js";
import { RedisCoordinator } from "./redis.js";
import { log, warn } from "./logger.js";
import type { ClientMessage, PresenceState, RedisEvent } from "./types.js";

const redis = new RedisCoordinator(config.redisUrl);
const docManager = new DocManager(redis);

redis.onMessage((event: RedisEvent) => {
  if (event.kind === "doc:update") {
    docManager.applyRemoteDocUpdate(event);
  } else {
    docManager.applyRemotePresence(event);
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
    } catch (error) {
      warn("Failed to initialize board doc", { boardId, error });
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
