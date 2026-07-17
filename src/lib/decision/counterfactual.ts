import { generateCandidates, selectCandidate } from "@/lib/decision/scorer";
import type { CounterfactualResult, DecisionRecord, Ticket } from "@/lib/types";

export function runCounterfactual(
  ticket: Ticket,
  decision: DecisionRecord,
  field: "inventory" | "inactiveDays" | "orderValue",
  value: number
): CounterfactualResult {
  const modified = { ...ticket, [field]: value };
  const rerun = selectCandidate(generateCandidates(modified, decision.evidence));
  const original = decision.candidates.find(
    (candidate) => candidate.action === decision.finalAction
  )!;
  const originalMap = new Map(
    original.factorContributions.map((factor) => [factor.factor, factor.contribution])
  );
  const changedContributions = rerun.factorContributions
    .map((factor) => ({
      factor: factor.factor,
      delta:
        Math.round((factor.contribution - (originalMap.get(factor.factor) ?? 0)) * 1000) / 1000,
    }))
    .filter((factor) => factor.delta !== 0);
  return {
    originalValue: ticket[field],
    modifiedValue: value,
    field,
    originalDecision: decision.finalAction,
    counterfactualDecision: rerun.action,
    originalScore: original.utilityScore,
    counterfactualScore: rerun.utilityScore,
    changedContributions,
    policiesTriggered:
      field === "inventory" && value === 0 ? ["P-02 §4.2 inventory precondition failed"] : [],
    smallestDecisionChangingCondition:
      field === "inventory" ? "Inventory ≤ 0" : `${field} changed to ${value}`,
  };
}
