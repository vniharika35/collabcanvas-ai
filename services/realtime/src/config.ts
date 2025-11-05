import { z } from "zod";

const configSchema = z.object({
  PORT: z
    .string()
    .transform((value) => Number(value))
    .refine((value) => Number.isInteger(value) && value > 0, "PORT must be a positive integer")
    .default("3011"),
  REDIS_URL: z.string().url().optional(),
  HEARTBEAT_INTERVAL_MS: z
    .string()
    .transform((value) => Number(value))
    .refine((value) => Number.isInteger(value) && value > 0, "Heartbeat must be positive")
    .default("15000"),
  DOC_IDLE_TTL_MS: z
    .string()
    .transform((value) => Number(value))
    .refine((value) => Number.isInteger(value) && value > 0, "TTL must be positive")
    .default("300000")
});

const parsed = configSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid realtime service configuration", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = {
  port: parsed.data.PORT,
  redisUrl: parsed.data.REDIS_URL,
  heartbeatIntervalMs: parsed.data.HEARTBEAT_INTERVAL_MS,
  docIdleTtlMs: parsed.data.DOC_IDLE_TTL_MS
};
