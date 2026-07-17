export type IncidentType =
  | "DELAYED_DELIVERY"
  | "DAMAGED_PRODUCT"
  | "WRONG_PRODUCT"
  | "RETURN_REQUEST"
  | "LOST_SHIPMENT"
  | "OUT_OF_STOCK"
  | "DUPLICATE_CHARGE"
  | "DELIVERY_FAILURE";

export type ActionType =
  | "WAIT_AND_MONITOR"
  | "PRIORITY_REPLACEMENT"
  | "STANDARD_REPLACEMENT"
  | "PARTIAL_REFUND"
  | "FULL_REFUND"
  | "COUPON_COMPENSATION"
  | "COURIER_INVESTIGATION"
  | "HUMAN_ESCALATION";

export type AgentPhase = "OBSERVE" | "PLAN" | "ACT" | "VERIFY" | "RECOVER" | "COMPLETE" | "EXPLAIN";

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
}

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
}

export interface VerificationResult {
  id: string;
  check: string;
  passed: boolean;
  detail: string;
  toolCallId: string;
}

export interface TimelineEvent {
  id: string;
  phase: AgentPhase;
  title: string;
  detail: string;
  at: string;
  status: "complete" | "active" | "warning";
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
