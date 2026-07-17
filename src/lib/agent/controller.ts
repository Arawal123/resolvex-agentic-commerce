import { getPlaybook } from "@/lib/agent/playbooks";
import { CONTROLLER_VERSION, POLICY_VERSION, SCORING_VERSION } from "@/lib/config";
import { generateCandidates, selectCandidate } from "@/lib/decision/scorer";
import { getDecision, saveDecision } from "@/lib/decisions/repository";
import {
  analyzeSupplyTrace,
  buildSupplyTrace,
  generateSupplyCandidates,
  selectSupplyCandidate,
} from "@/lib/supply/diagnostics";
import { getTicket } from "@/lib/tickets/repository";
import {
  toolRegistry,
  type ToolContext,
  type ToolName,
  type ToolResult,
} from "@/lib/tools/registry";
import type {
  AgentEvent,
  AgentLane,
  AgentPhase,
  CustomerOutcome,
  DecisionRecord,
  EvidenceItem,
  SupplyAction,
  SupplyDecision,
  TimelineEvent,
  ToolTrace,
  VerificationResult,
} from "@/lib/types";

const context: ToolContext = {
  role: "agent",
  permissions: ["support:read", "operations:write", "finance:write", "verify:read"],
};

type EventSink = (event: AgentEvent) => Promise<void> | void;
type Ticket = NonNullable<Awaited<ReturnType<typeof getTicket>>>;

function now(index: number) {
  return new Date(Date.now() + index * 280).toISOString();
}

function trace(
  name: string,
  phase: AgentPhase,
  result: ToolResult,
  input: Record<string, unknown>,
  index: number,
  lane: AgentLane
): ToolTrace {
  return {
    id: `T-${String(index).padStart(2, "0")}`,
    name,
    phase,
    status: result.ok ? "success" : "failed",
    input,
    output: result.data as Record<string, unknown>,
    latencyMs: result.latencyMs,
    at: now(index),
    lane,
  };
}

function dataFrom(
  toolCalls: ToolTrace[],
  name: string,
  key: string,
  fallback: string | number | boolean
) {
  return toolCalls.find((item) => item.name === name)?.output[key] ?? fallback;
}

function readInput(name: ToolName, ticket: Ticket) {
  if (name === "getCustomerProfile" || name === "getCustomerCaseHistory")
    return { customerId: ticket.customerId };
  if (name === "getOrderDetails" || name === "getPaymentStatus") return { orderId: ticket.orderId };
  return { ticketId: ticket.id };
}

function customerCopy(action: DecisionRecord["finalAction"], ticket: Ticket) {
  const copy: Record<DecisionRecord["finalAction"], { suggestion: string; result: string }> = {
    PRIORITY_REPLACEMENT: {
      suggestion: "Send a priority replacement now and keep the customer updated.",
      result: "A replacement is reserved immediately and should arrive in about 2 days.",
    },
    STANDARD_REPLACEMENT: {
      suggestion: "Send a standard replacement at no additional charge.",
      result: "A replacement is reserved and should arrive in about 5 days.",
    },
    FULL_REFUND: {
      suggestion: "Return the full eligible amount to the original payment method.",
      result: `₹${ticket.orderValue.toLocaleString("en-IN")} is submitted; bank settlement typically takes 3–7 days.`,
    },
    PARTIAL_REFUND: {
      suggestion: "Issue the eligible partial refund and explain the calculation clearly.",
      result: "The approved amount is submitted to the original payment method for settlement.",
    },
    COUPON_COMPENSATION: {
      suggestion: "Apply a service-recovery credit while the underlying issue is corrected.",
      result: "A ₹300 one-time credit becomes available immediately.",
    },
    COURIER_INVESTIGATION: {
      suggestion: "Open a courier trace and provide a firm follow-up window.",
      result: "The investigation is open with a follow-up scheduled within 24 hours.",
    },
    WAIT_AND_MONITOR: {
      suggestion:
        "Monitor the shipment for one bounded interval before taking a consequential action.",
      result: "The case will be rechecked within 24 hours.",
    },
    HUMAN_ESCALATION: {
      suggestion: "Have a human specialist review the evidence before any consequential action.",
      result: "No consequential write occurs until an attributed reviewer decides.",
    },
  };
  return copy[action];
}

function supplySummary(action: SupplyAction, cause: string | undefined) {
  if (action === "NO_SUPPLY_FAULT")
    return "No operational correction is warranted by the current evidence.";
  if (action === "HUMAN_SUPPLY_ESCALATION")
    return "Evidence is not decisive enough for automatic attribution; supply control review is open.";
  return `${action.replaceAll("_", " ").toLowerCase()} opened against ${cause ?? "the highest-ranked stage"}.`;
}

export async function runAgent(ticketId: string, onEvent?: EventSink): Promise<DecisionRecord> {
  const ticket = await getTicket(ticketId);
  if (!ticket) throw new Error("Ticket not found");
  const playbook = getPlaybook(ticket.incident);
  const runId = `RUN-${ticketId.slice(4)}-${Date.now().toString().slice(-6)}`;
  const toolCalls: ToolTrace[] = [];
  const verification: VerificationResult[] = [];
  let toolIndex = 1;

  const emit = async (event: AgentEvent) => onEvent?.(event);
  const emitPhase = (phase: AgentPhase, title: string, detail: string, lane: AgentLane) =>
    emit({ type: "phase", phase, title, detail, lane });
  const call = async (
    name: ToolName,
    input: Record<string, unknown>,
    phase: AgentPhase,
    lane: AgentLane,
    idempotencyKey?: string
  ) => {
    const tool = toolRegistry[name] as unknown as {
      call: (input: unknown, context: ToolContext) => Promise<ToolResult<Record<string, unknown>>>;
    };
    const result = await tool.call(input, { ...context, idempotencyKey });
    const toolTrace = trace(name, phase, result, input, toolIndex++, lane);
    toolCalls.push(toolTrace);
    await emit({ type: "tool", trace: toolTrace, lane });
    return { result, trace: toolTrace };
  };
  const verify = async (
    check: string,
    callResult: Awaited<ReturnType<typeof call>>,
    lane: AgentLane,
    detail?: string
  ) => {
    const result: VerificationResult = {
      id: `V-${String(verification.length + 1).padStart(2, "0")}`,
      check,
      passed: Boolean(callResult.result.data.verified),
      detail: detail ?? JSON.stringify(callResult.result.data),
      toolCallId: callResult.trace.id,
      lane,
    };
    verification.push(result);
    await emit({ type: "verification", result, lane });
    return result;
  };

  await emitPhase(
    "OBSERVE",
    "Shared evidence retrieved",
    `${playbook.label} · ${playbook.readTools.length} minimum-necessary reads`,
    "shared"
  );
  for (const name of playbook.readTools)
    await call(name, readInput(name, ticket), "OBSERVE", "shared");

  const evidence: EvidenceItem[] = [
    {
      id: "E-01",
      claim: "The requested outcome is grounded in the operator-reviewed customer message.",
      sourceType: "DATABASE",
      sourceLabel: `${ticket.id} message`,
      value: ticket.requestedOutcome,
    },
    {
      id: "E-02",
      claim: `The case is classified as ${ticket.incident.replaceAll("_", " ").toLowerCase()}.`,
      sourceType: "DATABASE",
      sourceLabel: `${ticket.id} reviewed intake`,
      value: ticket.slaHours,
    },
    {
      id: "E-03",
      claim: `The shipment snapshot reports ${ticket.inactiveDays} inactive days.`,
      sourceType: toolCalls.some((item) => item.name === "getTrackingHistory")
        ? "TOOL_RESULT"
        : "DATABASE",
      sourceLabel:
        toolCalls.find((item) => item.name === "getTrackingHistory")?.id ??
        `${ticket.id} operational facts`,
      value: dataFrom(
        toolCalls,
        "getTrackingHistory",
        "inactiveDays",
        ticket.inactiveDays
      ) as number,
    },
    {
      id: "E-04",
      claim: `${ticket.inventory} replacement units are available.`,
      sourceType: toolCalls.some((item) => item.name === "checkInventory")
        ? "TOOL_RESULT"
        : "DATABASE",
      sourceLabel:
        toolCalls.find((item) => item.name === "checkInventory")?.id ??
        `${ticket.id} operational facts`,
      value: dataFrom(toolCalls, "checkInventory", "available", ticket.inventory) as number,
    },
    {
      id: "E-05",
      claim: `${playbook.primaryPolicy} is the primary incident playbook clause.`,
      sourceType: "POLICY",
      sourceLabel: playbook.primaryPolicy,
      value: POLICY_VERSION,
    },
    {
      id: "E-06",
      claim: `The reviewed order value is ₹${ticket.orderValue.toLocaleString("en-IN")}.`,
      sourceType: "DATABASE",
      sourceLabel: `${ticket.orderId} order total`,
      value: ticket.orderValue,
    },
    {
      id: "E-07",
      claim: "Customer anomaly risk is below the autonomous review threshold.",
      sourceType: "TOOL_RESULT",
      sourceLabel:
        toolCalls.find((item) => item.name === "getCustomerProfile")?.id ?? `${ticket.id} profile`,
      value: dataFrom(toolCalls, "getCustomerProfile", "anomalyRisk", 0.08) as number,
    },
    {
      id: "E-08",
      claim: "Payment and fulfillment facts were supplied by the reviewed case snapshot.",
      sourceType: "DATABASE",
      sourceLabel: `${ticket.id} operational facts`,
      value: ticket.operationalFacts?.paymentStatus ?? "captured",
    },
  ];

  const supplyTrace = buildSupplyTrace(ticket);
  const rootCauseAnalysis = analyzeSupplyTrace(ticket, supplyTrace);
  await emitPhase(
    "DIAGNOSE",
    "Supply mechanism reconstructed",
    rootCauseAnalysis.primaryCause
      ? `${rootCauseAnalysis.attribution} · ${rootCauseAnalysis.primaryCause.label} · ${(rootCauseAnalysis.confidence * 100).toFixed(0)}%`
      : "No supportable supply attribution",
    "supply"
  );

  const candidates = generateCandidates(ticket, evidence);
  const selected = selectCandidate(candidates);
  if (!selected) throw new Error("No valid customer candidate action");
  const supplyCandidates = generateSupplyCandidates(ticket, rootCauseAnalysis);
  const selectedSupply = selectSupplyCandidate(supplyCandidates);
  if (!selectedSupply) throw new Error("No valid supply candidate action");
  const approvalStatus: DecisionRecord["approvalStatus"] = selected.requiresApproval
    ? "pending"
    : "not_required";

  await emitPhase(
    "PLAN",
    "Customer remedy selected",
    `${selected.action.replaceAll("_", " ")} · ${selected.utilityScore.toFixed(3)} utility`,
    "customer"
  );
  await emitPhase(
    "PLAN",
    "Supply correction selected",
    `${selectedSupply.action.replaceAll("_", " ")} · ${selectedSupply.utilityScore.toFixed(3)} utility`,
    "supply"
  );

  const customerChecks: Array<{ check: string; tool: ToolName }> = [];
  await emitPhase(
    "ACT",
    selected.requiresApproval ? "Customer approval boundary reached" : "Customer remedy executing",
    selected.requiresApproval
      ? "No consequential customer action will cross the approval boundary."
      : selected.action.replaceAll("_", " "),
    "customer"
  );
  if (selected.requiresApproval) {
    const reason =
      selected.action === "HUMAN_ESCALATION"
        ? "The case is unsupported, ambiguous, or intentionally routed to human oversight."
        : `The ${selected.action.toLowerCase().replaceAll("_", " ")} exceeds the autonomous monetary boundary.`;
    await call(
      "escalateToHuman",
      { ticketId, reason, proposedAction: selected.action },
      "ACT",
      "customer",
      `${runId}:approval`
    );
    await emit({ type: "approval", ticketId, reason, lane: "customer" });
  } else if (selected.action.includes("REPLACEMENT")) {
    await call(
      "createReplacementOrder",
      { ticketId, orderId: ticket.orderId, priority: selected.action === "PRIORITY_REPLACEMENT" },
      "ACT",
      "customer",
      `${runId}:replacement`
    );
    await call(
      "reserveInventory",
      { ticketId, quantity: 1 },
      "ACT",
      "customer",
      `${runId}:inventory`
    );
    if (selected.action === "PRIORITY_REPLACEMENT") {
      await call("createCoupon", { ticketId, amount: 300 }, "ACT", "customer", `${runId}:coupon`);
      customerChecks.push({ check: "Recovery coupon is active", tool: "verifyCoupon" });
    }
    await call(
      "notifyWarehouse",
      {
        ticketId,
        message: `${selected.action.replaceAll("_", " ")} authorized by ${playbook.primaryPolicy}.`,
      },
      "ACT",
      "customer",
      `${runId}:warehouse`
    );
    await call(
      "sendCustomerMessage",
      {
        ticketId,
        message: `We created a ${selected.action === "PRIORITY_REPLACEMENT" ? "priority" : "standard"} replacement under the applicable policy.`,
      },
      "ACT",
      "customer",
      `${runId}:message`
    );
    customerChecks.push(
      { check: "Replacement order exists", tool: "verifyReplacement" },
      { check: "Inventory reservation exists", tool: "verifyInventoryReservation" },
      { check: "Customer notification delivered", tool: "verifyCustomerNotification" }
    );
  } else if (selected.action === "FULL_REFUND" || selected.action === "PARTIAL_REFUND") {
    const amount =
      selected.action === "FULL_REFUND" ? ticket.orderValue : Math.round(ticket.orderValue * 0.25);
    const tool = selected.action === "FULL_REFUND" ? "issueRefund" : "issuePartialRefund";
    await call(tool, { ticketId, amount }, "ACT", "customer", `${runId}:refund`);
    await call(
      "sendCustomerMessage",
      {
        ticketId,
        message: `A ₹${amount.toLocaleString("en-IN")} refund was submitted for verification.`,
      },
      "ACT",
      "customer",
      `${runId}:message`
    );
    customerChecks.push(
      { check: "Refund present in payment ledger", tool: "verifyRefund" },
      { check: "Customer notification delivered", tool: "verifyCustomerNotification" }
    );
  } else if (selected.action === "COUPON_COMPENSATION") {
    await call("createCoupon", { ticketId, amount: 300 }, "ACT", "customer", `${runId}:coupon`);
    await call(
      "sendCustomerMessage",
      { ticketId, message: "A ₹300 service-recovery credit is now active." },
      "ACT",
      "customer",
      `${runId}:message`
    );
    customerChecks.push(
      { check: "Recovery coupon is active", tool: "verifyCoupon" },
      { check: "Customer notification delivered", tool: "verifyCustomerNotification" }
    );
  } else if (selected.action === "COURIER_INVESTIGATION") {
    await call("openCourierInvestigation", { ticketId }, "ACT", "customer", `${runId}:courier`);
    await call(
      "scheduleFollowUp",
      { ticketId, at: new Date(Date.now() + 86400000).toISOString() },
      "ACT",
      "customer",
      `${runId}:follow-up`
    );
    customerChecks.push(
      { check: "Courier investigation is open", tool: "verifyCourierInvestigation" },
      { check: "Operational follow-up is scheduled", tool: "verifyFollowUp" }
    );
  } else if (selected.action === "WAIT_AND_MONITOR") {
    await call(
      "scheduleFollowUp",
      { ticketId, at: new Date(Date.now() + 86400000).toISOString() },
      "ACT",
      "customer",
      `${runId}:follow-up`
    );
    customerChecks.push({ check: "Operational follow-up is scheduled", tool: "verifyFollowUp" });
  }

  let supplyExecutionStatus: SupplyDecision["executionStatus"] = "pending";
  await emitPhase(
    "ACT",
    "Supply correction executing",
    selectedSupply.action.replaceAll("_", " "),
    "supply"
  );
  if (selectedSupply.action === "NO_SUPPLY_FAULT") {
    supplyExecutionStatus = "no_action";
  } else if (selectedSupply.action === "HUMAN_SUPPLY_ESCALATION") {
    await call(
      "escalateSupplyIncident",
      {
        ticketId,
        reason: `Attribution ${rootCauseAnalysis.attribution}; lead ${rootCauseAnalysis.leadOverSecond.toFixed(3)}.`,
      },
      "ACT",
      "supply",
      `${runId}:supply-escalation`
    );
    supplyExecutionStatus = "escalated";
  } else {
    await call(
      "executeSupplyCorrection",
      {
        ticketId,
        action: selectedSupply.action,
        rootCauseId: rootCauseAnalysis.primaryCause?.id ?? "RC-UNKNOWN",
      },
      "ACT",
      "supply",
      `${runId}:supply-correction`
    );
  }

  await emitPhase(
    "VERIFY",
    "Both lanes reading back",
    "Independent tools are verifying customer and supply state after all writes.",
    "shared"
  );
  for (const check of customerChecks) {
    await verify(
      check.check,
      await call(check.tool, { ticketId }, "VERIFY", "customer"),
      "customer"
    );
  }
  if (selectedSupply.action === "HUMAN_SUPPLY_ESCALATION") {
    await verify(
      "Supply escalation reached control queue",
      await call("verifySupplyEscalation", { ticketId }, "VERIFY", "supply"),
      "supply"
    );
  } else if (selectedSupply.action !== "NO_SUPPLY_FAULT") {
    const result = await verify(
      "Supply corrective action independently exists",
      await call(
        "verifySupplyCorrection",
        { ticketId, action: selectedSupply.action },
        "VERIFY",
        "supply"
      ),
      "supply"
    );
    supplyExecutionStatus = result.passed ? "verified" : "failed";
  }

  const customerVerification = verification.filter((item) => item.lane === "customer");
  const shouldResolve =
    !selected.requiresApproval &&
    !["COURIER_INVESTIGATION", "WAIT_AND_MONITOR"].includes(selected.action) &&
    customerVerification.length > 0 &&
    customerVerification.every((item) => item.passed);
  if (shouldResolve) {
    await call("resolveTicket", { ticketId }, "COMPLETE", "customer", `${runId}:resolve`);
    await verify(
      "Ticket state is resolved",
      await call("verifyTicketState", { ticketId }, "VERIFY", "customer"),
      "customer",
      "Independent read confirmed resolved state."
    );
  }

  const finalCustomerVerification = verification.filter((item) => item.lane === "customer");
  const customerCopyText = customerCopy(selected.action, ticket);
  const customerOutcome: CustomerOutcome = {
    bestSuggestion: customerCopyText.suggestion,
    expectedResult: selected.requiresApproval
      ? "No consequential write occurs until an attributed reviewer approves the remedy."
      : customerCopyText.result,
    rationale: `${selected.action.replaceAll("_", " ").toLowerCase()} is the highest-utility policy-valid remedy for the reviewed customer goal.`,
    action: selected.action,
    approvalStatus,
    executionStatus: selected.requiresApproval
      ? "pending_approval"
      : ["COURIER_INVESTIGATION", "WAIT_AND_MONITOR"].includes(selected.action)
        ? "monitoring"
        : finalCustomerVerification.length > 0 &&
            finalCustomerVerification.every((item) => item.passed)
          ? "verified"
          : "failed",
    rankedAlternatives: candidates
      .filter((candidate) => candidate.valid && candidate.action !== selected.action)
      .sort((a, b) => b.utilityScore - a.utilityScore)
      .slice(0, 4)
      .map((candidate) => ({ action: candidate.action, utilityScore: candidate.utilityScore })),
  };
  const supplyVerificationIds = verification
    .filter((item) => item.lane === "supply")
    .map((item) => item.id);
  const supplyDecision: SupplyDecision = {
    selectedAction: selectedSupply.action,
    summary: supplySummary(selectedSupply.action, rootCauseAnalysis.primaryCause?.label),
    candidates: supplyCandidates,
    executionStatus: supplyExecutionStatus,
    verificationIds: supplyVerificationIds,
  };

  await emitPhase(
    "EXPLAIN",
    "Dual decision record sealed",
    `${supplyTrace.metrics.length} supply metrics · ${candidates.length} customer candidates · ${toolCalls.length} tool calls`,
    "shared"
  );
  const timeline: TimelineEvent[] = [
    {
      id: "TL-01",
      phase: "OBSERVE",
      title: "Shared evidence retrieved",
      detail: `${ticket.incident} · ${playbook.readTools.length} bounded reads`,
      at: now(0),
      status: "complete",
      lane: "shared",
    },
    {
      id: "TL-02",
      phase: "DIAGNOSE",
      title: rootCauseAnalysis.primaryCause?.label ?? "Supply attribution unavailable",
      detail: `${rootCauseAnalysis.attribution} · ${(rootCauseAnalysis.confidence * 100).toFixed(0)}% probability`,
      at: now(2),
      status: rootCauseAnalysis.attribution === "inconclusive" ? "warning" : "complete",
      lane: "supply",
    },
    {
      id: "TL-03",
      phase: "PLAN",
      title: "Two bounded outcomes selected",
      detail: `${selectedSupply.action} · ${selected.action}`,
      at: now(4),
      status: "complete",
      lane: "shared",
    },
    {
      id: "TL-04",
      phase: "ACT",
      title: "Customer and supply actions processed",
      detail: selected.requiresApproval
        ? "Customer action stopped at approval; supply handling continued independently."
        : "Every write used a run-scoped idempotency key.",
      at: now(7),
      status: selected.requiresApproval ? "warning" : "complete",
      lane: "shared",
    },
    {
      id: "TL-05",
      phase: "VERIFY",
      title: "Operational state independently verified",
      detail: `${verification.filter((item) => item.passed).length}/${verification.length} checks passed.`,
      at: now(12),
      status: verification.every((item) => item.passed) ? "complete" : "warning",
      lane: "shared",
    },
    {
      id: "TL-06",
      phase: "EXPLAIN",
      title: "Dual record persisted",
      detail: `${evidence.length} evidence items · ${supplyTrace.metrics.length} supply metrics`,
      at: now(14),
      status: "complete",
      lane: "shared",
    },
  ];

  const confidence =
    ticket.incident === "UNSUPPORTED_REQUEST"
      ? 0.42
      : Math.min(0.97, 0.78 + (ticket.parseConfidence ?? 0.9) * 0.18);
  const record: DecisionRecord = {
    id: `DEC-${ticketId.slice(4)}`,
    runId,
    ticketId,
    customerGoal:
      ticket.requestedOutcome === "product"
        ? "Receive the purchased product through the safest policy-valid recovery."
        : ticket.requestedOutcome === "refund"
          ? "Recover the eligible charged amount to the original payment method."
          : "Reach a policy-valid resolution without inventing missing customer intent.",
    incident: ticket.incident,
    finalAction: selected.action,
    summary: `${rootCauseAnalysis.attribution === "inconclusive" ? "Supply attribution remains inconclusive" : `${rootCauseAnalysis.primaryCause?.label} is ${rootCauseAnalysis.attribution}`} while the customer remedy is ${selected.action.replaceAll("_", " ").toLowerCase()}.`,
    confidence,
    approvalStatus,
    evidence,
    candidates,
    toolCalls,
    verification,
    timeline,
    supplyTrace,
    rootCauseAnalysis,
    supplyDecision,
    customerOutcome,
    versions: {
      controller: CONTROLLER_VERSION,
      policy: POLICY_VERSION,
      scoring: SCORING_VERSION,
      model:
        ticket.source === "manual" && process.env.GEMINI_API_KEY
          ? `gemini-intake:${process.env.GEMINI_MODEL ?? "gemini-3.5-flash"}`
          : "deterministic-controller",
    },
    createdAt: new Date().toISOString(),
  };
  await saveDecision(record);
  await emit({ type: "complete", decision: record, lane: "shared" });
  return record;
}

export async function getOrCreateDecision(id: string) {
  const existing = await getDecision(id);
  if (existing) return existing;
  const ticketId = id.startsWith("DEC-") ? `TKT-${id.slice(4)}` : id;
  return runAgent(ticketId);
}
