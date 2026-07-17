import { generateCandidates } from "@/lib/decision/scorer";
import type { ActionType, Ticket } from "@/lib/types";

export interface BatchAllocation {
  ticketId: string;
  action: ActionType;
  cost: number;
  inventoryUnits: number;
  utility: number;
  rationale: string;
}

export interface BatchPlan {
  allocations: BatchAllocation[];
  objectiveScore: number;
  compensationUsed: number;
  inventoryConsumed: number;
  casesResolved: number;
  slaBreachesAvoided: number;
  escalated: number;
  budgetLimit: number;
  inventoryLimit: number;
}

export function optimizeBatch(input: {
  tickets: Ticket[];
  budget: number;
  inventory: number;
}): BatchPlan {
  const options = input.tickets.flatMap((ticket) =>
    generateCandidates(ticket, [])
      .filter((candidate) => candidate.valid)
      .map((candidate) => ({
        ticket,
        candidate,
        ratio: candidate.utilityScore / Math.max(candidate.estimatedCost, 200),
      }))
  );
  const grouped = new Map<string, typeof options>();
  for (const option of options)
    grouped.set(option.ticket.id, [...(grouped.get(option.ticket.id) ?? []), option]);
  const groups = [...grouped.values()];
  let best: BatchPlan["allocations"] = [];
  let bestScore = -1;

  function search(
    index: number,
    budgetLeft: number,
    inventoryLeft: number,
    chosen: BatchPlan["allocations"],
    score: number
  ) {
    if (index === groups.length) {
      if (score > bestScore) {
        bestScore = score;
        best = [...chosen];
      }
      return;
    }
    search(index + 1, budgetLeft, inventoryLeft, chosen, score);
    for (const { ticket, candidate } of groups[index]) {
      if (candidate.estimatedCost <= budgetLeft && candidate.inventoryUnits <= inventoryLeft) {
        const urgencyBonus = (24 - Math.min(ticket.slaHours, 24)) / 48 + ticket.priority * 0.2;
        chosen.push({
          ticketId: ticket.id,
          action: candidate.action,
          cost: candidate.estimatedCost,
          inventoryUnits: candidate.inventoryUnits,
          utility: candidate.utilityScore,
          rationale: `Highest feasible utility with SLA priority ${ticket.priority.toFixed(2)}.`,
        });
        search(
          index + 1,
          budgetLeft - candidate.estimatedCost,
          inventoryLeft - candidate.inventoryUnits,
          chosen,
          score + candidate.utilityScore + urgencyBonus
        );
        chosen.pop();
      }
    }
  }
  search(0, input.budget, input.inventory, [], 0);
  return {
    allocations: best,
    objectiveScore: Math.round(bestScore * 100) / 100,
    compensationUsed: best.reduce((sum, item) => sum + item.cost, 0),
    inventoryConsumed: best.reduce((sum, item) => sum + item.inventoryUnits, 0),
    casesResolved: best.filter((item) => item.action !== "HUMAN_ESCALATION").length,
    slaBreachesAvoided: best.filter(
      (item) => item.action === "PRIORITY_REPLACEMENT" || item.action === "FULL_REFUND"
    ).length,
    escalated: best.filter((item) => item.action === "HUMAN_ESCALATION").length,
    budgetLimit: input.budget,
    inventoryLimit: input.inventory,
  };
}
