import { describe, expect, it } from "vitest";
import { tickets } from "@/lib/demo-data";
import {
  analyzeSupplyTrace,
  buildSupplyTrace,
  generateSupplyCandidates,
  runSupplyCounterfactual,
  selectSupplyCandidate,
} from "@/lib/supply/diagnostics";
import type { IncidentType, Ticket } from "@/lib/types";

function ticketFor(incident: IncidentType): Ticket {
  return {
    ...tickets[0],
    id: `TKT-${incident}`,
    incident,
    inventory: incident === "OUT_OF_STOCK" ? 0 : 5,
    inactiveDays: 8,
    trackingStatus: "Reviewed sandbox snapshot",
    operationalFacts: {
      paymentStatus: "captured",
      duplicateChargeVerified: incident === "DUPLICATE_CHARGE" ? true : null,
      itemCondition:
        incident === "DAMAGED_PRODUCT"
          ? "damaged"
          : incident === "WRONG_PRODUCT"
            ? "wrong_item"
            : "normal",
      withinReturnWindow: incident === "RETURN_REQUEST" ? true : null,
      deliveryAttempts: incident === "DELIVERY_FAILURE" ? 3 : 1,
    },
  };
}

const expectedStage: Partial<Record<IncidentType, string>> = {
  DELAYED_DELIVERY: "LINE_HAUL",
  LOST_SHIPMENT: "CARRIER_HANDOFF",
  DELIVERY_FAILURE: "LAST_MILE",
  DAMAGED_PRODUCT: "PACKING",
  WRONG_PRODUCT: "WAREHOUSE_PICK",
  OUT_OF_STOCK: "INVENTORY_PROMISE",
  DUPLICATE_CHARGE: "PAYMENT",
};

const expectedAction: Partial<Record<IncidentType, string>> = {
  DELAYED_DELIVERY: "CARRIER_CORRECTIVE_INVESTIGATION",
  LOST_SHIPMENT: "CARRIER_CORRECTIVE_INVESTIGATION",
  DELIVERY_FAILURE: "CARRIER_CORRECTIVE_INVESTIGATION",
  DAMAGED_PRODUCT: "PACKAGING_QUALITY_AUDIT",
  WRONG_PRODUCT: "PICK_ACCURACY_AUDIT",
  OUT_OF_STOCK: "INVENTORY_RECONCILIATION",
  DUPLICATE_CHARGE: "PAYMENT_IDEMPOTENCY_RECONCILIATION",
};

describe("deterministic supply diagnosis", () => {
  it.each(Object.entries(expectedStage))("attributes %s to %s", (incident, stage) => {
    const ticket = ticketFor(incident as IncidentType);
    const analysis = analyzeSupplyTrace(ticket, buildSupplyTrace(ticket));
    expect(analysis.primaryCause?.stage).toBe(stage);
    expect(analysis.attribution).toBe("confirmed");
    expect(analysis.hypotheses.reduce((sum, item) => sum + item.probability, 0)).toBeCloseTo(1, 2);
    expect(selectSupplyCandidate(generateSupplyCandidates(ticket, analysis))?.action).toBe(
      expectedAction[incident as IncidentType]
    );
  });

  it("reports no supply fault for an eligible ordinary return", () => {
    const ticket = ticketFor("RETURN_REQUEST");
    const trace = buildSupplyTrace(ticket);
    const analysis = analyzeSupplyTrace(ticket, trace);
    const selected = selectSupplyCandidate(generateSupplyCandidates(ticket, analysis));
    expect(analysis.primaryCause?.label).toBe("No supply fault detected");
    expect(selected?.action).toBe("NO_SUPPLY_FAULT");
  });

  it("keeps unsupported requests inconclusive and escalated", () => {
    const ticket = ticketFor("UNSUPPORTED_REQUEST");
    const analysis = analyzeSupplyTrace(ticket, buildSupplyTrace(ticket));
    const selected = selectSupplyCandidate(generateSupplyCandidates(ticket, analysis));
    expect(analysis.attribution).toBe("inconclusive");
    expect(selected?.action).toBe("HUMAN_SUPPLY_ESCALATION");
  });

  it("marks conflicting decisive metrics inconclusive", () => {
    const ticket = ticketFor("DELAYED_DELIVERY");
    const trace = buildSupplyTrace(ticket);
    trace.metrics = trace.metrics.map((item) =>
      item.key === "packageDefectCount"
        ? { ...item, observed: 1, deviation: 1, status: "failed" as const }
        : item
    );
    const analysis = analyzeSupplyTrace(ticket, trace);
    expect(analysis.attribution).toBe("inconclusive");
    expect(analysis.contradictoryEvidence.length).toBeGreaterThan(0);
  });

  it("is exactly reproducible from the same reviewed facts", () => {
    const ticket = ticketFor("WRONG_PRODUCT");
    expect(buildSupplyTrace(ticket)).toEqual(buildSupplyTrace(ticket));
    expect(analyzeSupplyTrace(ticket, buildSupplyTrace(ticket))).toEqual(
      analyzeSupplyTrace(ticket, buildSupplyTrace(ticket))
    );
  });

  it("changes attribution and remedy when the decisive breach is removed", () => {
    const ticket = ticketFor("DELAYED_DELIVERY");
    const result = runSupplyCounterfactual(ticket, buildSupplyTrace(ticket), "hubDwellHours", 48);
    expect(result.changed).toBe(true);
    expect(result.originalCause).toBe("Line-haul hub dwell breach");
    expect(result.counterfactualCause).toBe("No supply fault detected");
    expect(result.counterfactualAction).toBe("NO_SUPPLY_FAULT");
  });
});
