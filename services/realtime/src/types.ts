export interface PresenceCursor {
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

export interface PresenceMessage {
  type: "presence:update";
  payload: Omit<PresenceState, "clientId">;
}

export interface HeartbeatMessage {
  type: "presence:heartbeat";
}

export interface AckMessage {
  type: "connection:ack";
  clientId: string;
  boardId: string;
  presence: PresenceState[];
}

export interface PresenceRemoveMessage {
  type: "presence:remove";
  clientId: string;
}

export interface TraceAppendPayload {
  id: string;
  boardId: string;
  actor: string;
  action: string;
  latencyMs: number | null;
  model: string | null;
  tokensIn: number | null;
  tokensOut: number | null;
  createdAt: string;
  prompt?: unknown;
  response?: unknown;
}

export interface TraceAppendMessage {
  type: "trace:append";
  payload: TraceAppendPayload;
}

export type ServerMessage =
  | PresenceMessage
  | HeartbeatMessage
  | AckMessage
  | PresenceRemoveMessage
  | TraceAppendMessage;

export type ClientMessage = PresenceMessage | HeartbeatMessage | TraceAppendMessage;

export interface RedisDocUpdateEvent {
  kind: "doc:update";
  boardId: string;
  update: string; // base64-encoded binary
  origin: string;
}

export interface RedisPresenceEvent {
  kind: "presence:update";
  boardId: string;
  clientId: string;
  payload: PresenceState | null;
}

export interface RedisTraceAppendEvent {
  kind: "trace:append";
  boardId: string;
  trace: TraceAppendPayload;
}

export type RedisEvent = RedisDocUpdateEvent | RedisPresenceEvent | RedisTraceAppendEvent;
