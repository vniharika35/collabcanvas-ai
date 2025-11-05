import { Redis as RedisClient } from "ioredis";

import type { RedisEvent } from "./types.js";
import { log, warn } from "./logger.js";

export type RedisMessageHandler = (event: RedisEvent) => void;

export class RedisCoordinator {
  private readonly publisher: RedisClient | null;
  private readonly subscriber: RedisClient | null;
  private readonly handlers = new Set<RedisMessageHandler>();

  constructor(private readonly url?: string) {
    if (!url) {
      this.publisher = null;
      this.subscriber = null;
      warn("REDIS_URL not provided. Running realtime service in single-instance mode.");
      return;
    }

    const retryStrategy = (times: number) => Math.min(times * 100, 2000);

    this.publisher = new RedisClient(url, { retryStrategy });
    this.subscriber = new RedisClient(url, { retryStrategy });

    this.subscriber
      .subscribe("collabcanvas:realtime")
      .then(() => {
        log("Subscribed to Redis channel collabcanvas:realtime");
      })
      .catch((error: Error) => {
        warn("Failed to subscribe to Redis channel", error);
      });

    this.subscriber.on("message", (_channel: string, message: string) => {
      try {
        const parsed = JSON.parse(message) as RedisEvent;
        this.handlers.forEach((handler) => handler(parsed));
      } catch (error) {
        warn("Failed to parse Redis message", error);
      }
    });
  }

  publish(event: RedisEvent) {
    if (!this.publisher) return;
    this.publisher.publish("collabcanvas:realtime", JSON.stringify(event)).catch((error: Error) => {
      warn("Failed to publish Redis event", error);
    });
  }

  onMessage(handler: RedisMessageHandler) {
    this.handlers.add(handler);
  }

  offMessage(handler: RedisMessageHandler) {
    this.handlers.delete(handler);
  }

  async disconnect() {
    await Promise.all([
      this.publisher?.quit().catch((error: Error) => warn("Error quitting Redis publisher", error)),
      this.subscriber?.quit().catch((error: Error) => warn("Error quitting Redis subscriber", error))
    ]);
  }
}
