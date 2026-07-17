import type { ActionType, Ticket } from "@/lib/types";

export interface PolicyEvaluation {
  permitted: boolean;
  requiresApproval: boolean;
  clauses: string[];
  reasons: string[];
}

export function evaluatePolicy(ticket: Ticket, action: ActionType): PolicyEvaluation {
  const reasons: string[] = [];
  const clauses: string[] = [];
  if (action.includes("REPLACEMENT")) {
    clauses.push("P-02 §4.2");
    if (ticket.inventory < 1) reasons.push("No replacement inventory is available.");
    if (ticket.incident === "DELAYED_DELIVERY" && ticket.inactiveDays < 5)
      reasons.push("Shipment inactivity is below five days.");
  }
  if (action.includes("REFUND")) clauses.push("P-05 §2.1");
  const requiresApproval = action.includes("REFUND") && ticket.orderValue > 5000;
  return { permitted: reasons.length === 0, requiresApproval, clauses, reasons };
}
