import { z } from "zod";
import {
  getTicket,
  getTicketByCustomerId,
  getTicketByOrderId,
  listTickets,
} from "@/lib/tickets/repository";
import type { SupplyAction } from "@/lib/types";

export type Permission = "support:read" | "operations:write" | "finance:write" | "verify:read";

export interface ToolContext {
  role: "agent" | "operator" | "auditor";
  permissions: Permission[];
  idempotencyKey?: string;
}

export interface ToolResult<T = Record<string, unknown>> {
  ok: boolean;
  code: string;
  data: T;
  latencyMs: number;
  auditId: string;
}

interface ToolDefinition<TSchema extends z.ZodType, TOutput extends Record<string, unknown>> {
  name: string;
  description: string;
  permission: Permission;
  schema: TSchema;
  execute: (input: z.infer<TSchema>, context: ToolContext) => Promise<TOutput> | TOutput;
}

const auditEvents: Array<Record<string, unknown>> = [];
const idempotencyLedger = new Map<string, ToolResult<Record<string, unknown>>>();
const sandboxState = {
  replacements: new Map<string, string>(),
  refunds: new Map<string, number>(),
  coupons: new Map<string, number>(),
  inventoryReservations: new Map<string, number>(),
  messages: new Set<string>(),
  resolvedTickets: new Set<string>(),
  courierInvestigations: new Set<string>(),
  followUps: new Map<string, string>(),
  supplyCorrections: new Map<
    string,
    { action: SupplyAction; rootCauseId: string; state: string }
  >(),
  supplyEscalations: new Map<string, string>(),
};

const executableSupplyAction = z.enum([
  "CARRIER_CORRECTIVE_INVESTIGATION",
  "WAREHOUSE_QA_AUDIT",
  "PACKAGING_QUALITY_AUDIT",
  "PICK_ACCURACY_AUDIT",
  "INVENTORY_RECONCILIATION",
  "PAYMENT_IDEMPOTENCY_RECONCILIATION",
  "RETURNS_PROCESS_REVIEW",
]);

export function defineTool<TSchema extends z.ZodType, TOutput extends Record<string, unknown>>(
  definition: ToolDefinition<TSchema, TOutput>
) {
  return {
    ...definition,
    async call(rawInput: unknown, context: ToolContext): Promise<ToolResult<TOutput>> {
      const started = performance.now();
      const input = definition.schema.parse(rawInput);
      if (!context.permissions.includes(definition.permission)) {
        return {
          ok: false,
          code: "PERMISSION_DENIED",
          data: {} as TOutput,
          latencyMs: 0,
          auditId: `AUD-${auditEvents.length + 1}`,
        };
      }
      const key = context.idempotencyKey
        ? `${definition.name}:${context.idempotencyKey}`
        : undefined;
      if (key && idempotencyLedger.has(key))
        return idempotencyLedger.get(key)! as ToolResult<TOutput>;
      try {
        const data = await definition.execute(input, context);
        const result: ToolResult<TOutput> = {
          ok: true,
          code: "OK",
          data,
          latencyMs: Math.max(1, Math.round(performance.now() - started)),
          auditId: `AUD-${auditEvents.length + 1}`,
        };
        auditEvents.push({ ...result, name: definition.name, input, at: new Date().toISOString() });
        if (key) idempotencyLedger.set(key, result as ToolResult<Record<string, unknown>>);
        return result;
      } catch (error) {
        const result: ToolResult<TOutput> = {
          ok: false,
          code: "TOOL_EXECUTION_FAILED",
          data: {
            message: error instanceof Error ? error.message : "Unknown error",
          } as unknown as TOutput,
          latencyMs: Math.max(1, Math.round(performance.now() - started)),
          auditId: `AUD-${auditEvents.length + 1}`,
        };
        auditEvents.push({ ...result, name: definition.name, input, at: new Date().toISOString() });
        return result;
      }
    },
  };
}

const ticketInput = z.object({ ticketId: z.string().min(1) });
const orderInput = z.object({ orderId: z.string().min(1) });
const customerInput = z.object({ customerId: z.string().min(1) });

async function ticketById(ticketId: string) {
  const ticket = await getTicket(ticketId);
  if (!ticket) throw new Error("TICKET_NOT_FOUND");
  return ticket;
}

const read = <T extends z.ZodType>(
  name: string,
  description: string,
  schema: T,
  execute: (input: z.infer<T>) => Promise<Record<string, unknown>> | Record<string, unknown>
) => defineTool({ name, description, permission: "support:read", schema, execute });

export const toolRegistry = {
  getCustomerProfile: read(
    "getCustomerProfile",
    "Retrieve customer profile and service tier",
    customerInput,
    async ({ customerId }) => {
      const ticket = await getTicketByCustomerId(customerId);
      return {
        customerId,
        name: ticket?.customerName ?? "Unknown customer",
        tier: ticket?.source === "manual" ? "Standard" : "Black",
        lifetimeOrders: ticket?.source === "manual" ? 1 : 17,
        lifetimeValue: ticket?.orderValue ?? 0,
        anomalyRisk: ticket?.incident === "UNSUPPORTED_REQUEST" ? 0.5 : 0.08,
      };
    }
  ),
  getOrderDetails: read(
    "getOrderDetails",
    "Retrieve immutable order details",
    orderInput,
    async ({ orderId }) => {
      const ticket = await getTicketByOrderId(orderId);
      const payment = ticket?.operationalFacts?.paymentStatus ?? "captured";
      return {
        orderId,
        currency: "INR",
        total: ticket?.orderValue ?? 0,
        captured: payment === "captured",
        paymentStatus: payment,
        fulfillment: ticket?.trackingStatus ?? "unknown",
        synthetic: true,
      };
    }
  ),
  getPaymentStatus: read(
    "getPaymentStatus",
    "Retrieve payment ledger state",
    orderInput,
    async ({ orderId }) => {
      const ticket = await getTicketByOrderId(orderId);
      return {
        orderId,
        state: ticket?.operationalFacts?.paymentStatus ?? "unknown",
        duplicateDetected: ticket?.operationalFacts?.duplicateChargeVerified ?? false,
      };
    }
  ),
  getTrackingHistory: read(
    "getTrackingHistory",
    "Retrieve shipment event history",
    ticketInput,
    async ({ ticketId }) => {
      const t = await ticketById(ticketId);
      return {
        shipmentId: `SHP-${t.orderId.slice(4)}`,
        inactiveDays: t.inactiveDays,
        currentStatus: t.trackingStatus,
        eventCount: 5,
      };
    }
  ),
  checkInventory: read(
    "checkInventory",
    "Check sellable replacement inventory",
    ticketInput,
    async ({ ticketId }) => {
      const t = await ticketById(ticketId);
      return { sku: `SKU-${t.orderId.slice(-3)}`, available: t.inventory, warehouse: "BLR-02" };
    }
  ),
  getCustomerCaseHistory: read(
    "getCustomerCaseHistory",
    "Retrieve prior support cases",
    customerInput,
    ({ customerId }) => ({ customerId, priorCases: 2, upheldClaims: 2, abuseIndicator: false })
  ),
  retrieveRelevantPolicies: read(
    "retrieveRelevantPolicies",
    "Retrieve applicable versioned policy clauses",
    ticketInput,
    async ({ ticketId }) => {
      const ticket = await ticketById(ticketId);
      const byIncident = {
        DELAYED_DELIVERY: ["P-02 §4.2", "P-05 §2.1", "P-14 §5.4"],
        DAMAGED_PRODUCT: ["P-08 §3.3", "P-05 §2.1"],
        WRONG_PRODUCT: ["P-08 §3.6", "P-05 §2.1"],
        RETURN_REQUEST: ["P-09 §2.2", "P-05 §2.1"],
        LOST_SHIPMENT: ["P-02 §5.1", "P-05 §2.1"],
        OUT_OF_STOCK: ["P-06 §1.4", "P-05 §2.1"],
        DUPLICATE_CHARGE: ["P-11 §1.2", "P-05 §2.1"],
        DELIVERY_FAILURE: ["P-02 §6.2", "P-14 §5.4"],
        UNSUPPORTED_REQUEST: ["P-01 §1.1"],
      } as const;
      return { ticketId, policies: byIncident[ticket.incident], policyVersion: "2026.07" };
    }
  ),
  getShippingOptions: read(
    "getShippingOptions",
    "Estimate available replacement shipping options",
    ticketInput,
    ({ ticketId }) => ({
      ticketId,
      options: [
        { service: "Priority Air", days: 2, cost: 420 },
        { service: "Standard", days: 5, cost: 120 },
      ],
    })
  ),
  getOperationalBudget: read(
    "getOperationalBudget",
    "Retrieve current compensation budget",
    z.object({ date: z.string() }),
    ({ date }) => ({ date, limit: 20000, consumed: 12840, remaining: 7160 })
  ),
  getWarehouseCapacity: read(
    "getWarehouseCapacity",
    "Retrieve warehouse handling capacity",
    z.object({ warehouseId: z.string() }),
    ({ warehouseId }) => ({ warehouseId, replacementSlots: 42, utilization: 0.68 })
  ),
  getOpenTickets: read(
    "getOpenTickets",
    "Retrieve eligible open tickets",
    z.object({ limit: z.number().int().min(1).max(250).default(50) }),
    async ({ limit }) => ({
      tickets: (await listTickets())
        .filter((ticket) => ticket.status !== "resolved")
        .slice(0, limit),
    })
  ),
  calculateRefund: read(
    "calculateRefund",
    "Calculate deterministic refund amount",
    z.object({ orderValue: z.number().nonnegative(), percentage: z.number().min(0).max(1) }),
    ({ orderValue, percentage }) => ({
      amount: Math.round(orderValue * percentage),
      currency: "INR",
    })
  ),
  estimateReplacementCost: read(
    "estimateReplacementCost",
    "Calculate replacement and shipping cost",
    z.object({ orderValue: z.number().positive(), priority: z.boolean() }),
    ({ orderValue, priority }) => ({
      amount: Math.round(orderValue * 0.31 + (priority ? 420 : 120)),
      currency: "INR",
    })
  ),
  estimateDeliveryDate: read(
    "estimateDeliveryDate",
    "Calculate delivery date using service SLA",
    z.object({ days: z.number().int().min(1).max(30) }),
    ({ days }) => ({ date: new Date(Date.now() + days * 86400000).toISOString().slice(0, 10) })
  ),
  detectDuplicateAction: read(
    "detectDuplicateAction",
    "Check idempotency ledger for consequential actions",
    z.object({ action: z.string(), idempotencyKey: z.string() }),
    ({ action, idempotencyKey }) => ({
      duplicate: idempotencyLedger.has(`${action}:${idempotencyKey}`),
    })
  ),

  createReplacementOrder: defineTool({
    name: "createReplacementOrder",
    description: "Create a linked replacement order",
    permission: "operations:write",
    schema: z.object({ ticketId: z.string(), orderId: z.string(), priority: z.boolean() }),
    execute: ({ ticketId }) => {
      const id = sandboxState.replacements.get(ticketId) ?? `RPL-${ticketId.slice(4)}-01`;
      sandboxState.replacements.set(ticketId, id);
      return { replacementOrderId: id, state: "created" };
    },
  }),
  reserveInventory: defineTool({
    name: "reserveInventory",
    description: "Reserve sellable inventory transactionally",
    permission: "operations:write",
    schema: z.object({ ticketId: z.string(), quantity: z.number().int().positive() }),
    execute: async ({ ticketId, quantity }) => {
      const ticket = await ticketById(ticketId);
      if (ticket.inventory < quantity) throw new Error("INSUFFICIENT_INVENTORY");
      sandboxState.inventoryReservations.set(ticketId, quantity);
      return { reservationId: `RSV-${ticketId.slice(4)}`, quantity, state: "reserved" };
    },
  }),
  issueRefund: defineTool({
    name: "issueRefund",
    description: "Issue a full refund to original payment method",
    permission: "finance:write",
    schema: z.object({
      ticketId: z.string(),
      amount: z.number().positive(),
      approvalId: z.string().optional(),
    }),
    execute: ({ ticketId, amount }) => {
      if (amount > 5000) throw new Error("APPROVAL_REQUIRED");
      sandboxState.refunds.set(ticketId, amount);
      return { refundId: `RF-${ticketId.slice(4)}`, amount, state: "submitted" };
    },
  }),
  issuePartialRefund: defineTool({
    name: "issuePartialRefund",
    description: "Issue a policy-bounded partial refund",
    permission: "finance:write",
    schema: z.object({ ticketId: z.string(), amount: z.number().positive() }),
    execute: ({ ticketId, amount }) => {
      sandboxState.refunds.set(ticketId, amount);
      return { refundId: `PRF-${ticketId.slice(4)}`, amount, state: "submitted" };
    },
  }),
  createCoupon: defineTool({
    name: "createCoupon",
    description: "Create a one-time store credit coupon",
    permission: "finance:write",
    schema: z.object({ ticketId: z.string(), amount: z.number().min(1).max(500) }),
    execute: ({ ticketId, amount }) => {
      sandboxState.coupons.set(ticketId, amount);
      return { couponId: `CX-${ticketId.slice(4)}`, amount, state: "active" };
    },
  }),
  cancelOrder: defineTool({
    name: "cancelOrder",
    description: "Cancel an eligible order",
    permission: "operations:write",
    schema: orderInput,
    execute: ({ orderId }) => ({ orderId, state: "cancelled" }),
  }),
  updateSupportTicket: defineTool({
    name: "updateSupportTicket",
    description: "Update case state with attribution",
    permission: "operations:write",
    schema: z.object({
      ticketId: z.string(),
      status: z.enum(["running", "approval", "resolved"]),
      note: z.string().max(1000),
    }),
    execute: (input) => ({ ...input, updated: true }),
  }),
  openCourierInvestigation: defineTool({
    name: "openCourierInvestigation",
    description: "Open courier trace investigation",
    permission: "operations:write",
    schema: ticketInput,
    execute: ({ ticketId }) => {
      sandboxState.courierInvestigations.add(ticketId);
      return { investigationId: `INV-${ticketId.slice(4)}`, state: "open" };
    },
  }),
  notifyWarehouse: defineTool({
    name: "notifyWarehouse",
    description: "Notify fulfillment control tower",
    permission: "operations:write",
    schema: z.object({ ticketId: z.string(), message: z.string().max(1000) }),
    execute: ({ ticketId }) => ({ notificationId: `WN-${ticketId.slice(4)}`, delivered: true }),
  }),
  sendCustomerMessage: defineTool({
    name: "sendCustomerMessage",
    description: "Send approved customer-facing resolution",
    permission: "operations:write",
    schema: z.object({ ticketId: z.string(), message: z.string().min(1).max(2000) }),
    execute: ({ ticketId }) => {
      sandboxState.messages.add(ticketId);
      return { messageId: `MSG-${ticketId.slice(4)}`, delivered: true };
    },
  }),
  escalateToHuman: defineTool({
    name: "escalateToHuman",
    description: "Route case to approval queue",
    permission: "operations:write",
    schema: z.object({
      ticketId: z.string(),
      reason: z.string().min(1),
      proposedAction: z.string(),
    }),
    execute: ({ ticketId, reason }) => ({
      approvalId: `APR-${ticketId.slice(4)}`,
      queue: "risk-ops",
      reason,
      state: "pending",
    }),
  }),
  scheduleFollowUp: defineTool({
    name: "scheduleFollowUp",
    description: "Schedule a bounded verification follow-up",
    permission: "operations:write",
    schema: z.object({ ticketId: z.string(), at: z.string().datetime() }),
    execute: (input) => {
      sandboxState.followUps.set(input.ticketId, input.at);
      return { ...input, scheduled: true };
    },
  }),
  resolveTicket: defineTool({
    name: "resolveTicket",
    description: "Resolve a ticket after verification",
    permission: "operations:write",
    schema: ticketInput,
    execute: ({ ticketId }) => {
      sandboxState.resolvedTickets.add(ticketId);
      return { ticketId, state: "resolved" };
    },
  }),
  executeSupplyCorrection: defineTool({
    name: "executeSupplyCorrection",
    description: "Open a typed sandbox corrective action against the attributed supply stage",
    permission: "operations:write",
    schema: z.object({
      ticketId: z.string().min(1),
      action: executableSupplyAction,
      rootCauseId: z.string().min(1),
    }),
    execute: ({ ticketId, action, rootCauseId }) => {
      const existing = sandboxState.supplyCorrections.get(ticketId);
      const correction = existing ?? { action, rootCauseId, state: "open" };
      sandboxState.supplyCorrections.set(ticketId, correction);
      return {
        correctionId: `SC-${ticketId.slice(4)}`,
        ...correction,
        sandbox: true,
      };
    },
  }),
  escalateSupplyIncident: defineTool({
    name: "escalateSupplyIncident",
    description: "Route inconclusive supply attribution for human operational review",
    permission: "operations:write",
    schema: z.object({ ticketId: z.string().min(1), reason: z.string().min(1).max(1500) }),
    execute: ({ ticketId, reason }) => {
      sandboxState.supplyEscalations.set(ticketId, reason);
      return {
        escalationId: `S-ESC-${ticketId.slice(4)}`,
        queue: "supply-control",
        state: "pending",
      };
    },
  }),

  verifyRefund: defineTool({
    name: "verifyRefund",
    description: "Verify refund in payment ledger",
    permission: "verify:read",
    schema: ticketInput,
    execute: ({ ticketId }) => ({
      verified: sandboxState.refunds.has(ticketId),
      amount: sandboxState.refunds.get(ticketId) ?? 0,
    }),
  }),
  verifyReplacement: defineTool({
    name: "verifyReplacement",
    description: "Verify replacement order state",
    permission: "verify:read",
    schema: ticketInput,
    execute: ({ ticketId }) => ({
      verified: sandboxState.replacements.has(ticketId),
      replacementOrderId: sandboxState.replacements.get(ticketId),
    }),
  }),
  verifyInventoryReservation: defineTool({
    name: "verifyInventoryReservation",
    description: "Verify inventory reservation state",
    permission: "verify:read",
    schema: ticketInput,
    execute: ({ ticketId }) => ({
      verified: sandboxState.inventoryReservations.has(ticketId),
      quantity: sandboxState.inventoryReservations.get(ticketId) ?? 0,
    }),
  }),
  verifyCoupon: defineTool({
    name: "verifyCoupon",
    description: "Verify coupon state",
    permission: "verify:read",
    schema: ticketInput,
    execute: ({ ticketId }) => ({
      verified: sandboxState.coupons.has(ticketId),
      amount: sandboxState.coupons.get(ticketId) ?? 0,
    }),
  }),
  verifyTicketState: defineTool({
    name: "verifyTicketState",
    description: "Verify support ticket state",
    permission: "verify:read",
    schema: ticketInput,
    execute: ({ ticketId }) => ({
      verified: sandboxState.resolvedTickets.has(ticketId),
      state: sandboxState.resolvedTickets.has(ticketId) ? "resolved" : "open",
    }),
  }),
  verifyCustomerNotification: defineTool({
    name: "verifyCustomerNotification",
    description: "Verify notification delivery receipt",
    permission: "verify:read",
    schema: ticketInput,
    execute: ({ ticketId }) => ({
      verified: sandboxState.messages.has(ticketId),
      delivered: sandboxState.messages.has(ticketId),
    }),
  }),
  verifyCourierInvestigation: defineTool({
    name: "verifyCourierInvestigation",
    description: "Verify courier investigation state",
    permission: "verify:read",
    schema: ticketInput,
    execute: ({ ticketId }) => ({
      verified: sandboxState.courierInvestigations.has(ticketId),
      state: sandboxState.courierInvestigations.has(ticketId) ? "open" : "missing",
    }),
  }),
  verifyFollowUp: defineTool({
    name: "verifyFollowUp",
    description: "Verify a scheduled operational follow-up",
    permission: "verify:read",
    schema: ticketInput,
    execute: ({ ticketId }) => ({
      verified: sandboxState.followUps.has(ticketId),
      at: sandboxState.followUps.get(ticketId),
    }),
  }),
  verifySupplyCorrection: defineTool({
    name: "verifySupplyCorrection",
    description: "Read back the independently stored supply corrective action",
    permission: "verify:read",
    schema: z.object({ ticketId: z.string().min(1), action: executableSupplyAction }),
    execute: ({ ticketId, action }) => {
      const correction = sandboxState.supplyCorrections.get(ticketId);
      return {
        verified: correction?.action === action && correction.state === "open",
        correctionId: correction ? `SC-${ticketId.slice(4)}` : null,
        state: correction?.state ?? "missing",
      };
    },
  }),
  verifySupplyEscalation: defineTool({
    name: "verifySupplyEscalation",
    description: "Verify an inconclusive supply case reached the human review queue",
    permission: "verify:read",
    schema: ticketInput,
    execute: ({ ticketId }) => ({
      verified: sandboxState.supplyEscalations.has(ticketId),
      state: sandboxState.supplyEscalations.has(ticketId) ? "pending" : "missing",
    }),
  }),
  verifyBatchExecution: defineTool({
    name: "verifyBatchExecution",
    description: "Verify each allocated batch action",
    permission: "verify:read",
    schema: z.object({ ticketIds: z.array(z.string()).min(1) }),
    execute: ({ ticketIds }) => ({
      verified: ticketIds.every((id) => sandboxState.resolvedTickets.has(id)),
      cases: ticketIds.map((id) => ({
        ticketId: id,
        verified: sandboxState.resolvedTickets.has(id),
      })),
    }),
  }),
} as const;

export type ToolName = keyof typeof toolRegistry;
export function getAuditEvents() {
  return [...auditEvents];
}
export function resetSandboxState() {
  sandboxState.replacements.clear();
  sandboxState.refunds.clear();
  sandboxState.coupons.clear();
  sandboxState.inventoryReservations.clear();
  sandboxState.messages.clear();
  sandboxState.resolvedTickets.clear();
  sandboxState.courierInvestigations.clear();
  sandboxState.followUps.clear();
  sandboxState.supplyCorrections.clear();
  sandboxState.supplyEscalations.clear();
  idempotencyLedger.clear();
  auditEvents.length = 0;
}
