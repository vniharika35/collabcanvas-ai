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

export type ServerMessage = PresenceMessage | HeartbeatMessage | AckMessage | PresenceRemoveMessage;

export type ClientMessage = PresenceMessage | HeartbeatMessage;

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

export type RedisEvent = RedisDocUpdateEvent | RedisPresenceEvent;
