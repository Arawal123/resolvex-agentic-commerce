import { beforeAll, describe, expect, it } from "vitest";
import { getOrCreateDecision } from "@/lib/agent/controller";
import { runCounterfactual } from "@/lib/decision/counterfactual";
import { tickets } from "@/lib/demo-data";
import { optimizeBatch } from "@/lib/optimization/batch-optimizer";
import type { DecisionRecord } from "@/lib/types";

let decision: DecisionRecord;
beforeAll(async () => {
  decision = await getOrCreateDecision("DEC-1042");
});

describe("counterfactual and optimizer", () => {
  it("recomputes a decision when inventory becomes zero", () => {
    const result = runCounterfactual(tickets[0], decision, "inventory", 0);
    expect(result.counterfactualDecision).not.toBe("PRIORITY_REPLACEMENT");
    expect(result.policiesTriggered[0]).toContain("P-02");
  });

  it("respects shared budget and inventory constraints", () => {
    const plan = optimizeBatch({ tickets, budget: 8000, inventory: 2 });
    expect(plan.compensationUsed).toBeLessThanOrEqual(8000);
    expect(plan.inventoryConsumed).toBeLessThanOrEqual(2);
    expect(new Set(plan.allocations.map((item) => item.ticketId)).size).toBe(
      plan.allocations.length
    );
  });

  it("never allocates more than one action per ticket", () => {
    const plan = optimizeBatch({ tickets, budget: 20000, inventory: 12 });
    const ids = plan.allocations.map((item) => item.ticketId);
    expect(ids).toEqual([...new Set(ids)]);
  });
});
