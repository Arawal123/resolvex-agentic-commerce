import { z } from "zod";
import { runAgent } from "@/lib/agent/controller";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const ticketId = z.string().parse(url.searchParams.get("ticketId"));
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const decision = await runAgent(ticketId);
        for (const event of decision.timeline)
          controller.enqueue(encoder.encode(`event: trace\ndata: ${JSON.stringify(event)}\n\n`));
        controller.enqueue(
          encoder.encode(
            `event: complete\ndata: ${JSON.stringify({ decisionId: decision.id })}\n\n`
          )
        );
      } catch (error) {
        controller.enqueue(
          encoder.encode(
            `event: error\ndata: ${JSON.stringify({ message: error instanceof Error ? error.message : "Failed" })}\n\n`
          )
        );
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
