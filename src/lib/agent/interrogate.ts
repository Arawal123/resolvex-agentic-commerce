import type { DecisionRecord } from "@/lib/types";

export function answerDecisionQuestion(record: DecisionRecord, question: string) {
  const normalized = question.toLowerCase();
  const chosen = record.candidates.find((candidate) => candidate.action === record.finalAction)!;
  const second = [...record.candidates]
    .filter((candidate) => candidate.valid && candidate.action !== record.finalAction)
    .sort((a, b) => b.utilityScore - a.utilityScore)[0];
  if (normalized.includes("policy") || normalized.includes("author"))
    return `Policy P-02 §4.2 authorized the selected action because the shipment inactivity and inventory preconditions were both satisfied [E-03, E-04, E-05]. The monetary guardrail in P-05 §2.1 was also checked [${chosen.policyChecks[1].id}].`;
  if (
    normalized.includes("inventory") ||
    normalized.includes("zero") ||
    normalized.includes("change")
  )
    return `Inventory availability contributed ${chosen.factorContributions.find((item) => item.factor === "inventoryAvailability")?.contribution.toFixed(3)} to ${chosen.id}. If inventory becomes zero, the replacement candidate fails P-02 §4.2 and the deterministic engine recomputes the next valid action [E-04].`;
  if (normalized.includes("execut") || normalized.includes("tool"))
    return `The controller executed ${record.toolCalls.length} recorded tool calls. Consequential calls and their receipts are ${record.toolCalls
      .filter((item) => item.phase === "ACT")
      .map((item) => `${item.id} ${item.name}`)
      .join(
        ", "
      )}. Independent verification is recorded in ${record.verification.map((item) => item.id).join(", ")}.`;
  if (normalized.includes("refund") || normalized.includes("instead"))
    return `${record.finalAction} scored ${chosen.utilityScore.toFixed(3)} because it best matched the customer's product goal [E-01] while satisfying P-02 §4.2 [E-05]. ${second?.action ?? "The next alternative"} scored ${second?.utilityScore.toFixed(3) ?? "lower"}; refund also conflicts with the stated product goal.`;
  if (
    normalized.includes("greatest") ||
    normalized.includes("influence") ||
    normalized.includes("score")
  ) {
    const top = [...chosen.factorContributions]
      .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
      .slice(0, 3);
    return `The strongest recorded contributions were ${top.map((item) => `${item.factor} ${item.contribution >= 0 ? "+" : ""}${item.contribution.toFixed(3)} [${item.evidenceIds.join(", ")}]`).join("; ")}. Their sum, with all remaining factors, reproduces ${chosen.utilityScore.toFixed(3)} for ${chosen.id}.`;
  }
  return `The stored record shows ${record.finalAction} at ${(record.confidence * 100).toFixed(0)}% confidence. It is grounded in ${record.evidence.length} evidence items, ${record.candidates.length} evaluated candidates, ${record.toolCalls.length} tool calls, and ${record.verification.length} verification checks. Ask about policy, alternatives, score, tools, or a counterfactual to inspect a specific part.`;
}
