import { describe, expect, it } from "vitest";
import { tickets } from "@/lib/demo-data";
import { generateCandidates, scoreCandidate, selectCandidate } from "@/lib/decision/scorer";
import { evaluatePolicy } from "@/lib/policy/evaluator";

const delayed = tickets[0];

describe("deterministic decision engine", () => {
  it("selects a priority replacement for a delayed product-goal case", () => {
    const selected = selectCandidate(generateCandidates(delayed, []));
    expect(selected.action).toBe("PRIORITY_REPLACEMENT");
    expect(selected.valid).toBe(true);
  });

  it("rejects replacement when inventory is zero", () => {
    const candidate = scoreCandidate({ ...delayed, inventory: 0 }, "PRIORITY_REPLACEMENT", []);
    expect(candidate.valid).toBe(false);
    expect(candidate.rejectionReasons).toContain("Replacement inventory is zero.");
  });

  it("makes score contributions exactly reproducible", () => {
    const candidate = scoreCandidate(delayed, "PRIORITY_REPLACEMENT", []);
    const sum = candidate.factorContributions.reduce(
      (total, factor) => total + factor.contribution,
      0
    );
    expect(candidate.utilityScore).toBeCloseTo(sum, 3);
  });

  it("requires approval for a refund above the configured threshold", () => {
    const candidate = scoreCandidate(delayed, "FULL_REFUND", []);
    expect(candidate.requiresApproval).toBe(true);
    expect(evaluatePolicy(delayed, "FULL_REFUND").requiresApproval).toBe(true);
  });

  it("enforces the five-day inactivity policy", () => {
    const result = evaluatePolicy({ ...delayed, inactiveDays: 2 }, "PRIORITY_REPLACEMENT");
    expect(result.permitted).toBe(false);
    expect(result.reasons[0]).toContain("five days");
  });
});
