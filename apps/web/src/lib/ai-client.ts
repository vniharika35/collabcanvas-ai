import { AiBrokerClient } from "@collabcanvas/shared";

const baseUrl =
  typeof process !== "undefined" ? process.env.NEXT_PUBLIC_AI_BROKER_URL ?? "http://localhost:8000" : "";

export const aiClient = new AiBrokerClient({ baseUrl });
