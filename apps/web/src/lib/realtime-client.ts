"use client";

import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Trace } from "@prisma/client";
import * as Y from "yjs";

interface PresenceCursor {
  x: number;
  y: number;
}

export interface PresenceState {
  clientId: string;
  userId: string;
  name: string;
  color: string;
  cursor?: PresenceCursor;
  selection: string[];
  updatedAt: number;
}

interface AckMessage {
  type: "connection:ack";
  clientId: string;
  boardId: string;
  presence: PresenceState[];
}

interface PresenceUpdateBroadcastMessage {
  type: "presence:update";
  payload: PresenceState;
}

interface PresenceRemoveMessage {
  type: "presence:remove";
  clientId: string;
}

export type SerializedTrace = Omit<Trace, "createdAt"> & { createdAt: string };

interface PresenceUpdateRequestMessage {
  type: "presence:update";
  payload: Omit<PresenceState, "clientId">;
}

interface TraceAppendMessage {
  type: "trace:append";
  payload: SerializedTrace;
}

type ServerMessage =
  | AckMessage
  | PresenceUpdateBroadcastMessage
  | PresenceRemoveMessage
  | TraceAppendMessage;

type ClientMessage =
  | PresenceUpdateRequestMessage
  | {
      type: "presence:heartbeat";
    }
  | TraceAppendMessage;

export interface RealtimePeer extends PresenceState {
  clientId: string;
}

export interface UseRealtimePresenceOptions {
  boardId: string;
  self: Omit<PresenceState, "clientId" | "updatedAt">;
  onTrace?: (trace: SerializedTrace) => void;
}

export interface UseRealtimePresenceResult {
  clientId: string | null;
  doc: Y.Doc | null;
  peers: RealtimePeer[];
  updatePresence: (patch: Partial<Omit<PresenceState, "clientId" | "userId" | "name" | "color" | "updatedAt">>) => void;
  broadcastTrace: (trace: SerializedTrace) => void;
}

const DEFAULT_REALTIME_URL = process.env.NEXT_PUBLIC_REALTIME_URL ?? "ws://localhost:3011/ws";

function isBinaryMessage(data: unknown): data is ArrayBuffer {
  return data instanceof ArrayBuffer;
}

export function useRealtimePresence({ boardId, self, onTrace }: UseRealtimePresenceOptions): UseRealtimePresenceResult {
  const [clientId, setClientId] = useState<string | null>(null);
  const [peers, setPeers] = useState<Map<string, RealtimePeer>>(() => new Map());
  const [docState, setDocState] = useState<Y.Doc | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const docRef = useRef<Y.Doc | null>(null);
  const selfPresenceRef = useRef<PresenceState>({
    clientId: "",
    ...self,
    selection: self.selection ?? [],
    updatedAt: 0,
  });

  const traceHandlerRef = useRef<UseRealtimePresenceOptions["onTrace"]>(onTrace);

  useEffect(() => {
    traceHandlerRef.current = onTrace;
  }, [onTrace]);

  useEffect(() => {
    const doc = new Y.Doc();
    docRef.current = doc;
    startTransition(() => setDocState(doc));

    const url = new URL(DEFAULT_REALTIME_URL);
    url.searchParams.set("boardId", boardId);

    const socket = new WebSocket(url);
    socket.binaryType = "arraybuffer";
    socketRef.current = socket;

    socket.onmessage = (event) => {
      if (isBinaryMessage(event.data)) {
        const update = new Uint8Array(event.data);
        Y.applyUpdate(doc, update);
        return;
      }

      const payload = typeof event.data === "string" ? event.data : event.data.toString();

      try {
        const message = JSON.parse(payload) as ServerMessage;
        if (message.type === "connection:ack") {
          setClientId(message.clientId);
          selfPresenceRef.current = { ...selfPresenceRef.current, clientId: message.clientId };
          setPeers(new Map(message.presence.map((entry) => [entry.clientId, entry])));
        } else if (message.type === "presence:update") {
          setPeers((prev) => {
            const next = new Map(prev);
            next.set(message.payload.clientId, message.payload);
            return next;
          });
        } else if (message.type === "presence:remove") {
          setPeers((prev) => {
            const next = new Map(prev);
            next.delete(message.clientId);
            return next;
          });
        } else if (message.type === "trace:append") {
          traceHandlerRef.current?.(message.payload);
        }
      } catch (error) {
        console.error("Failed to parse realtime message", error);
      }
    };

    socket.onclose = () => {
      socketRef.current = null;
      doc.destroy();
      docRef.current = null;
      startTransition(() => setDocState(null));
    };

    socket.onerror = (error) => {
      console.error("Realtime socket error", error);
    };

    return () => {
      socket.close();
      doc.destroy();
      docRef.current = null;
      startTransition(() => setDocState(null));
    };
  }, [boardId]);

  const updatePresence = useMemo(() => {
    return (patch: Partial<Omit<PresenceState, "userId" | "name" | "color" | "updatedAt">>) => {
      const socket = socketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) return;

      const nextState: PresenceState = {
        ...self,
        ...selfPresenceRef.current,
        ...patch,
        selection: patch.selection ?? selfPresenceRef.current.selection ?? [],
        updatedAt: Date.now()
      };

      selfPresenceRef.current = nextState;

      const { clientId: _clientId, ...payload } = nextState;
      void _clientId;
      socket.send(
        JSON.stringify({
          type: "presence:update",
          payload
        } satisfies ClientMessage)
      );
    };
  }, [self]);

  useEffect(() => {
    selfPresenceRef.current = { ...selfPresenceRef.current, ...self };
  }, [self]);

  const broadcastTrace = useCallback((trace: SerializedTrace) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;

    socket.send(
      JSON.stringify({
        type: "trace:append",
        payload: trace
      } satisfies ClientMessage)
    );
  }, []);

  return {
    clientId,
    doc: docState,
    peers: Array.from(peers.values()),
    updatePresence,
    broadcastTrace
  };
}
