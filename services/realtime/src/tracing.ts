import { context, trace, SpanStatusCode, type Attributes, type Span } from "@opentelemetry/api";

export const tracer = trace.getTracer("collabcanvas-realtime");

export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T> | T,
  attributes?: Attributes
): Promise<T> {
  const span = tracer.startSpan(name, { attributes });

  try {
    const result = await context.with(trace.setSpan(context.active(), span), () => Promise.resolve(fn(span)));
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.recordException(error as Error);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : String(error)
    });
    throw error;
  } finally {
    span.end();
  }
}
