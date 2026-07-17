import { z } from "zod";
import { getOrCreateDecision } from "@/lib/agent/controller";
import { tickets } from "@/lib/demo-data";
import { runCounterfactual } from "@/lib/decision/counterfactual";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { decisionId, field, value } = z
    .object({
      decisionId: z.string(),
      field: z.enum(["inventory", "inactiveDays", "orderValue"]),
      value: z.number().nonnegative(),
    })
    .parse(await request.json());
  const decision = await getOrCreateDecision(decisionId);
  const ticket = tickets.find((item) => item.id === decision.ticketId);
  if (!ticket) return Response.json({ ok: false, code: "TICKET_NOT_FOUND" }, { status: 404 });
  return Response.json({ ok: true, result: runCounterfactual(ticket, decision, field, value) });
}
