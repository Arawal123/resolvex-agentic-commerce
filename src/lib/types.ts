export type IncidentType =
  | "DELAYED_DELIVERY"
  | "DAMAGED_PRODUCT"
  | "WRONG_PRODUCT"
  | "RETURN_REQUEST"
  | "LOST_SHIPMENT"
  | "OUT_OF_STOCK"
  | "DUPLICATE_CHARGE"
  | "DELIVERY_FAILURE"
  | "UNSUPPORTED_REQUEST";

export type ActionType =
  | "WAIT_AND_MONITOR"
  | "PRIORITY_REPLACEMENT"
  | "STANDARD_REPLACEMENT"
  | "PARTIAL_REFUND"
  | "FULL_REFUND"
  | "COUPON_COMPENSATION"
  | "COURIER_INVESTIGATION"
  | "HUMAN_ESCALATION";

export type AgentPhase =
  "OBSERVE" | "DIAGNOSE" | "PLAN" | "ACT" | "VERIFY" | "RECOVER" | "COMPLETE" | "EXPLAIN";

export type AgentLane = "shared" | "supply" | "customer";

export type SupplyStage =
  | "PAYMENT"
  | "INVENTORY_PROMISE"
  | "WAREHOUSE_PICK"
  | "PACKING"
  | "CARRIER_HANDOFF"
  | "LINE_HAUL"
  | "LAST_MILE"
  | "CUSTOMER_OR_RETURN";

export type SupplyAction =
  | "CARRIER_CORRECTIVE_INVESTIGATION"
  | "WAREHOUSE_QA_AUDIT"
  | "PACKAGING_QUALITY_AUDIT"
  | "PICK_ACCURACY_AUDIT"
  | "INVENTORY_RECONCILIATION"
  | "PAYMENT_IDEMPOTENCY_RECONCILIATION"
  | "RETURNS_PROCESS_REVIEW"
  | "NO_SUPPLY_FAULT"
  | "HUMAN_SUPPLY_ESCALATION";

export interface SupplyMetric {
  id: string;
  key: string;
  label: string;
  stage: SupplyStage;
  observed: number;
  expected: number;
  unit: string;
  deviation: number;
  status: "healthy" | "warning" | "failed" | "unknown";
  source: string;
  evidenceId: string;
}

export interface SupplyTraceStage {
  stage: SupplyStage;
  label: string;
  status: SupplyMetric["status"];
  metricIds: string[];
}

export interface SupplyTrace {
  source: "deterministic_sandbox";
  stages: SupplyTraceStage[];
  metrics: SupplyMetric[];
  causalPath: SupplyStage[];
  generatedAt: string;
}

export interface RootCauseHypothesis {
  id: string;
  stage: SupplyStage;
  label: string;
  probability: number;
  rawScore: number;
  decisiveMetricIds: string[];
  contradictoryMetricIds: string[];
  explanation: string;
}

export interface CausalCounterfactual {
  metricKey: string;
  originalValue: number;
  replacementValue: number;
  statement: string;
}

export interface RootCauseAnalysis {
  attribution: "confirmed" | "probable" | "inconclusive";
  primaryCause: RootCauseHypothesis | null;
  hypotheses: RootCauseHypothesis[];
  confidence: number;
  leadOverSecond: number;
  decisiveFactors: string[];
  contradictoryEvidence: string[];
  missingEvidence: string[];
  counterfactual: CausalCounterfactual | null;
}

export interface SupplyCandidate {
  id: string;
  action: SupplyAction;
  valid: boolean;
  utilityScore: number;
  recurrenceReduction: number;
  operationalImpact: number;
  timeToEffect: number;
  costEfficiency: number;
  confidence: number;
  policyValidity: number;
  rationale: string;
  rejectionReasons: string[];
}

export interface SupplyDecision {
  selectedAction: SupplyAction;
  summary: string;
  candidates: SupplyCandidate[];
  executionStatus: "verified" | "pending" | "escalated" | "no_action" | "failed";
  verificationIds: string[];
}

export interface CustomerOutcome {
  bestSuggestion: string;
  expectedResult: string;
  rationale: string;
  action: ActionType;
  approvalStatus: DecisionRecord["approvalStatus"];
  executionStatus: "verified" | "pending_approval" | "monitoring" | "failed";
  rankedAlternatives: Array<{ action: ActionType; utilityScore: number }>;
}

export interface EvidenceItem {
  id: string;
  claim: string;
  sourceType: "DATABASE" | "TOOL_RESULT" | "POLICY" | "CALCULATION" | "VERIFICATION";
  sourceLabel: string;
  value: string | number | boolean;
}

export interface Ticket {
  id: string;
  orderId: string;
  customerId: string;
  customerName: string;
  subject: string;
  message: string;
  incident: IncidentType;
  urgency: "critical" | "high" | "medium" | "low";
  status: "open" | "running" | "approval" | "resolved";
  slaHours: number;
  orderValue: number;
  inventory: number;
  inactiveDays: number;
  requestedOutcome: "product" | "refund" | "unspecified";
  priority: number;
  churnRisk: number;
  trackingStatus: string;
  source?: "seed" | "manual";
  parseConfidence?: number;
  operationalFacts?: OperationalFacts;
}

export type PaymentStatus = "captured" | "pending" | "refunded" | "failed" | "unknown";
export type ItemCondition = "normal" | "damaged" | "wrong_item" | "unknown";

export interface OperationalFacts {
  paymentStatus: PaymentStatus | null;
  duplicateChargeVerified: boolean | null;
  itemCondition: ItemCondition | null;
  withinReturnWindow: boolean | null;
  deliveryAttempts: number | null;
}

export type MissingCaseField =
  | "incident"
  | "customerName"
  | "orderValue"
  | "inventory"
  | "inactiveDays"
  | "trackingStatus"
  | "paymentStatus"
  | "duplicateChargeVerified"
  | "itemCondition"
  | "withinReturnWindow";

export interface ManualCaseDraft {
  rawMessage: string;
  subject: string;
  orderId: string | null;
  customerId: string | null;
  customerName: string;
  incident: IncidentType | null;
  urgency: Ticket["urgency"];
  requestedOutcome: Ticket["requestedOutcome"];
  slaHours: number | null;
  orderValue: number | null;
  inventory: number | null;
  inactiveDays: number | null;
  trackingStatus: string | null;
  operationalFacts: OperationalFacts;
}

export interface IntakeParseResult {
  draft: ManualCaseDraft;
  confidence: number;
  missingFields: MissingCaseField[];
  provider: "gemini" | "manual";
  model: string;
  warnings: string[];
  manualEntryAllowed: boolean;
}

export type AgentEvent =
  | { type: "phase"; phase: AgentPhase; title: string; detail: string; lane?: AgentLane }
  | { type: "tool"; trace: ToolTrace; lane?: AgentLane }
  | { type: "approval"; ticketId: string; reason: string; lane?: AgentLane }
  | { type: "verification"; result: VerificationResult; lane?: AgentLane }
  | { type: "complete"; decision: DecisionRecord; lane?: AgentLane }
  | { type: "error"; code: string; message: string; lane?: AgentLane };

export interface PolicyCheck {
  id: string;
  policyId: string;
  clause: string;
  description: string;
  passed: boolean;
  evidenceIds: string[];
}

export interface FactorContribution {
  factor: string;
  value: number;
  weight: number;
  contribution: number;
  evidenceIds: string[];
}

export interface CandidateAction {
  id: string;
  action: ActionType;
  valid: boolean;
  utilityScore: number;
  factorContributions: FactorContribution[];
  policyChecks: PolicyCheck[];
  rejectionReasons: string[];
  estimatedCost: number;
  inventoryUnits: number;
  requiresApproval: boolean;
}

export interface ToolTrace {
  id: string;
  name: string;
  phase: AgentPhase;
  status: "success" | "failed" | "retried";
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  latencyMs: number;
  at: string;
  lane?: AgentLane;
}

export interface VerificationResult {
  id: string;
  check: string;
  passed: boolean;
  detail: string;
  toolCallId: string;
  lane?: AgentLane;
}

export interface TimelineEvent {
  id: string;
  phase: AgentPhase;
  title: string;
  detail: string;
  at: string;
  status: "complete" | "active" | "warning";
  lane?: AgentLane;
}

export interface DecisionRecord {
  id: string;
  runId: string;
  ticketId: string;
  customerGoal: string;
  incident: IncidentType;
  finalAction: ActionType;
  summary: string;
  confidence: number;
  approvalStatus: "not_required" | "pending" | "approved" | "rejected";
  evidence: EvidenceItem[];
  candidates: CandidateAction[];
  toolCalls: ToolTrace[];
  verification: VerificationResult[];
  timeline: TimelineEvent[];
  supplyTrace?: SupplyTrace;
  rootCauseAnalysis?: RootCauseAnalysis;
  supplyDecision?: SupplyDecision;
  customerOutcome?: CustomerOutcome;
  versions: {
    controller: string;
    policy: string;
    scoring: string;
    model: string;
  };
  createdAt: string;
}

export interface CounterfactualResult {
  originalValue: number | string;
  modifiedValue: number | string;
  field: string;
  originalDecision: ActionType;
  counterfactualDecision: ActionType;
  originalScore: number;
  counterfactualScore: number;
  changedContributions: Array<{ factor: string; delta: number }>;
  policiesTriggered: string[];
  smallestDecisionChangingCondition: string;
}

export interface SupplyCounterfactualResult {
  scope: "supply";
  field: string;
  originalValue: number;
  modifiedValue: number;
  originalCause: string | null;
  counterfactualCause: string | null;
  originalAction: SupplyAction;
  counterfactualAction: SupplyAction;
  originalProbabilities: Array<{ id: string; probability: number }>;
  counterfactualProbabilities: Array<{ id: string; probability: number }>;
  changed: boolean;
  explanation: string;
}
