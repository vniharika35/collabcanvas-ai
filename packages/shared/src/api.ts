import { clusterRequestSchema, clusterResponseSchema, outlineRequestSchema, outlineResponseSchema } from "./schemas";

export interface AiBrokerClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

const DEFAULT_BASE_URL = "http://localhost:8000";

const getFetch = (fetchImpl?: typeof fetch) => {
  if (fetchImpl) return fetchImpl;
  if (typeof fetch === "undefined") {
    throw new Error("Global fetch is not available. Provide fetchImpl in options.");
  }
  return fetch;
};

/** Thin wrapper around fetch that enforces the shared Zod contracts. */
export class AiBrokerClient {
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;

  constructor(options: AiBrokerClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.fetchFn = getFetch(options.fetchImpl);
  }

  async cluster(input: unknown) {
    const parsed = clusterRequestSchema.parse(input);
    const response = await this.fetchFn(`${this.baseUrl}/cluster`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed),
    });

    if (!response.ok) {
      throw new Error(`Cluster request failed with status ${response.status}`);
    }

    const json = await response.json();
    return clusterResponseSchema.parse(json);
  }

  async outline(input: unknown) {
    const parsed = outlineRequestSchema.parse(input);
    const response = await this.fetchFn(`${this.baseUrl}/outline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed),
    });

    if (!response.ok) {
      throw new Error(`Outline request failed with status ${response.status}`);
    }

    const json = await response.json();
    return outlineResponseSchema.parse(json);
  }
}

