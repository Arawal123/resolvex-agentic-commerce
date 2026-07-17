import { z } from "zod";
import { getOrCreateDecision } from "@/lib/agent/controller";
import { runCounterfactual } from "@/lib/decision/counterfactual";
import { runSupplyCounterfactual } from "@/lib/supply/diagnostics";
import { getTicket } from "@/lib/tickets/repository";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { decisionId, scope, field, value } = z
    .object({
      decisionId: z.string(),
      scope: z.enum(["customer", "supply"]).default("customer"),
      field: z.string().min(1),
      value: z.number().nonnegative(),
    })
    .parse(await request.json());
  const decision = await getOrCreateDecision(decisionId);
  const ticket = await getTicket(decision.ticketId);
  if (!ticket) return Response.json({ ok: false, code: "TICKET_NOT_FOUND" }, { status: 404 });
  if (scope === "supply") {
    if (!decision.supplyTrace)
      return Response.json({ ok: false, code: "LEGACY_DECISION" }, { status: 409 });
    try {
      return Response.json({
        ok: true,
        result: runSupplyCounterfactual(ticket, decision.supplyTrace, field, value),
      });
    } catch (error) {
      return Response.json(
        {
          ok: false,
          code: "INVALID_SUPPLY_METRIC",
          message: error instanceof Error ? error.message : "Invalid metric",
        },
        { status: 400 }
      );
    }
  }
  const customerField = z.enum(["inventory", "inactiveDays", "orderValue"]).parse(field);
  return Response.json({
    ok: true,
    result: runCounterfactual(ticket, decision, customerField, value),
  });
}
