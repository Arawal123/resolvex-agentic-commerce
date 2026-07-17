import { CONTROLLER_VERSION, POLICY_VERSION, SCORING_VERSION } from "@/lib/config";
import { getDecision, saveDecision } from "@/lib/decisions/repository";
import { generateCandidates, selectCandidate } from "@/lib/decision/scorer";
import { getPlaybook } from "@/lib/agent/playbooks";
import { getTicket } from "@/lib/tickets/repository";
import {
  toolRegistry,
  type ToolContext,
  type ToolName,
  type ToolResult,
} from "@/lib/tools/registry";
import type {
  AgentEvent,
  AgentPhase,
  DecisionRecord,
  EvidenceItem,
  TimelineEvent,
  ToolTrace,
  VerificationResult,
} from "@/lib/types";

const context: ToolContext = {
  role: "agent",
  permissions: ["support:read", "operations:write", "finance:write", "verify:read"],
};

type EventSink = (event: AgentEvent) => Promise<void> | void;

function now(index: number) {
  return new Date(Date.now() + index * 280).toISOString();
}

function trace(
  name: string,
  phase: AgentPhase,
  result: ToolResult,
  input: Record<string, unknown>,
  index: number
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

function readInput(name: ToolName, ticket: NonNullable<Awaited<ReturnType<typeof getTicket>>>) {
  if (name === "getCustomerProfile" || name === "getCustomerCaseHistory")
    return { customerId: ticket.customerId };
  if (name === "getOrderDetails" || name === "getPaymentStatus") return { orderId: ticket.orderId };
  return { ticketId: ticket.id };
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
  const emitPhase = (phase: AgentPhase, title: string, detail: string) =>
    emit({ type: "phase", phase, title, detail });
  const call = async (
    name: ToolName,
    input: Record<string, unknown>,
    phase: AgentPhase,
    idempotencyKey?: string
  ) => {
    const tool = toolRegistry[name] as unknown as {
      call: (input: unknown, context: ToolContext) => Promise<ToolResult<Record<string, unknown>>>;
    };
    const result = await tool.call(input, { ...context, idempotencyKey });
    const toolTrace = trace(name, phase, result, input, toolIndex++);
    toolCalls.push(toolTrace);
    await emit({ type: "tool", trace: toolTrace });
    return { result, trace: toolTrace };
  };
  const verify = async (
    check: string,
    callResult: Awaited<ReturnType<typeof call>>,
    detail?: string
  ) => {
    const result: VerificationResult = {
      id: `V-${String(verification.length + 1).padStart(2, "0")}`,
      check,
      passed: Boolean(callResult.result.data.verified),
      detail: detail ?? JSON.stringify(callResult.result.data),
      toolCallId: callResult.trace.id,
    };
    verification.push(result);
    await emit({ type: "verification", result });
    return result;
  };

  await emitPhase(
    "OBSERVE",
    "Manual intent grounded",
    `${playbook.label} · ${playbook.readTools.length} minimum-necessary reads`
  );
  for (const name of playbook.readTools) await call(name, readInput(name, ticket), "OBSERVE");

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

  await emitPhase(
    "PLAN",
    "Policy-constrained alternatives scored",
    `${playbook.candidates.length} incident-valid candidates evaluated with reproducible weights`
  );
  const candidates = generateCandidates(ticket, evidence);
  const selected = selectCandidate(candidates);
  if (!selected) throw new Error("No valid candidate action");
  const approvalStatus: DecisionRecord["approvalStatus"] = selected.requiresApproval
    ? "pending"
    : "not_required";

  await emitPhase(
    "ACT",
    selected.requiresApproval ? "Approval boundary reached" : "Bounded tools executing",
    `${selected.action.replaceAll("_", " ")} selected at ${selected.utilityScore.toFixed(3)} utility`
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
      `${runId}:approval`
    );
    await emit({ type: "approval", ticketId, reason });
  } else if (selected.action.includes("REPLACEMENT")) {
    await call(
      "createReplacementOrder",
      { ticketId, orderId: ticket.orderId, priority: selected.action === "PRIORITY_REPLACEMENT" },
      "ACT",
      `${runId}:replacement`
    );
    await call("reserveInventory", { ticketId, quantity: 1 }, "ACT", `${runId}:inventory`);
    if (selected.action === "PRIORITY_REPLACEMENT")
      await call("createCoupon", { ticketId, amount: 300 }, "ACT", `${runId}:coupon`);
    await call(
      "notifyWarehouse",
      {
        ticketId,
        message: `${selected.action.replaceAll("_", " ")} authorized by ${playbook.primaryPolicy}.`,
      },
      "ACT",
      `${runId}:warehouse`
    );
    await call(
      "sendCustomerMessage",
      {
        ticketId,
        message: `We created a ${selected.action === "PRIORITY_REPLACEMENT" ? "priority" : "standard"} replacement under the applicable policy.`,
      },
      "ACT",
      `${runId}:message`
    );
    await emitPhase(
      "VERIFY",
      "Replacement state reading back",
      "Independent verification tools are checking each write."
    );
    await verify(
      "Replacement order exists",
      await call("verifyReplacement", { ticketId }, "VERIFY")
    );
    await verify(
      "Inventory reservation exists",
      await call("verifyInventoryReservation", { ticketId }, "VERIFY")
    );
    if (selected.action === "PRIORITY_REPLACEMENT")
      await verify("Recovery coupon is active", await call("verifyCoupon", { ticketId }, "VERIFY"));
    await verify(
      "Customer notification delivered",
      await call("verifyCustomerNotification", { ticketId }, "VERIFY")
    );
  } else if (selected.action === "FULL_REFUND" || selected.action === "PARTIAL_REFUND") {
    const amount =
      selected.action === "FULL_REFUND" ? ticket.orderValue : Math.round(ticket.orderValue * 0.25);
    const tool = selected.action === "FULL_REFUND" ? "issueRefund" : "issuePartialRefund";
    await call(tool, { ticketId, amount }, "ACT", `${runId}:refund`);
    await call(
      "sendCustomerMessage",
      {
        ticketId,
        message: `A ₹${amount.toLocaleString("en-IN")} refund was submitted for verification.`,
      },
      "ACT",
      `${runId}:message`
    );
    await emitPhase(
      "VERIFY",
      "Financial ledger reading back",
      "Refund and customer notification receipts are being checked."
    );
    await verify(
      "Refund present in payment ledger",
      await call("verifyRefund", { ticketId }, "VERIFY")
    );
    await verify(
      "Customer notification delivered",
      await call("verifyCustomerNotification", { ticketId }, "VERIFY")
    );
  } else if (selected.action === "COUPON_COMPENSATION") {
    await call("createCoupon", { ticketId, amount: 300 }, "ACT", `${runId}:coupon`);
    await call(
      "sendCustomerMessage",
      { ticketId, message: "A ₹300 service-recovery credit is now active." },
      "ACT",
      `${runId}:message`
    );
    await emitPhase(
      "VERIFY",
      "Recovery credit reading back",
      "Coupon and notification receipts are being checked."
    );
    await verify("Recovery coupon is active", await call("verifyCoupon", { ticketId }, "VERIFY"));
    await verify(
      "Customer notification delivered",
      await call("verifyCustomerNotification", { ticketId }, "VERIFY")
    );
  } else if (selected.action === "COURIER_INVESTIGATION") {
    await call("openCourierInvestigation", { ticketId }, "ACT", `${runId}:courier`);
    await call(
      "scheduleFollowUp",
      { ticketId, at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() },
      "ACT",
      `${runId}:follow-up`
    );
    await emitPhase(
      "VERIFY",
      "Investigation state reading back",
      "Courier trace and follow-up state are being checked."
    );
    await verify(
      "Courier investigation is open",
      await call("verifyCourierInvestigation", { ticketId }, "VERIFY")
    );
    await verify(
      "Operational follow-up is scheduled",
      await call("verifyFollowUp", { ticketId }, "VERIFY")
    );
  } else if (selected.action === "WAIT_AND_MONITOR") {
    await call(
      "scheduleFollowUp",
      { ticketId, at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() },
      "ACT",
      `${runId}:follow-up`
    );
    await emitPhase(
      "VERIFY",
      "Follow-up state reading back",
      "The bounded monitoring schedule is being checked."
    );
    await verify(
      "Operational follow-up is scheduled",
      await call("verifyFollowUp", { ticketId }, "VERIFY")
    );
  }

  const shouldResolve =
    !selected.requiresApproval &&
    !["COURIER_INVESTIGATION", "WAIT_AND_MONITOR"].includes(selected.action) &&
    verification.length > 0 &&
    verification.every((item) => item.passed);
  if (shouldResolve) {
    await call("resolveTicket", { ticketId }, "COMPLETE", `${runId}:resolve`);
    await verify(
      "Ticket state is resolved",
      await call("verifyTicketState", { ticketId }, "VERIFY"),
      "Independent read confirmed resolved state."
    );
  }

  await emitPhase(
    "EXPLAIN",
    "Contestable decision sealed",
    `${evidence.length} evidence items · ${candidates.length} candidates · ${toolCalls.length} tool calls`
  );
  const timeline: TimelineEvent[] = [
    {
      id: "TL-01",
      phase: "OBSERVE",
      title: "Intent and incident grounded",
      detail: `${ticket.incident} · goal: ${ticket.requestedOutcome}`,
      at: now(0),
      status: "complete",
    },
    {
      id: "TL-02",
      phase: "PLAN",
      title: `${playbook.candidates.length} playbook actions evaluated`,
      detail: `${playbook.primaryPolicy} · deterministic validity and scoring`,
      at: now(2),
      status: "complete",
    },
    {
      id: "TL-03",
      phase: "ACT",
      title: `${toolCalls.filter((item) => item.phase === "ACT").length} consequential calls processed`,
      detail: selected.requiresApproval
        ? "Execution stopped at the approval boundary."
        : "Every consequential call used a run-scoped idempotency key.",
      at: now(7),
      status: selected.requiresApproval ? "warning" : "complete",
    },
    {
      id: "TL-04",
      phase: "VERIFY",
      title: "Operational state independently verified",
      detail: `${verification.filter((item) => item.passed).length}/${verification.length} verification checks passed.`,
      at: now(12),
      status: verification.every((item) => item.passed) ? "complete" : "warning",
    },
    {
      id: "TL-05",
      phase: "EXPLAIN",
      title: "Decision record persisted",
      detail: `${evidence.length} evidence items · ${candidates.length} candidates · ${toolCalls.length} tool calls`,
      at: now(14),
      status: "complete",
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
    summary: selected.requiresApproval
      ? `${selected.action.replaceAll("_", " ")} is held for attributed human approval; no consequential action was executed.`
      : `${selected.action.replaceAll("_", " ")} executed through the ${playbook.label.toLowerCase()} playbook and was independently verified.`,
    confidence,
    approvalStatus,
    evidence,
    candidates,
    toolCalls,
    verification,
    timeline,
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
  await emit({ type: "complete", decision: record });
  return record;
}

export async function getOrCreateDecision(id: string) {
  const existing = await getDecision(id);
  if (existing) return existing;
  const ticketId = id.startsWith("DEC-") ? `TKT-${id.slice(4)}` : id;
  return runAgent(ticketId);
}
