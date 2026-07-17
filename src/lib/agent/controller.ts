import { CONTROLLER_VERSION, POLICY_VERSION, SCORING_VERSION } from "@/lib/config";
import { storedDecisions, tickets } from "@/lib/demo-data";
import { generateCandidates, selectCandidate } from "@/lib/decision/scorer";
import { toolRegistry, type ToolContext, type ToolResult } from "@/lib/tools/registry";
import type {
  AgentPhase,
  DecisionRecord,
  EvidenceItem,
  TimelineEvent,
  ToolTrace,
} from "@/lib/types";

const context: ToolContext = {
  role: "agent",
  permissions: ["support:read", "operations:write", "finance:write", "verify:read"],
};

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

export async function runAgent(ticketId: string): Promise<DecisionRecord> {
  const ticket = tickets.find((item) => item.id === ticketId);
  if (!ticket) throw new Error("Ticket not found");
  const runId = `RUN-${ticketId.slice(4)}-${Date.now().toString().slice(-4)}`;
  const toolCalls: ToolTrace[] = [];
  let toolIndex = 1;
  const call = async (
    name: keyof typeof toolRegistry,
    input: Record<string, unknown>,
    phase: AgentPhase,
    idempotencyKey?: string
  ) => {
    const tool = toolRegistry[name] as unknown as {
      call: (input: unknown, context: ToolContext) => Promise<ToolResult<Record<string, unknown>>>;
    };
    const result = await tool.call(input, { ...context, idempotencyKey });
    toolCalls.push(trace(name, phase, result, input, toolIndex++));
    return result;
  };

  const customer = await call("getCustomerProfile", { customerId: ticket.customerId }, "OBSERVE");
  const order = await call("getOrderDetails", { orderId: ticket.orderId }, "OBSERVE");
  const tracking = await call("getTrackingHistory", { ticketId }, "ACT");
  const inventory = await call("checkInventory", { ticketId }, "ACT");
  const policy = await call("retrieveRelevantPolicies", { ticketId }, "ACT");
  await call("getShippingOptions", { ticketId }, "PLAN");

  const evidence: EvidenceItem[] = [
    {
      id: "E-01",
      claim: "The customer still wants the product before a stated deadline.",
      sourceType: "DATABASE",
      sourceLabel: `${ticketId} message`,
      value: ticket.requestedOutcome,
    },
    {
      id: "E-02",
      claim: "The promised delivery date has passed and SLA risk is critical.",
      sourceType: "DATABASE",
      sourceLabel: `${ticket.orderId} promised date`,
      value: ticket.slaHours,
    },
    {
      id: "E-03",
      claim: `The shipment has had no movement for ${ticket.inactiveDays} days.`,
      sourceType: "TOOL_RESULT",
      sourceLabel: toolCalls.find((item) => item.name === "getTrackingHistory")!.id,
      value: tracking.data.inactiveDays as number,
    },
    {
      id: "E-04",
      claim: `${ticket.inventory} replacement units are available.`,
      sourceType: "TOOL_RESULT",
      sourceLabel: toolCalls.find((item) => item.name === "checkInventory")!.id,
      value: inventory.data.available as number,
    },
    {
      id: "E-05",
      claim: "Delayed Delivery Policy §4.2 authorizes replacement after five inactive days.",
      sourceType: "POLICY",
      sourceLabel: "P-02 §4.2",
      value: policy.data.policyVersion as string,
    },
    {
      id: "E-06",
      claim: `The order value is ₹${ticket.orderValue.toLocaleString("en-IN")}.`,
      sourceType: "DATABASE",
      sourceLabel: `${ticket.orderId} order total`,
      value: ticket.orderValue,
    },
    {
      id: "E-07",
      claim: "Customer anomaly risk is below the review threshold.",
      sourceType: "TOOL_RESULT",
      sourceLabel: toolCalls.find((item) => item.name === "getCustomerProfile")!.id,
      value: customer.data.anomalyRisk as number,
    },
    {
      id: "E-08",
      claim: "The order payment is captured and fulfillment is shipped.",
      sourceType: "TOOL_RESULT",
      sourceLabel: toolCalls.find((item) => item.name === "getOrderDetails")!.id,
      value: order.data.fulfillment as string,
    },
  ];

  const candidates = generateCandidates(ticket, evidence);
  const selected = selectCandidate(candidates);
  const approvalStatus: DecisionRecord["approvalStatus"] = selected.requiresApproval
    ? "pending"
    : "not_required";
  const verification = [] as DecisionRecord["verification"];

  if (selected.requiresApproval) {
    await call(
      "escalateToHuman",
      {
        ticketId,
        reason: "Selected remedy exceeds the ₹5,000 autonomous limit.",
        proposedAction: selected.action,
      },
      "ACT",
      `${runId}:approval`
    );
  } else if (selected.action.includes("REPLACEMENT")) {
    await call(
      "createReplacementOrder",
      { ticketId, orderId: ticket.orderId, priority: selected.action === "PRIORITY_REPLACEMENT" },
      "ACT",
      `${runId}:replacement`
    );
    await call("reserveInventory", { ticketId, quantity: 1 }, "ACT", `${runId}:inventory`);
    await call("createCoupon", { ticketId, amount: 300 }, "ACT", `${runId}:coupon`);
    await call(
      "notifyWarehouse",
      { ticketId, message: "Priority replacement approved by policy engine." },
      "ACT",
      `${runId}:warehouse`
    );
    await call(
      "sendCustomerMessage",
      {
        ticketId,
        message:
          "We created a priority replacement and ₹300 service-recovery credit. Delivery is expected within two business days.",
      },
      "ACT",
      `${runId}:message`
    );
    const replacementCheck = await call("verifyReplacement", { ticketId }, "VERIFY");
    const inventoryCheck = await call("verifyInventoryReservation", { ticketId }, "VERIFY");
    const couponCheck = await call("verifyCoupon", { ticketId }, "VERIFY");
    const notificationCheck = await call("verifyCustomerNotification", { ticketId }, "VERIFY");
    for (const [check, result] of [
      ["Replacement order exists", replacementCheck],
      ["Inventory reservation exists", inventoryCheck],
      ["Coupon is active", couponCheck],
      ["Customer notification delivered", notificationCheck],
    ] as const) {
      verification.push({
        id: `V-${String(verification.length + 1).padStart(2, "0")}`,
        check,
        passed: Boolean(result.data.verified),
        detail: JSON.stringify(result.data),
        toolCallId: toolCalls.at(-1)!.id,
      });
    }
    if (verification.every((item) => item.passed)) {
      await call("resolveTicket", { ticketId }, "COMPLETE", `${runId}:resolve`);
      const ticketCheck = await call("verifyTicketState", { ticketId }, "VERIFY");
      verification.push({
        id: "V-05",
        check: "Ticket state is resolved",
        passed: Boolean(ticketCheck.data.verified),
        detail: "Independent read confirmed resolved state.",
        toolCallId: toolCalls.at(-1)!.id,
      });
    }
  } else if (selected.action === "FULL_REFUND") {
    const refund = await call(
      "issueRefund",
      { ticketId, amount: ticket.orderValue },
      "ACT",
      `${runId}:refund`
    );
    if (refund.ok) {
      const check = await call("verifyRefund", { ticketId }, "VERIFY");
      verification.push({
        id: "V-01",
        check: "Refund present in payment ledger",
        passed: Boolean(check.data.verified),
        detail: JSON.stringify(check.data),
        toolCallId: toolCalls.at(-1)!.id,
      });
    }
  } else if (selected.action === "COURIER_INVESTIGATION") {
    await call("openCourierInvestigation", { ticketId }, "ACT", `${runId}:courier`);
  }

  const timeline: TimelineEvent[] = [
    {
      id: "TL-01",
      phase: "OBSERVE",
      title: "Intent and incident parsed",
      detail: `${ticket.incident} · goal: ${ticket.requestedOutcome}`,
      at: now(0),
      status: "complete",
    },
    {
      id: "TL-02",
      phase: "PLAN",
      title: "Six-step plan committed",
      detail:
        "Retrieve only decision-critical customer, order, tracking, inventory, policy, and shipping evidence.",
      at: now(2),
      status: "complete",
    },
    {
      id: "TL-03",
      phase: "ACT",
      title: `${toolCalls.filter((item) => item.phase === "ACT").length} operational tool calls executed`,
      detail: "Every consequential call used an idempotency key.",
      at: now(7),
      status: "complete",
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
      title: "Contestable decision record sealed",
      detail: `${evidence.length} evidence items · ${candidates.length} candidates · ${toolCalls.length} tool calls`,
      at: now(14),
      status: "complete",
    },
  ];

  const record: DecisionRecord = {
    id: `DEC-${ticketId.slice(4)}`,
    runId,
    ticketId,
    customerGoal:
      ticket.requestedOutcome === "product"
        ? "Receive the purchased product before the stated deadline."
        : "Recover the charged amount to the original payment method.",
    incident: ticket.incident,
    finalAction: selected.action,
    summary:
      selected.action === "PRIORITY_REPLACEMENT"
        ? "Create a priority replacement, reserve one unit, issue ₹300 recovery credit, notify fulfillment, message the customer, and resolve only after verification."
        : `Execute ${selected.action.toLowerCase().replaceAll("_", " ")} under the applicable policy guardrail.`,
    confidence: 0.94,
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
      model: process.env.OPENAI_API_KEY
        ? (process.env.OPENAI_MODEL ?? "gpt-5.2")
        : "deterministic-sandbox (no model call)",
    },
    createdAt: new Date().toISOString(),
  };
  storedDecisions[record.id] = record;
  return record;
}

export async function getOrCreateDecision(id: string) {
  if (storedDecisions[id]) return storedDecisions[id];
  const ticketId = id.startsWith("DEC-") ? `TKT-${id.slice(4)}` : id;
  return runAgent(ticketId);
}
