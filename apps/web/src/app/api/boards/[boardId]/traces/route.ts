import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
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

  let parsedBody;
  try {
    const json = await request.json();
    parsedBody = bodySchema.parse(json);
  } catch (error) {
    console.error("Invalid trace payload", error);
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

    return NextResponse.json(trace, { status: 201 });
  } catch (error) {
    console.error("Failed to create trace", error);
    return NextResponse.json({ error: "Failed to record trace" }, { status: 500 });
  }
}
