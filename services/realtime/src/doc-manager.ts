import { Buffer } from "node:buffer";
import { WebSocket } from "ws";
import * as Y from "yjs";

import type { PresenceState, RedisDocUpdateEvent, RedisPresenceEvent } from "./types.js";
import { RedisCoordinator } from "./redis.js";
import { config } from "./config.js";
import { log, warn } from "./logger.js";
import { loadBoardNodes, persistBoardNodes, type DocNodeState } from "./storage.js";

interface ClientConnection {
  id: string;
  socket: WebSocket;
}

interface BoardContext {
  id: string;
  doc: Y.Doc;
  connections: Map<string, ClientConnection>;
  presence: Map<string, PresenceState>;
  cleanupTimer?: NodeJS.Timeout;
  persistTimer?: NodeJS.Timeout;
  initialized: boolean;
  initializing?: Promise<void>;
  suppressPersistence: boolean;
}

/**
 * Manages the lifecycle of per-board Yjs documents, presence maps, and
 * persistence timers across websocket clients + Redis events.
 */
export class DocManager {
  private readonly boards = new Map<string, BoardContext>();

  constructor(private readonly redis: RedisCoordinator) {}

  getOrCreate(boardId: string) {
    let context = this.boards.get(boardId);

    if (!context) {
      context = {
        id: boardId,
        doc: new Y.Doc(),
        connections: new Map(),
        presence: new Map(),
        initialized: false,
        suppressPersistence: false,
      };

      context.doc.getMap("nodes");

      context.doc.on("update", (update: Uint8Array, origin: unknown) => {
        if (origin === "remote") {
          return;
        }
        this.redis.publish({
          kind: "doc:update",
          boardId,
          update: Buffer.from(update).toString("base64"),
          origin: typeof origin === "string" ? origin : "local"
        });
      });

      this.boards.set(boardId, context);
    }

    if (context.cleanupTimer) {
      clearTimeout(context.cleanupTimer);
      context.cleanupTimer = undefined;
    }

    return context;
  }

  attachConnection(boardId: string, clientId: string, socket: WebSocket) {
    const context = this.getOrCreate(boardId);
    context.connections.set(clientId, { id: clientId, socket });
    return context;
  }

  detachConnection(boardId: string, clientId: string) {
    const context = this.boards.get(boardId);
    if (!context) return;

    context.connections.delete(clientId);
    context.presence.delete(clientId);

    if (context.connections.size === 0) {
      context.cleanupTimer = setTimeout(async () => {
        log(`Releasing board ${boardId} due to inactivity`);
        try {
          await this.persistBoard(boardId, context);
        } catch (error) {
          warn("Failed to persist board before cleanup", { boardId, error });
        }
        context.doc.destroy();
        this.boards.delete(boardId);
      }, config.docIdleTtlMs);
    }
  }

  getPresence(boardId: string) {
    const context = this.getOrCreate(boardId);
    return Array.from(context.presence.values());
  }

  updatePresence(boardId: string, clientId: string, presence: PresenceState) {
    const context = this.getOrCreate(boardId);
    context.presence.set(clientId, presence);

    this.broadcastJson(boardId, {
      type: "presence:update",
      payload: presence
    }, clientId);

    this.redis.publish({
      kind: "presence:update",
      boardId,
      clientId,
      payload: presence
    });
  }

  removePresence(boardId: string, clientId: string) {
    const context = this.getOrCreate(boardId);
    context.presence.delete(clientId);

    this.broadcastJson(boardId, {
      type: "presence:remove",
      clientId
    }, clientId);

    this.redis.publish({
      kind: "presence:update",
      boardId,
      clientId,
      payload: null
    });
  }

  applyLocalDocUpdate(boardId: string, update: Uint8Array, originClientId: string) {
    const context = this.getOrCreate(boardId);
    Y.applyUpdate(context.doc, update, originClientId);
    this.broadcastBinary(boardId, update, originClientId);
    this.schedulePersist(boardId, context);
  }

  applyRemoteDocUpdate(event: RedisDocUpdateEvent) {
    const context = this.getOrCreate(event.boardId);
    const update = Buffer.from(event.update, "base64");
    Y.applyUpdate(context.doc, update, "remote");
    this.broadcastBinary(event.boardId, update, null);
  }

  applyRemotePresence(event: RedisPresenceEvent) {
    const context = this.getOrCreate(event.boardId);
    if (event.payload) {
      context.presence.set(event.clientId, event.payload);
      this.broadcastJson(event.boardId, {
        type: "presence:update",
        payload: event.payload
      });
    } else {
      context.presence.delete(event.clientId);
      this.broadcastJson(event.boardId, {
        type: "presence:remove",
        clientId: event.clientId
      });
    }
  }

  broadcastBinary(boardId: string, data: Uint8Array, originClientId: string | null) {
    const context = this.boards.get(boardId);
    if (!context) return;

    for (const [clientId, connection] of context.connections.entries()) {
      if (originClientId && clientId === originClientId) continue;
      if (connection.socket.readyState === WebSocket.OPEN) {
        connection.socket.send(data);
      }
    }
  }

  broadcastJson(boardId: string, message: unknown, originClientId?: string) {
    const context = this.boards.get(boardId);
    if (!context) return;

    const payload = JSON.stringify(message);

    for (const [clientId, connection] of context.connections.entries()) {
      if (originClientId && clientId === originClientId) continue;
      if (connection.socket.readyState === WebSocket.OPEN) {
        connection.socket.send(payload);
      }
    }
  }

  encodeDoc(boardId: string) {
    const context = this.getOrCreate(boardId);
    return Y.encodeStateAsUpdate(context.doc);
  }

  async ensureInitialized(boardId: string) {
    const context = this.getOrCreate(boardId);
    if (context.initialized) {
      return context;
    }

    if (!context.initializing) {
      context.initializing = this.initializeBoardDoc(boardId, context).finally(() => {
        context.initializing = undefined;
      });
    }

    await context.initializing;
    return context;
  }

  private async initializeBoardDoc(boardId: string, context: BoardContext) {
    context.suppressPersistence = true;
    try {
      const nodes = await loadBoardNodes(boardId);
      const nodesMap = context.doc.getMap<Y.Map<unknown>>("nodes");
      nodesMap.clear();
      for (const node of nodes) {
        nodesMap.set(node.id, this.createYNode(node));
      }
      context.initialized = true;
    } catch (error) {
      warn("Failed to load board nodes", { boardId, error });
      throw error;
    } finally {
      context.suppressPersistence = false;
    }
  }

  private createYNode(node: DocNodeState) {
    const map = new Y.Map<any>();
    map.set("id", node.id);
    map.set("kind", node.kind);
    map.set("x", node.x);
    map.set("y", node.y);
    map.set("text", node.text);
    map.set("clusterId", node.clusterId ?? null);
    map.set("ghost", node.ghost ?? false);
    return map;
  }

  private schedulePersist(boardId: string, context: BoardContext) {
    if (context.suppressPersistence) return;

    if (context.persistTimer) {
      clearTimeout(context.persistTimer);
    }

    context.persistTimer = setTimeout(() => {
      context.persistTimer = undefined;
      this.persistBoard(boardId, context).catch((error) =>
        warn("Failed to persist board state", { boardId, error })
      );
    }, 750);
  }

  private async persistBoard(boardId: string, context: BoardContext) {
    if (!context.initialized) return;
    const nodesMap = context.doc.getMap<Y.Map<unknown>>("nodes");
    const nodes: DocNodeState[] = [];

    nodesMap.forEach((value, key) => {
      if (!(value instanceof Y.Map)) return;
      const rawKind = String(value.get("kind") ?? "STICKY") as DocNodeState["kind"];
      nodes.push({
        id: key,
        kind: rawKind,
        x: Number(value.get("x") ?? 0),
        y: Number(value.get("y") ?? 0),
        text: String(value.get("text") ?? ""),
        clusterId: value.get("clusterId") ? String(value.get("clusterId")) : null,
        ghost: Boolean(value.get("ghost")),
      });
    });

    await persistBoardNodes(boardId, nodes);
  }
}
