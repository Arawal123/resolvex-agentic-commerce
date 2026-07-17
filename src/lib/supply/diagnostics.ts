import type {
  IncidentType,
  RootCauseAnalysis,
  RootCauseHypothesis,
  SupplyAction,
  SupplyCandidate,
  SupplyCounterfactualResult,
  SupplyMetric,
  SupplyStage,
  SupplyTrace,
  SupplyTraceStage,
  Ticket,
} from "@/lib/types";

export const supplyStages: SupplyStage[] = [
  "PAYMENT",
  "INVENTORY_PROMISE",
  "WAREHOUSE_PICK",
  "PACKING",
  "CARRIER_HANDOFF",
  "LINE_HAUL",
  "LAST_MILE",
  "CUSTOMER_OR_RETURN",
];

const stageLabels: Record<SupplyStage, string> = {
  PAYMENT: "Payment",
  INVENTORY_PROMISE: "Inventory promise",
  WAREHOUSE_PICK: "Warehouse pick",
  PACKING: "Packing",
  CARRIER_HANDOFF: "Carrier handoff",
  LINE_HAUL: "Line haul",
  LAST_MILE: "Last mile",
  CUSTOMER_OR_RETURN: "Customer / return",
};

const primaryStageByIncident: Record<IncidentType, SupplyStage | null> = {
  DELAYED_DELIVERY: "LINE_HAUL",
  DAMAGED_PRODUCT: "PACKING",
  WRONG_PRODUCT: "WAREHOUSE_PICK",
  RETURN_REQUEST: "CUSTOMER_OR_RETURN",
  LOST_SHIPMENT: "CARRIER_HANDOFF",
  OUT_OF_STOCK: "INVENTORY_PROMISE",
  DUPLICATE_CHARGE: "PAYMENT",
  DELIVERY_FAILURE: "LAST_MILE",
  UNSUPPORTED_REQUEST: null,
};

function round(value: number, places = 3) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function metric(
  id: string,
  key: string,
  label: string,
  stage: SupplyStage,
  observed: number,
  expected: number,
  unit: string,
  source: string,
  unknown = false
): SupplyMetric {
  const deviation = round(observed - expected, 2);
  const ratio = expected === 0 ? observed : deviation / Math.max(Math.abs(expected), 1);
  return {
    id,
    key,
    label,
    stage,
    observed,
    expected,
    unit,
    deviation,
    status: unknown ? "unknown" : ratio > 0.5 ? "failed" : ratio > 0 ? "warning" : "healthy",
    source,
    evidenceId: `E-S${id.slice(2)}`,
  };
}

export function buildSupplyTrace(ticket: Ticket): SupplyTrace {
  const unknown = ticket.incident === "UNSUPPORTED_REQUEST";
  const is = (incident: IncidentType) => ticket.incident === incident;
  const duplicate =
    ticket.operationalFacts?.duplicateChargeVerified === true || is("DUPLICATE_CHARGE");
  const deliveryAttempts = ticket.operationalFacts?.deliveryAttempts ?? 0;
  const returnIneligible =
    is("RETURN_REQUEST") && ticket.operationalFacts?.withinReturnWindow === false ? 1 : 0;

  const metrics: SupplyMetric[] = [
    metric(
      "SM-01",
      "paymentCaptureCount",
      "Payment captures",
      "PAYMENT",
      is("DUPLICATE_CHARGE") && duplicate ? 2 : 1,
      1,
      "captures",
      "Sandbox payment ledger",
      unknown
    ),
    metric(
      "SM-02",
      "inventoryPromiseGap",
      "Promised minus sellable units",
      "INVENTORY_PROMISE",
      is("OUT_OF_STOCK") ? 1 : 0,
      0,
      "units",
      "Sandbox inventory snapshot",
      unknown
    ),
    metric(
      "SM-03",
      "pickMismatchCount",
      "Pick / order mismatches",
      "WAREHOUSE_PICK",
      is("WRONG_PRODUCT") ? 1 : 0,
      0,
      "mismatches",
      "Sandbox WMS scan pair",
      unknown
    ),
    metric(
      "SM-04",
      "packageDefectCount",
      "Packaging integrity defects",
      "PACKING",
      is("DAMAGED_PRODUCT") ? 1 : 0,
      0,
      "defects",
      "Sandbox pack-station QA",
      unknown
    ),
    metric(
      "SM-05",
      "custodyScanGap",
      "Missing custody scans",
      "CARRIER_HANDOFF",
      is("LOST_SHIPMENT") ? 1 : 0,
      0,
      "scans",
      "Sandbox carrier event stream",
      unknown
    ),
    metric(
      "SM-06",
      "hubDwellHours",
      "Hub dwell",
      "LINE_HAUL",
      is("DELAYED_DELIVERY") ? Math.max(ticket.inactiveDays * 24, 49) : 18,
      48,
      "hours",
      "Sandbox tracking history",
      unknown
    ),
    metric(
      "SM-07",
      "lastMileAttempts",
      "Last-mile attempts",
      "LAST_MILE",
      is("DELIVERY_FAILURE") ? Math.max(deliveryAttempts, 3) : Math.min(deliveryAttempts, 1),
      2,
      "attempts",
      "Sandbox delivery scan stream",
      unknown
    ),
    metric(
      "SM-08",
      "returnEligibilityGap",
      "Return eligibility exceptions",
      "CUSTOMER_OR_RETURN",
      returnIneligible,
      0,
      "exceptions",
      "Sandbox returns policy snapshot",
      unknown
    ),
  ];

  const stages: SupplyTraceStage[] = supplyStages.map((stage) => {
    const stageMetrics = metrics.filter((item) => item.stage === stage);
    const status: SupplyMetric["status"] = stageMetrics.some((item) => item.status === "failed")
      ? "failed"
      : stageMetrics.some((item) => item.status === "warning")
        ? "warning"
        : stageMetrics.every((item) => item.status === "unknown")
          ? "unknown"
          : "healthy";
    return {
      stage,
      label: stageLabels[stage],
      status,
      metricIds: stageMetrics.map((item) => item.id),
    };
  });

  const primary = primaryStageByIncident[ticket.incident];
  const primaryIndex = primary ? supplyStages.indexOf(primary) : supplyStages.length - 1;
  return {
    source: "deterministic_sandbox",
    stages,
    metrics,
    causalPath: supplyStages.slice(0, primaryIndex + 1),
    generatedAt: new Date(0).toISOString(),
  };
}

function hypothesisLabel(stage: SupplyStage, ticket: Ticket, noFault: boolean) {
  if (stage === "CUSTOMER_OR_RETURN" && noFault) return "No supply fault detected";
  const labels: Record<SupplyStage, string> = {
    PAYMENT: "Payment idempotency failure",
    INVENTORY_PROMISE: "Inventory promise discrepancy",
    WAREHOUSE_PICK: "Warehouse pick mismatch",
    PACKING: "Packaging or handling failure",
    CARRIER_HANDOFF: "Carrier custody handoff failure",
    LINE_HAUL: "Line-haul hub dwell breach",
    LAST_MILE: "Last-mile delivery failure",
    CUSTOMER_OR_RETURN:
      ticket.incident === "RETURN_REQUEST"
        ? "Returns-process exception"
        : "Customer / return boundary",
  };
  return labels[stage];
}

export function analyzeSupplyTrace(ticket: Ticket, trace: SupplyTrace): RootCauseAnalysis {
  if (ticket.incident === "UNSUPPORTED_REQUEST") {
    const hypotheses = supplyStages.map((stage, index) => ({
      id: `RC-${String(index + 1).padStart(2, "0")}`,
      stage,
      label: hypothesisLabel(stage, ticket, false),
      probability: 0.125,
      rawScore: 1,
      decisiveMetricIds: [],
      contradictoryMetricIds: [],
      explanation:
        "The request is outside the supported commerce taxonomy; no stage has decisive telemetry.",
    }));
    return {
      attribution: "inconclusive",
      primaryCause: hypotheses[0],
      hypotheses,
      confidence: 0.125,
      leadOverSecond: 0,
      decisiveFactors: [],
      contradictoryEvidence: [],
      missingEvidence: [
        "A supported incident classification",
        "Incident-specific operational telemetry",
      ],
      counterfactual: null,
    };
  }

  const incidentPrimary = primaryStageByIncident[ticket.incident];
  const failedMetrics = trace.metrics.filter((item) => item.status === "failed");
  const warningMetrics = trace.metrics.filter((item) => item.status === "warning");
  const allHealthy = failedMetrics.length === 0 && warningMetrics.length === 0;
  const noFault = allHealthy;
  const scores = supplyStages.map((stage) => {
    const stageMetrics = trace.metrics.filter((item) => item.stage === stage);
    const failed = stageMetrics.filter((item) => item.status === "failed");
    const warnings = stageMetrics.filter((item) => item.status === "warning");
    const healthy = stageMetrics.filter((item) => item.status === "healthy");
    let rawScore = 0.18;
    if (stage === incidentPrimary) rawScore += 1.25;
    rawScore += failed.length * 6 + warnings.length * 2;
    if (noFault && stage === "CUSTOMER_OR_RETURN") rawScore += 5.2;
    if (allHealthy && stage !== "CUSTOMER_OR_RETURN") rawScore += 0.05;
    return {
      stage,
      rawScore,
      decisiveMetricIds: [...failed, ...warnings].map((item) => item.id),
      contradictoryMetricIds: healthy.map((item) => item.id),
    };
  });
  const total = scores.reduce((sum, item) => sum + item.rawScore, 0);
  const hypotheses: RootCauseHypothesis[] = scores
    .map((item, index) => ({
      id: `RC-${String(index + 1).padStart(2, "0")}`,
      stage: item.stage,
      label: hypothesisLabel(item.stage, ticket, noFault),
      probability: round(item.rawScore / total),
      rawScore: round(item.rawScore),
      decisiveMetricIds: item.decisiveMetricIds,
      contradictoryMetricIds: item.contradictoryMetricIds,
      explanation:
        item.decisiveMetricIds.length > 0
          ? `${stageLabels[item.stage]} exceeded its deterministic sandbox threshold.`
          : `${stageLabels[item.stage]} has no breached decisive metric in this snapshot.`,
    }))
    .sort((a, b) => b.probability - a.probability || a.id.localeCompare(b.id));
  const primaryCause = hypotheses[0] ?? null;
  const second = hypotheses[1]?.probability ?? 0;
  const lead = round((primaryCause?.probability ?? 0) - second);
  const conflict =
    failedMetrics.length > 1 && new Set(failedMetrics.map((item) => item.stage)).size > 1;
  const attribution =
    !conflict && (primaryCause?.probability ?? 0) >= 0.65 && lead >= 0.2
      ? "confirmed"
      : !conflict && (primaryCause?.probability ?? 0) >= 0.45
        ? "probable"
        : "inconclusive";
  const decisive = trace.metrics.filter((item) =>
    primaryCause?.decisiveMetricIds.includes(item.id)
  );
  const counterMetric = decisive[0];

  return {
    attribution,
    primaryCause,
    hypotheses,
    confidence: primaryCause?.probability ?? 0,
    leadOverSecond: lead,
    decisiveFactors: decisive.map(
      (item) => `${item.label}: ${item.observed}${item.unit} vs ${item.expected}${item.unit}`
    ),
    contradictoryEvidence: conflict
      ? failedMetrics
          .filter((item) => item.stage !== primaryCause?.stage)
          .map((item) => `${item.label} also breached at ${item.observed}${item.unit}.`)
      : [],
    missingEvidence: trace.metrics
      .filter((item) => item.status === "unknown")
      .map((item) => `${item.label} telemetry`),
    counterfactual: counterMetric
      ? {
          metricKey: counterMetric.key,
          originalValue: counterMetric.observed,
          replacementValue: counterMetric.expected,
          statement: `If ${counterMetric.label.toLowerCase()} were ${counterMetric.expected}${counterMetric.unit} or lower, this breach would no longer support the primary cause.`,
        }
      : null,
  };
}

function actionFor(ticket: Ticket, analysis: RootCauseAnalysis): SupplyAction {
  if (analysis.attribution === "inconclusive") return "HUMAN_SUPPLY_ESCALATION";
  if (analysis.primaryCause?.label === "No supply fault detected") return "NO_SUPPLY_FAULT";
  const byStage: Record<SupplyStage, SupplyAction> = {
    PAYMENT: "PAYMENT_IDEMPOTENCY_RECONCILIATION",
    INVENTORY_PROMISE: "INVENTORY_RECONCILIATION",
    WAREHOUSE_PICK: "PICK_ACCURACY_AUDIT",
    PACKING: "PACKAGING_QUALITY_AUDIT",
    CARRIER_HANDOFF: "CARRIER_CORRECTIVE_INVESTIGATION",
    LINE_HAUL: "CARRIER_CORRECTIVE_INVESTIGATION",
    LAST_MILE: "CARRIER_CORRECTIVE_INVESTIGATION",
    CUSTOMER_OR_RETURN:
      ticket.incident === "RETURN_REQUEST" ? "RETURNS_PROCESS_REVIEW" : "HUMAN_SUPPLY_ESCALATION",
  };
  return analysis.primaryCause ? byStage[analysis.primaryCause.stage] : "HUMAN_SUPPLY_ESCALATION";
}

export const supplyActions: SupplyAction[] = [
  "CARRIER_CORRECTIVE_INVESTIGATION",
  "WAREHOUSE_QA_AUDIT",
  "PACKAGING_QUALITY_AUDIT",
  "PICK_ACCURACY_AUDIT",
  "INVENTORY_RECONCILIATION",
  "PAYMENT_IDEMPOTENCY_RECONCILIATION",
  "RETURNS_PROCESS_REVIEW",
  "NO_SUPPLY_FAULT",
  "HUMAN_SUPPLY_ESCALATION",
];

export function generateSupplyCandidates(
  ticket: Ticket,
  analysis: RootCauseAnalysis
): SupplyCandidate[] {
  const selected = actionFor(ticket, analysis);
  return supplyActions
    .map((action, index) => {
      const warehouseAlternative =
        action === "WAREHOUSE_QA_AUDIT" &&
        ["WAREHOUSE_PICK", "PACKING"].includes(analysis.primaryCause?.stage ?? "");
      const safeFallback = action === "HUMAN_SUPPLY_ESCALATION";
      const valid = action === selected || warehouseAlternative || safeFallback;
      const preferred = action === selected;
      const confidence = analysis.confidence;
      const recurrenceReduction =
        action === "NO_SUPPLY_FAULT" ? 0.9 : preferred ? 0.92 : valid ? 0.5 : 0.25;
      const operationalImpact =
        action === "HUMAN_SUPPLY_ESCALATION" ? (preferred ? 0.72 : 0.32) : preferred ? 0.86 : 0.46;
      const timeToEffect = action.includes("AUDIT")
        ? 0.62
        : action.includes("RECONCILIATION")
          ? 0.78
          : 0.84;
      const costEfficiency =
        action === "NO_SUPPLY_FAULT" ? 1 : action.includes("INVESTIGATION") ? 0.72 : 0.8;
      const policyValidity = valid ? 1 : 0;
      const utilityScore = valid
        ? round(
            recurrenceReduction * 0.28 +
              operationalImpact * 0.2 +
              timeToEffect * 0.14 +
              costEfficiency * 0.12 +
              confidence * 0.16 +
              policyValidity * 0.1
          )
        : 0;
      return {
        id: `SA-${String(index + 1).padStart(2, "0")}`,
        action,
        valid,
        utilityScore,
        recurrenceReduction,
        operationalImpact,
        timeToEffect,
        costEfficiency,
        confidence,
        policyValidity,
        rationale: preferred
          ? `${action.replaceAll("_", " ").toLowerCase()} most directly targets the highest-ranked causal stage.`
          : valid
            ? `${action.replaceAll("_", " ").toLowerCase()} is a policy-valid fallback with less direct causal fit.`
            : "Not selected because it does not target the current primary causal stage.",
        rejectionReasons: valid ? [] : ["Causal-stage mismatch"],
      };
    })
    .sort((a, b) => b.utilityScore - a.utilityScore || a.id.localeCompare(b.id));
}

export function selectSupplyCandidate(candidates: SupplyCandidate[]) {
  return candidates.find((candidate) => candidate.valid) ?? null;
}

export function runSupplyCounterfactual(
  ticket: Ticket,
  trace: SupplyTrace,
  field: string,
  value: number
): SupplyCounterfactualResult {
  const target = trace.metrics.find((item) => item.key === field);
  if (!target) throw new Error("Unknown supply metric");
  const originalAnalysis = analyzeSupplyTrace(ticket, trace);
  const modifiedMetrics = trace.metrics.map((item) =>
    item.key === field
      ? metric(
          item.id,
          item.key,
          item.label,
          item.stage,
          value,
          item.expected,
          item.unit,
          `${item.source} · intervention`
        )
      : item
  );
  const modifiedTrace: SupplyTrace = {
    ...trace,
    metrics: modifiedMetrics,
    stages: trace.stages.map((stage) => {
      const stageMetrics = modifiedMetrics.filter((item) => item.stage === stage.stage);
      return {
        ...stage,
        status: stageMetrics.some((item) => item.status === "failed")
          ? "failed"
          : stageMetrics.some((item) => item.status === "warning")
            ? "warning"
            : "healthy",
      };
    }),
  };
  const modifiedAnalysis = analyzeSupplyTrace(ticket, modifiedTrace);
  const originalAction = selectSupplyCandidate(generateSupplyCandidates(ticket, originalAnalysis))!;
  const counterfactualAction = selectSupplyCandidate(
    generateSupplyCandidates(ticket, modifiedAnalysis)
  )!;
  const originalCause = originalAnalysis.primaryCause?.label ?? null;
  const counterfactualCause = modifiedAnalysis.primaryCause?.label ?? null;
  return {
    scope: "supply",
    field,
    originalValue: target.observed,
    modifiedValue: value,
    originalCause,
    counterfactualCause,
    originalAction: originalAction.action,
    counterfactualAction: counterfactualAction.action,
    originalProbabilities: originalAnalysis.hypotheses.map(({ id, probability }) => ({
      id,
      probability,
    })),
    counterfactualProbabilities: modifiedAnalysis.hypotheses.map(({ id, probability }) => ({
      id,
      probability,
    })),
    changed:
      originalCause !== counterfactualCause ||
      originalAction.action !== counterfactualAction.action,
    explanation:
      originalCause !== counterfactualCause
        ? `Changing ${target.label.toLowerCase()} shifts the primary attribution from ${originalCause} to ${counterfactualCause}.`
        : `Changing ${target.label.toLowerCase()} does not cross the current decision boundary.`,
  };
}
