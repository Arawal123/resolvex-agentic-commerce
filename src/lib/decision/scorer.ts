import { scoringWeights } from "@/lib/config";
import type { ActionType, CandidateAction, EvidenceItem, Ticket } from "@/lib/types";

const replacementActions: ActionType[] = ["PRIORITY_REPLACEMENT", "STANDARD_REPLACEMENT"];

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

function goalFit(action: ActionType, ticket: Ticket) {
  if (ticket.requestedOutcome === "product")
    return replacementActions.includes(action) ? 1 : action === "WAIT_AND_MONITOR" ? 0.42 : 0.18;
  if (ticket.requestedOutcome === "refund") return action.includes("REFUND") ? 1 : 0.2;
  return action === "HUMAN_ESCALATION" ? 0.55 : 0.72;
}

function costFor(action: ActionType, ticket: Ticket) {
  if (action === "FULL_REFUND") return ticket.orderValue;
  if (action === "PARTIAL_REFUND") return Math.round(ticket.orderValue * 0.25);
  if (action === "PRIORITY_REPLACEMENT") return Math.round(ticket.orderValue * 0.36 + 420);
  if (action === "STANDARD_REPLACEMENT") return Math.round(ticket.orderValue * 0.31 + 120);
  if (action === "COUPON_COMPENSATION") return 300;
  return 0;
}

export function generateCandidates(ticket: Ticket, evidence: EvidenceItem[]): CandidateAction[] {
  const actions: ActionType[] = [
    "PRIORITY_REPLACEMENT",
    "STANDARD_REPLACEMENT",
    "FULL_REFUND",
    "PARTIAL_REFUND",
    "WAIT_AND_MONITOR",
    "COURIER_INVESTIGATION",
    "HUMAN_ESCALATION",
  ];
  return actions.map((action, index) =>
    scoreCandidate(ticket, action, evidence, `A-${String(index + 1).padStart(2, "0")}`)
  );
}

export function scoreCandidate(
  ticket: Ticket,
  action: ActionType,
  evidence: EvidenceItem[],
  id = "A-CF"
): CandidateAction {
  const isReplacement = replacementActions.includes(action);
  const inventoryValid = !isReplacement || ticket.inventory > 0;
  const inactivityValid =
    ticket.incident !== "DELAYED_DELIVERY" ||
    ticket.inactiveDays >= 5 ||
    action === "WAIT_AND_MONITOR" ||
    action === "HUMAN_ESCALATION";
  const duplicateValid =
    ticket.incident !== "DUPLICATE_CHARGE" ||
    action === "FULL_REFUND" ||
    action === "HUMAN_ESCALATION";
  const valid = inventoryValid && inactivityValid && duplicateValid;
  const estimatedCost = costFor(action, ticket);
  const requiresApproval =
    (action.includes("REFUND") && estimatedCost > 5000) || ticket.orderValue > 50000;
  const values = {
    customerGoalSatisfaction: goalFit(action, ticket),
    policyCompliance: valid ? 1 : 0,
    slaRecovery:
      action === "PRIORITY_REPLACEMENT" || action === "FULL_REFUND"
        ? 1
        : action === "STANDARD_REPLACEMENT"
          ? 0.78
          : 0.35,
    resolutionSpeed:
      action === "FULL_REFUND"
        ? 0.92
        : action === "PRIORITY_REPLACEMENT"
          ? 0.9
          : action === "HUMAN_ESCALATION"
            ? 0.25
            : 0.62,
    inventoryAvailability: isReplacement ? Math.min(ticket.inventory / 5, 1) : 0.7,
    churnRiskReduction: action === "WAIT_AND_MONITOR" ? 0.18 : ticket.churnRisk,
    evidenceConfidence: ticket.trackingStatus ? 0.96 : 0.48,
    operationalCost: Math.min(estimatedCost / Math.max(ticket.orderValue, 1), 1),
    operationalComplexity:
      action === "HUMAN_ESCALATION" ? 1 : action === "PRIORITY_REPLACEMENT" ? 0.55 : 0.28,
    approvalRequirement: requiresApproval ? 1 : 0,
  };
  const factorContributions = Object.entries(scoringWeights).map(([factor, weight]) => ({
    factor,
    value: values[factor as keyof typeof values],
    weight,
    contribution: round(values[factor as keyof typeof values] * weight),
    evidenceIds:
      factor === "inventoryAvailability"
        ? ["E-04"]
        : factor === "policyCompliance"
          ? ["E-05"]
          : ["E-01", "E-02"],
  }));
  const utilityScore = valid
    ? round(
        Math.max(
          0,
          Math.min(
            1,
            factorContributions.reduce((sum, item) => sum + item.contribution, 0)
          )
        )
      )
    : 0;
  const rejectionReasons = [
    !inventoryValid ? "Replacement inventory is zero." : "",
    !inactivityValid ? "Tracking inactivity has not reached the policy threshold." : "",
    !duplicateValid ? "Duplicate-payment policy restricts the remedy to refund or escalation." : "",
  ].filter(Boolean);
  return {
    id,
    action,
    valid,
    utilityScore,
    factorContributions,
    policyChecks: [
      {
        id: `${id}-PC1`,
        policyId: "P-02",
        clause: "§4.2",
        description: "Five inactive days and available replacement inventory",
        passed: inventoryValid && inactivityValid,
        evidenceIds: ["E-03", "E-04"],
      },
      {
        id: `${id}-PC2`,
        policyId: "P-05",
        clause: "§2.1",
        description: "Autonomous monetary threshold",
        passed: !requiresApproval,
        evidenceIds: ["E-06"],
      },
    ],
    rejectionReasons,
    estimatedCost,
    inventoryUnits: isReplacement ? 1 : 0,
    requiresApproval,
  };
}

export function selectCandidate(candidates: CandidateAction[]) {
  return [...candidates]
    .filter((candidate) => candidate.valid)
    .sort((a, b) => b.utilityScore - a.utilityScore)[0];
}
