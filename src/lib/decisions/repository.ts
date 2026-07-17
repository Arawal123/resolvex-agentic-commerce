import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { caseDecisionRecords } from "@/lib/db/schema";
import { storedDecisions as seededDecisions } from "@/lib/demo-data";
import type { DecisionRecord } from "@/lib/types";

function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

const decisionGlobal = globalThis as typeof globalThis & {
  resolveXDecisionMemory?: Record<string, DecisionRecord>;
};
const storedDecisions = decisionGlobal.resolveXDecisionMemory ?? { ...seededDecisions };
decisionGlobal.resolveXDecisionMemory = storedDecisions;

function parseRecord(value: unknown): DecisionRecord | null {
  if (!value || typeof value !== "object") return null;
  const record = value as DecisionRecord;
  return typeof record.id === "string" && Array.isArray(record.toolCalls) ? record : null;
}

export async function saveDecision(record: DecisionRecord) {
  storedDecisions[record.id] = record;
  if (hasDatabase())
    await getDb()
      .insert(caseDecisionRecords)
      .values({
        externalDecisionId: record.id,
        externalTicketId: record.ticketId,
        payload: record,
      })
      .onConflictDoUpdate({
        target: caseDecisionRecords.externalDecisionId,
        set: { payload: record, updatedAt: new Date() },
      });
  return record;
}

export async function getDecision(id: string) {
  if (storedDecisions[id]) return storedDecisions[id];
  if (!hasDatabase()) return null;
  const [row] = await getDb()
    .select({ payload: caseDecisionRecords.payload })
    .from(caseDecisionRecords)
    .where(eq(caseDecisionRecords.externalDecisionId, id))
    .limit(1);
  const record = parseRecord(row?.payload);
  if (record) storedDecisions[record.id] = record;
  return record;
}
