import { z } from "zod";

export const clusterRequestSchema = z.object({
  boardId: z.string(),
  nodeIds: z.array(z.string()).min(1),
});

export type ClusterRequest = z.infer<typeof clusterRequestSchema>;

export const clusterAssignmentSchema = z.object({
  nodeId: z.string(),
  clusterId: z.string(),
});

export type ClusterAssignment = z.infer<typeof clusterAssignmentSchema>;

export const clusterResponseSchema = z.object({
  assignments: z.array(clusterAssignmentSchema),
  embeddingsMs: z.number().int().nonnegative(),
});

export type ClusterResponse = z.infer<typeof clusterResponseSchema>;

export const outlineRequestSchema = z.object({
  boardId: z.string(),
  clusterId: z.string(),
  style: z.enum(["concise", "detailed"]).optional(),
});

export type OutlineRequest = z.infer<typeof outlineRequestSchema>;

export const outlineNodeSchema = z.object({
  title: z.string(),
  x: z.number(),
  y: z.number(),
});

export type OutlineNode = z.infer<typeof outlineNodeSchema>;

export const outlineResponseSchema = z.object({
  outlineNodes: z.array(outlineNodeSchema),
  latencyMs: z.number().int().nonnegative(),
});

export type OutlineResponse = z.infer<typeof outlineResponseSchema>;

export const traceRecordSchema = z.object({
  id: z.string(),
  boardId: z.string(),
  actor: z.enum(["USER", "AI"]),
  action: z.enum(["CLUSTER", "OUTLINE"]),
  latencyMs: z.number().int().nonnegative().nullable(),
  model: z.string().nullable(),
  tokensIn: z.number().int().nonnegative().nullable(),
  tokensOut: z.number().int().nonnegative().nullable(),
  createdAt: z.string(),
});

export type TraceRecord = z.infer<typeof traceRecordSchema>;
