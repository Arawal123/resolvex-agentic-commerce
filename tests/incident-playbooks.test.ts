import { beforeEach, describe, expect, it, vi } from "vitest";
import { runAgent } from "@/lib/agent/controller";
import { incidentPlaybooks } from "@/lib/agent/playbooks";
import { createManualDraft } from "@/lib/intake/schema";
import { createManualTicket, resetManualTickets } from "@/lib/tickets/repository";
import { resetSandboxState } from "@/lib/tools/registry";
import type { IncidentType, ManualCaseDraft } from "@/lib/types";

function draftFor(incident: IncidentType): ManualCaseDraft {
  const requestedOutcome =
    incident === "DUPLICATE_CHARGE" || incident === "RETURN_REQUEST" ? "refund" : "product";
  return {
    ...createManualDraft(
      `A complete reviewed commerce case for ${incident.toLowerCase().replaceAll("_", " ")}.`,
      { customerName: "Test Operator" }
    ),
    subject: `${incident.replaceAll("_", " ")} case`,
    incident,
    urgency: "high",
    requestedOutcome,
    orderValue: incident === "DUPLICATE_CHARGE" ? 12_450 : 2_400,
    inventory: 5,
    inactiveDays: 8,
    trackingStatus: "No successful fulfillment scan",
    operationalFacts: {
      paymentStatus: "captured",
      duplicateChargeVerified: incident === "DUPLICATE_CHARGE" ? true : null,
      itemCondition:
        incident === "DAMAGED_PRODUCT"
          ? "damaged"
          : incident === "WRONG_PRODUCT"
            ? "wrong_item"
            : "normal",
      withinReturnWindow: ["DAMAGED_PRODUCT", "WRONG_PRODUCT", "RETURN_REQUEST"].includes(incident)
        ? true
        : null,
      deliveryAttempts: 1,
    },
  };
}

describe("incident playbooks", () => {
  beforeEach(() => {
    vi.stubEnv("DATABASE_URL", "");
    resetManualTickets();
    resetSandboxState();
  });

  it("defines evidence, policy, execution, and verification contracts for the complete taxonomy", () => {
    expect(Object.keys(incidentPlaybooks)).toHaveLength(9);
    for (const playbook of Object.values(incidentPlaybooks)) {
      expect(playbook.requiredEvidence.length).toBeGreaterThan(0);
      expect(playbook.applicablePolicies.length).toBeGreaterThan(0);
      for (const action of playbook.candidates) {
        expect(playbook.executionHandlers[action]?.writeTools.length).toBeGreaterThan(0);
        expect(playbook.executionHandlers[action]?.verificationTools).toBeDefined();
      }
    }
  });

  it("runs delayed delivery through a replacement and verifies every write", async () => {
    const ticket = await createManualTicket(draftFor("DELAYED_DELIVERY"));
    const events: string[] = [];
    const record = await runAgent(ticket.id, (event) => {
      events.push(event.type);
    });
    expect(record.finalAction).toMatch(/REPLACEMENT/);
    expect(record.verification.every((check) => check.passed)).toBe(true);
    expect(events).toEqual(expect.arrayContaining(["phase", "tool", "verification", "complete"]));
  });

  it("holds a verified ₹12,450 duplicate charge at approval without refund execution", async () => {
    const ticket = await createManualTicket(draftFor("DUPLICATE_CHARGE"));
    const record = await runAgent(ticket.id);
    expect(record.finalAction).toBe("FULL_REFUND");
    expect(record.approvalStatus).toBe("pending");
    expect(record.toolCalls.some((call) => call.name === "issueRefund")).toBe(false);
    expect(record.toolCalls.some((call) => call.name === "escalateToHuman")).toBe(true);
  });

  it("contains unsupported requests in human escalation with no consequential commerce write", async () => {
    const ticket = await createManualTicket(draftFor("UNSUPPORTED_REQUEST"));
    const record = await runAgent(ticket.id);
    expect(record.finalAction).toBe("HUMAN_ESCALATION");
    expect(record.approvalStatus).toBe("pending");
    expect(
      record.toolCalls.filter((call) => call.phase === "ACT").map((call) => call.name)
    ).toEqual(["escalateToHuman"]);
  });
});
