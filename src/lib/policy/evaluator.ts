import { getPlaybook } from "@/lib/agent/playbooks";
import type { ActionType, Ticket } from "@/lib/types";

export interface PolicyEvaluation {
  permitted: boolean;
  requiresApproval: boolean;
  clauses: string[];
  reasons: string[];
}

export function evaluatePolicy(ticket: Ticket, action: ActionType): PolicyEvaluation {
  const reasons: string[] = [];
  const clauses: string[] = [getPlaybook(ticket.incident).primaryPolicy];
  const facts = ticket.operationalFacts;
  const paymentStatus = facts?.paymentStatus ?? "captured";
  const duplicateChargeVerified =
    facts?.duplicateChargeVerified ?? ticket.incident === "DUPLICATE_CHARGE";
  const itemCondition =
    facts?.itemCondition ??
    (ticket.incident === "DAMAGED_PRODUCT"
      ? "damaged"
      : ticket.incident === "WRONG_PRODUCT"
        ? "wrong_item"
        : undefined);

  if (!getPlaybook(ticket.incident).candidates.includes(action)) {
    reasons.push("The action is not eligible for this incident playbook.");
  }

  if (action.includes("REPLACEMENT")) {
    if (ticket.inventory < 1) reasons.push("Replacement inventory is zero.");
    if (ticket.incident === "DELAYED_DELIVERY" && ticket.inactiveDays < 5) {
      reasons.push("Shipment inactivity is below five days.");
    }
    if (ticket.incident === "DAMAGED_PRODUCT" && itemCondition !== "damaged") {
      reasons.push("Damage has not been confirmed in the case facts.");
    }
    if (ticket.incident === "WRONG_PRODUCT" && itemCondition !== "wrong_item") {
      reasons.push("Wrong-item delivery has not been confirmed in the case facts.");
    }
  }

  if (action.includes("REFUND")) {
    clauses.push("P-05 §2.1");
    if (paymentStatus !== "captured") {
      reasons.push("Payment is not confirmed as captured.");
    }
    if (ticket.incident === "RETURN_REQUEST" && facts?.withinReturnWindow !== true) {
      reasons.push("The return is outside or missing the eligible return window.");
    }
    if (ticket.incident === "DUPLICATE_CHARGE" && duplicateChargeVerified !== true) {
      reasons.push("The duplicate charge is not verified in the payment facts.");
    }
  }

  if (ticket.incident === "UNSUPPORTED_REQUEST" && action !== "HUMAN_ESCALATION") {
    reasons.push("Unsupported requests must be escalated.");
  }

  const requiresApproval =
    (action.includes("REFUND") && ticket.orderValue > 5000) ||
    action === "HUMAN_ESCALATION" ||
    ticket.priority < 0.5;

  return { permitted: reasons.length === 0, requiresApproval, clauses, reasons };
}
