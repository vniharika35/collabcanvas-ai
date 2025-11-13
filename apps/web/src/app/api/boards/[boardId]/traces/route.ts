import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { withSpan } from "@/lib/tracing";

export const traceInputSchema = z.object({
  action: z.enum(["CLUSTER", "OUTLINE"]),
  prompt: z.unknown(),
  response: z.unknown(),
  latencyMs: z.number().int().nonnegative().nullable().default(null),
  model: z.string().nullable().default(null),
  tokensIn: z.number().int().nonnegative().nullable().default(null),
  tokensOut: z.number().int().nonnegative().nullable().default(null),
});

export async function POST(request: Request, { params }: { params: { boardId: string } }) {
  const { boardId } = params;

  return withSpan(
    "api.traces.create",
    async (span) => {
      span.setAttributes({ "board.id": boardId, "trace.origin": "web" });

      let parsedBody;
      try {
        const json = await request.json();
        parsedBody = traceInputSchema.parse(json);
      } catch (error) {
        span.recordException(error as Error);
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }

      try {
        const trace = await prisma.trace.create({
          data: {
            boardId,
            actor: "AI",
            action: parsedBody.action,
            prompt: parsedBody.prompt,
            response: parsedBody.response,
            latencyMs: parsedBody.latencyMs,
            model: parsedBody.model,
            tokensIn: parsedBody.tokensIn,
            tokensOut: parsedBody.tokensOut,
          },
        });

        span.setAttributes({ "trace.id": trace.id, "trace.action": trace.action });
        return NextResponse.json(trace, { status: 201 });
      } catch (error) {
        console.error("Failed to create trace", error);
        span.recordException(error as Error);
        return NextResponse.json({ error: "Failed to record trace" }, { status: 500 });
      }
    },
    { "board.id": boardId }
  );
}
