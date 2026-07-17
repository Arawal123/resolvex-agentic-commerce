import { z } from "zod";
import { runAgent } from "@/lib/agent/controller";
import { getDecision } from "@/lib/decisions/repository";
import type { AgentEvent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const inputSchema = z.object({ ticketId: z.string().trim().min(1).max(120) });

function serialize(event: AgentEvent) {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

export async function POST(request: Request) {
  let ticketId: string;
  try {
    ticketId = inputSchema.parse(await request.json()).ticketId;
  } catch (error) {
    return Response.json(
      {
        ok: false,
        code: "INVALID_AGENT_RUN",
        message: error instanceof Error ? error.message : "Invalid request",
      },
      { status: 400 }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: AgentEvent) => controller.enqueue(encoder.encode(serialize(event)));
      try {
        const existing = await getDecision(`DEC-${ticketId.slice(4)}`);
        if (existing) {
          send({ type: "complete", decision: existing });
          return;
        }
        await runAgent(ticketId, send);
      } catch (error) {
        send({
          type: "error",
          code: "AGENT_RUN_FAILED",
          message: error instanceof Error ? error.message : "The agent run failed.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
