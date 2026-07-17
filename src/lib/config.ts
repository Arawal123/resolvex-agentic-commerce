export const SCORING_VERSION = "resolve-score@1.4.0";
export const POLICY_VERSION = "commerce-policy@2026.07";
export const CONTROLLER_VERSION = "resolvex-controller@2.1.0";

export const scoringWeights = {
  customerGoalSatisfaction: 0.28,
  policyCompliance: 0.22,
  slaRecovery: 0.14,
  resolutionSpeed: 0.12,
  inventoryAvailability: 0.1,
  churnRiskReduction: 0.08,
  evidenceConfidence: 0.08,
  operationalCost: -0.12,
  operationalComplexity: -0.06,
  approvalRequirement: -0.04,
} as const;

export const autonomyConfig = {
  level: "bounded",
  maxAutonomousRefundInr: 5000,
  maxBatchBudgetInr: 20000,
  minAutonomousConfidence: 0.72,
  maxRetries: 2,
};
