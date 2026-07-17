import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};
export const ticketStatus = pgEnum("ticket_status", ["open", "running", "approval", "resolved"]);
export const runStatus = pgEnum("run_status", [
  "queued",
  "running",
  "completed",
  "failed",
  "approval",
]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  role: text("role").notNull(),
  ...timestamps,
});
export const customers = pgTable("customers", {
  id: uuid("id").defaultRandom().primaryKey(),
  externalId: text("external_id").notNull().unique(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  priority: numeric("priority", { precision: 4, scale: 3 }).notNull(),
  ...timestamps,
});
export const customerPreferences = pgTable("customer_preferences", {
  id: uuid("id").defaultRandom().primaryKey(),
  customerId: uuid("customer_id")
    .references(() => customers.id)
    .notNull(),
  channel: text("channel").notNull(),
  locale: text("locale").notNull(),
  ...timestamps,
});
export const products = pgTable("products", {
  id: uuid("id").defaultRandom().primaryKey(),
  sku: text("sku").notNull().unique(),
  name: text("name").notNull(),
  priceInr: integer("price_inr").notNull(),
  ...timestamps,
});
export const warehouses = pgTable("warehouses", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(),
  city: text("city").notNull(),
  ...timestamps,
});
export const inventory = pgTable(
  "inventory",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    productId: uuid("product_id")
      .references(() => products.id)
      .notNull(),
    warehouseId: uuid("warehouse_id")
      .references(() => warehouses.id)
      .notNull(),
    available: integer("available").notNull(),
    reserved: integer("reserved").notNull().default(0),
    version: integer("version").notNull().default(1),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("inventory_product_warehouse_uidx").on(table.productId, table.warehouseId),
  ]
);
export const orders = pgTable(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    externalId: text("external_id").notNull().unique(),
    customerId: uuid("customer_id")
      .references(() => customers.id)
      .notNull(),
    totalInr: integer("total_inr").notNull(),
    status: text("status").notNull(),
    ...timestamps,
  },
  (table) => [index("orders_customer_idx").on(table.customerId)]
);
export const orderItems = pgTable("order_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id")
    .references(() => orders.id)
    .notNull(),
  productId: uuid("product_id")
    .references(() => products.id)
    .notNull(),
  quantity: integer("quantity").notNull(),
  unitPriceInr: integer("unit_price_inr").notNull(),
  ...timestamps,
});
export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id")
    .references(() => orders.id)
    .notNull(),
  providerRef: text("provider_ref").notNull().unique(),
  amountInr: integer("amount_inr").notNull(),
  status: text("status").notNull(),
  ...timestamps,
});
export const shipments = pgTable("shipments", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id")
    .references(() => orders.id)
    .notNull(),
  trackingNumber: text("tracking_number").notNull().unique(),
  status: text("status").notNull(),
  promisedAt: timestamp("promised_at", { withTimezone: true }),
  ...timestamps,
});
export const shipmentEvents = pgTable(
  "shipment_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shipmentId: uuid("shipment_id")
      .references(() => shipments.id)
      .notNull(),
    code: text("code").notNull(),
    location: text("location"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    payload: jsonb("payload"),
    ...timestamps,
  },
  (table) => [index("shipment_events_ship_time_idx").on(table.shipmentId, table.occurredAt)]
);
export const supportTickets = pgTable(
  "support_tickets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    externalId: text("external_id").notNull().unique(),
    customerId: uuid("customer_id")
      .references(() => customers.id)
      .notNull(),
    orderId: uuid("order_id").references(() => orders.id),
    incidentType: text("incident_type").notNull(),
    urgency: text("urgency").notNull(),
    status: ticketStatus("status").notNull().default("open"),
    slaDueAt: timestamp("sla_due_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => [index("tickets_status_sla_idx").on(table.status, table.slaDueAt)]
);
export const ticketMessages = pgTable("ticket_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  ticketId: uuid("ticket_id")
    .references(() => supportTickets.id)
    .notNull(),
  authorType: text("author_type").notNull(),
  body: text("body").notNull(),
  ...timestamps,
});
export const policies = pgTable("policies", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(),
  title: text("title").notNull(),
  active: boolean("active").notNull().default(true),
  ...timestamps,
});
export const policyVersions = pgTable(
  "policy_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    policyId: uuid("policy_id")
      .references(() => policies.id)
      .notNull(),
    version: text("version").notNull(),
    content: text("content").notNull(),
    effectiveAt: timestamp("effective_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("policy_version_uidx").on(table.policyId, table.version)]
);
export const policyRules = pgTable("policy_rules", {
  id: uuid("id").defaultRandom().primaryKey(),
  policyVersionId: uuid("policy_version_id")
    .references(() => policyVersions.id)
    .notNull(),
  clause: text("clause").notNull(),
  condition: jsonb("condition").notNull(),
  effect: jsonb("effect").notNull(),
  ...timestamps,
});
export const agentRuns = pgTable("agent_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  ticketId: uuid("ticket_id")
    .references(() => supportTickets.id)
    .notNull(),
  status: runStatus("status").notNull(),
  controllerVersion: text("controller_version").notNull(),
  modelVersion: text("model_version").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  ...timestamps,
});
export const agentPlans = pgTable("agent_plans", {
  id: uuid("id").defaultRandom().primaryKey(),
  runId: uuid("run_id")
    .references(() => agentRuns.id)
    .notNull(),
  objective: text("objective").notNull(),
  steps: jsonb("steps").notNull(),
  ...timestamps,
});
export const evidenceItems = pgTable(
  "evidence_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id")
      .references(() => agentRuns.id)
      .notNull(),
    evidenceKey: text("evidence_key").notNull(),
    sourceType: text("source_type").notNull(),
    sourceRef: text("source_ref").notNull(),
    claim: text("claim").notNull(),
    value: jsonb("value").notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("evidence_run_key_uidx").on(table.runId, table.evidenceKey)]
);
export const candidateActions = pgTable("candidate_actions", {
  id: uuid("id").defaultRandom().primaryKey(),
  runId: uuid("run_id")
    .references(() => agentRuns.id)
    .notNull(),
  candidateKey: text("candidate_key").notNull(),
  action: text("action").notNull(),
  valid: boolean("valid").notNull(),
  utility: numeric("utility", { precision: 6, scale: 5 }).notNull(),
  rejectionReasons: jsonb("rejection_reasons").notNull(),
  ...timestamps,
});
export const factorContributions = pgTable("factor_contributions", {
  id: uuid("id").defaultRandom().primaryKey(),
  candidateId: uuid("candidate_id")
    .references(() => candidateActions.id)
    .notNull(),
  factor: text("factor").notNull(),
  value: numeric("value", { precision: 8, scale: 5 }).notNull(),
  weight: numeric("weight", { precision: 8, scale: 5 }).notNull(),
  contribution: numeric("contribution", { precision: 8, scale: 5 }).notNull(),
  evidenceIds: jsonb("evidence_ids").notNull(),
  ...timestamps,
});
export const policyChecks = pgTable("policy_checks", {
  id: uuid("id").defaultRandom().primaryKey(),
  candidateId: uuid("candidate_id")
    .references(() => candidateActions.id)
    .notNull(),
  policyRuleId: uuid("policy_rule_id").references(() => policyRules.id),
  passed: boolean("passed").notNull(),
  detail: text("detail").notNull(),
  ...timestamps,
});
export const decisions = pgTable("decisions", {
  id: uuid("id").defaultRandom().primaryKey(),
  runId: uuid("run_id")
    .references(() => agentRuns.id)
    .notNull()
    .unique(),
  selectedCandidateId: uuid("selected_candidate_id")
    .references(() => candidateActions.id)
    .notNull(),
  confidence: numeric("confidence", { precision: 5, scale: 4 }).notNull(),
  summary: text("summary").notNull(),
  scoringVersion: text("scoring_version").notNull(),
  ...timestamps,
});
export const toolCalls = pgTable(
  "tool_calls",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    runId: uuid("run_id")
      .references(() => agentRuns.id)
      .notNull(),
    toolCallKey: text("tool_call_key").notNull(),
    toolName: text("tool_name").notNull(),
    input: jsonb("input").notNull(),
    status: text("status").notNull(),
    latencyMs: integer("latency_ms").notNull(),
    idempotencyKey: text("idempotency_key"),
    ...timestamps,
  },
  (table) => [uniqueIndex("tool_call_key_uidx").on(table.runId, table.toolCallKey)]
);
export const toolResults = pgTable("tool_results", {
  id: uuid("id").defaultRandom().primaryKey(),
  toolCallId: uuid("tool_call_id")
    .references(() => toolCalls.id)
    .notNull()
    .unique(),
  output: jsonb("output").notNull(),
  errorCode: text("error_code"),
  ...timestamps,
});
export const executionAttempts = pgTable("execution_attempts", {
  id: uuid("id").defaultRandom().primaryKey(),
  toolCallId: uuid("tool_call_id")
    .references(() => toolCalls.id)
    .notNull(),
  attempt: integer("attempt").notNull(),
  status: text("status").notNull(),
  errorCode: text("error_code"),
  ...timestamps,
});
export const verificationResults = pgTable("verification_results", {
  id: uuid("id").defaultRandom().primaryKey(),
  runId: uuid("run_id")
    .references(() => agentRuns.id)
    .notNull(),
  toolCallId: uuid("tool_call_id").references(() => toolCalls.id),
  check: text("check").notNull(),
  passed: boolean("passed").notNull(),
  detail: text("detail").notNull(),
  ...timestamps,
});
export const counterfactualRuns = pgTable("counterfactual_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  decisionId: uuid("decision_id")
    .references(() => decisions.id)
    .notNull(),
  modifiedInputs: jsonb("modified_inputs").notNull(),
  result: jsonb("result").notNull(),
  ...timestamps,
});
export const humanApprovals = pgTable("human_approvals", {
  id: uuid("id").defaultRandom().primaryKey(),
  runId: uuid("run_id")
    .references(() => agentRuns.id)
    .notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull(),
  operatorId: uuid("operator_id").references(() => users.id),
  operatorNote: text("operator_note"),
  ...timestamps,
});
export const customerMessages = pgTable("customer_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  ticketId: uuid("ticket_id")
    .references(() => supportTickets.id)
    .notNull(),
  body: text("body").notNull(),
  deliveryStatus: text("delivery_status").notNull(),
  ...timestamps,
});
export const refunds = pgTable("refunds", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id")
    .references(() => orders.id)
    .notNull(),
  ticketId: uuid("ticket_id")
    .references(() => supportTickets.id)
    .notNull(),
  amountInr: integer("amount_inr").notNull(),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  status: text("status").notNull(),
  ...timestamps,
});
export const replacementOrders = pgTable("replacement_orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id")
    .references(() => orders.id)
    .notNull(),
  ticketId: uuid("ticket_id")
    .references(() => supportTickets.id)
    .notNull(),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  status: text("status").notNull(),
  ...timestamps,
});
export const coupons = pgTable("coupons", {
  id: uuid("id").defaultRandom().primaryKey(),
  ticketId: uuid("ticket_id")
    .references(() => supportTickets.id)
    .notNull(),
  code: text("code").notNull().unique(),
  amountInr: integer("amount_inr").notNull(),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  ...timestamps,
});
export const courierInvestigations = pgTable("courier_investigations", {
  id: uuid("id").defaultRandom().primaryKey(),
  shipmentId: uuid("shipment_id")
    .references(() => shipments.id)
    .notNull(),
  ticketId: uuid("ticket_id")
    .references(() => supportTickets.id)
    .notNull(),
  status: text("status").notNull(),
  ...timestamps,
});
export const operationalBudgets = pgTable("operational_budgets", {
  id: uuid("id").defaultRandom().primaryKey(),
  date: timestamp("date", { withTimezone: true }).notNull(),
  limitInr: integer("limit_inr").notNull(),
  consumedInr: integer("consumed_inr").notNull().default(0),
  version: integer("version").notNull().default(1),
  ...timestamps,
});
export const batchOptimizationRuns = pgTable("batch_optimization_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  objective: text("objective").notNull(),
  constraints: jsonb("constraints").notNull(),
  score: numeric("score", { precision: 10, scale: 4 }).notNull(),
  status: text("status").notNull(),
  ...timestamps,
});
export const batchActionAllocations = pgTable(
  "batch_action_allocations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    batchRunId: uuid("batch_run_id")
      .references(() => batchOptimizationRuns.id)
      .notNull(),
    ticketId: uuid("ticket_id")
      .references(() => supportTickets.id)
      .notNull(),
    action: text("action").notNull(),
    costInr: integer("cost_inr").notNull(),
    utility: numeric("utility", { precision: 8, scale: 5 }).notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("batch_ticket_uidx").on(table.batchRunId, table.ticketId)]
);
export const evaluationCases = pgTable("evaluation_cases", {
  id: uuid("id").defaultRandom().primaryKey(),
  caseKey: text("case_key").notNull().unique(),
  input: jsonb("input").notNull(),
  expected: jsonb("expected").notNull(),
  ...timestamps,
});
export const evaluationResults = pgTable("evaluation_results", {
  id: uuid("id").defaultRandom().primaryKey(),
  caseId: uuid("case_id")
    .references(() => evaluationCases.id)
    .notNull(),
  metrics: jsonb("metrics").notNull(),
  passed: boolean("passed").notNull(),
  ...timestamps,
});
export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorType: text("actor_type").notNull(),
    actorId: text("actor_id").notNull(),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    payload: jsonb("payload").notNull(),
    hash: text("hash").notNull(),
    ...timestamps,
  },
  (table) => [index("audit_entity_idx").on(table.entityType, table.entityId)]
);
