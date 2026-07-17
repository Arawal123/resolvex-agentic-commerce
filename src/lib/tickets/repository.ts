import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { caseIntakes, caseOperationalFacts } from "@/lib/db/schema";
import { tickets as seededTickets } from "@/lib/demo-data";
import { assertCompleteDraft } from "@/lib/intake/schema";
import type { ManualCaseDraft, Ticket } from "@/lib/types";

interface ParseMetadata {
  provider: "gemini" | "manual";
  model: string;
  confidence: number;
  warnings: string[];
}

const ticketGlobal = globalThis as typeof globalThis & {
  resolveXTicketMemory?: Map<string, Ticket>;
};
const memoryTickets = ticketGlobal.resolveXTicketMemory ?? new Map<string, Ticket>();
ticketGlobal.resolveXTicketMemory = memoryTickets;
for (const ticket of seededTickets) {
  if (!memoryTickets.has(ticket.id)) memoryTickets.set(ticket.id, { ...ticket, source: "seed" });
}

function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

function parseStoredTicket(value: unknown): Ticket | null {
  if (!value || typeof value !== "object") return null;
  const ticket = value as Ticket;
  return typeof ticket.id === "string" && typeof ticket.message === "string" ? ticket : null;
}

async function loadDatabaseTickets() {
  if (!hasDatabase()) return [];
  const rows = await getDb()
    .select({ payload: caseOperationalFacts.ticketPayload })
    .from(caseOperationalFacts)
    .orderBy(desc(caseOperationalFacts.createdAt));
  return rows.map((row) => parseStoredTicket(row.payload)).filter((item): item is Ticket => !!item);
}

export async function listTickets() {
  const databaseTickets = await loadDatabaseTickets();
  const merged = new Map(memoryTickets);
  for (const ticket of databaseTickets) merged.set(ticket.id, ticket);
  return [...merged.values()];
}

export async function getTicket(ticketId: string) {
  const memory = memoryTickets.get(ticketId);
  if (memory) return memory;
  if (!hasDatabase()) return null;
  const [row] = await getDb()
    .select({ payload: caseOperationalFacts.ticketPayload })
    .from(caseOperationalFacts)
    .where(eq(caseOperationalFacts.externalTicketId, ticketId))
    .limit(1);
  const ticket = parseStoredTicket(row?.payload);
  if (ticket) memoryTickets.set(ticket.id, ticket);
  return ticket;
}

export async function getTicketByOrderId(orderId: string) {
  return (await listTickets()).find((ticket) => ticket.orderId === orderId) ?? null;
}

export async function getTicketByCustomerId(customerId: string) {
  return (await listTickets()).find((ticket) => ticket.customerId === customerId) ?? null;
}

function nextExternalId(prefix: "TKT" | "ORD" | "CUS") {
  return `${prefix}-M${Date.now().toString(36).toUpperCase()}${randomUUID().slice(0, 4).toUpperCase()}`;
}

function derivePriority(draft: ManualCaseDraft) {
  const urgency = { critical: 0.96, high: 0.84, medium: 0.62, low: 0.38 }[draft.urgency];
  const incidentBoost = draft.incident === "DUPLICATE_CHARGE" ? 0.05 : 0;
  return Math.min(0.99, urgency + incidentBoost);
}

export async function createManualTicket(
  rawDraft: ManualCaseDraft,
  parseMetadata: ParseMetadata = {
    provider: "manual",
    model: "manual-entry",
    confidence: 1,
    warnings: [],
  }
) {
  const draft = assertCompleteDraft(rawDraft);
  const ticketId = nextExternalId("TKT");
  const orderId = draft.orderId || nextExternalId("ORD");
  const customerId = draft.customerId || nextExternalId("CUS");
  const ticket: Ticket = {
    id: ticketId,
    orderId,
    customerId,
    customerName: draft.customerName,
    subject: draft.subject,
    message: draft.rawMessage,
    incident: draft.incident!,
    urgency: draft.urgency,
    status: "open",
    slaHours: draft.slaHours ?? 24,
    orderValue: draft.orderValue!,
    inventory: draft.inventory ?? 0,
    inactiveDays: draft.inactiveDays ?? 0,
    requestedOutcome: draft.requestedOutcome,
    priority: derivePriority(draft),
    churnRisk: Math.min(0.95, derivePriority(draft) * 0.82),
    trackingStatus: draft.trackingStatus ?? "No shipment state supplied",
    source: "manual",
    parseConfidence: parseMetadata.confidence,
    operationalFacts: draft.operationalFacts,
  };

  if (hasDatabase()) {
    const intakeId = randomUUID();
    await getDb().batch([
      getDb().insert(caseIntakes).values({
        id: intakeId,
        externalTicketId: ticket.id,
        rawInput: draft.rawMessage,
        provider: parseMetadata.provider,
        model: parseMetadata.model,
        confidence: parseMetadata.confidence.toString(),
        missingFields: [],
        extractedDraft: draft,
        parseMetadata,
      }),
      getDb().insert(caseOperationalFacts).values({
        intakeId,
        externalTicketId: ticket.id,
        ticketPayload: ticket,
      }),
    ]);
  }
  memoryTickets.set(ticket.id, ticket);
  return ticket;
}

export function resetManualTickets() {
  for (const [id, ticket] of memoryTickets)
    if (ticket.source === "manual") memoryTickets.delete(id);
}
