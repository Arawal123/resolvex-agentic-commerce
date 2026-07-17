import { z } from "zod";
import type {
  IntakeParseResult,
  ManualCaseDraft,
  MissingCaseField,
  OperationalFacts,
} from "@/lib/types";

export const incidentValues = [
  "DELAYED_DELIVERY",
  "DAMAGED_PRODUCT",
  "WRONG_PRODUCT",
  "RETURN_REQUEST",
  "LOST_SHIPMENT",
  "OUT_OF_STOCK",
  "DUPLICATE_CHARGE",
  "DELIVERY_FAILURE",
  "UNSUPPORTED_REQUEST",
] as const;

export const operationalFactsSchema = z.object({
  paymentStatus: z.enum(["captured", "pending", "refunded", "failed", "unknown"]).nullable(),
  duplicateChargeVerified: z.boolean().nullable(),
  itemCondition: z.enum(["normal", "damaged", "wrong_item", "unknown"]).nullable(),
  withinReturnWindow: z.boolean().nullable(),
  deliveryAttempts: z.number().int().min(0).max(100).nullable(),
});

export const manualCaseDraftSchema = z.object({
  rawMessage: z.string().trim().min(10).max(5000),
  subject: z.string().trim().min(3).max(160),
  orderId: z.string().trim().min(2).max(80).nullable(),
  customerId: z.string().trim().min(2).max(80).nullable(),
  customerName: z.string().trim().max(120),
  incident: z.enum(incidentValues).nullable(),
  urgency: z.enum(["critical", "high", "medium", "low"]),
  requestedOutcome: z.enum(["product", "refund", "unspecified"]),
  slaHours: z.number().int().min(1).max(720).nullable(),
  orderValue: z.number().int().min(0).max(100_000_000).nullable(),
  inventory: z.number().int().min(0).max(1_000_000).nullable(),
  inactiveDays: z.number().int().min(0).max(3650).nullable(),
  trackingStatus: z.string().trim().max(240).nullable(),
  operationalFacts: operationalFactsSchema,
});

export const parseIntakeRequestSchema = z.object({
  message: z.string().trim().min(10).max(5000),
  hints: z
    .object({
      orderId: z.string().trim().max(80).optional(),
      customerId: z.string().trim().max(80).optional(),
      customerName: z.string().trim().max(120).optional(),
    })
    .optional(),
});

export const createCaseRequestSchema = z.object({
  draft: manualCaseDraftSchema,
  parseMetadata: z
    .object({
      provider: z.enum(["gemini", "manual"]),
      model: z.string().max(120),
      confidence: z.number().min(0).max(1),
      warnings: z.array(z.string().max(500)).max(20),
    })
    .optional(),
});

const deliveryIncidents = new Set(["DELAYED_DELIVERY", "LOST_SHIPMENT", "DELIVERY_FAILURE"]);
const replacementIncidents = new Set([
  "DELAYED_DELIVERY",
  "LOST_SHIPMENT",
  "DAMAGED_PRODUCT",
  "WRONG_PRODUCT",
  "OUT_OF_STOCK",
]);
const conditionIncidents = new Set(["DAMAGED_PRODUCT", "WRONG_PRODUCT", "RETURN_REQUEST"]);

export function getMissingFields(draft: ManualCaseDraft): MissingCaseField[] {
  const missing = new Set<MissingCaseField>();
  if (!draft.incident) missing.add("incident");
  if (!draft.customerName.trim()) missing.add("customerName");
  if (draft.orderValue === null) missing.add("orderValue");
  if (draft.incident && deliveryIncidents.has(draft.incident)) {
    if (draft.inactiveDays === null) missing.add("inactiveDays");
    if (!draft.trackingStatus) missing.add("trackingStatus");
  }
  if (
    draft.incident &&
    replacementIncidents.has(draft.incident) &&
    draft.requestedOutcome !== "refund" &&
    draft.inventory === null
  )
    missing.add("inventory");
  if (
    draft.requestedOutcome === "refund" ||
    draft.incident === "DUPLICATE_CHARGE" ||
    draft.incident === "RETURN_REQUEST"
  ) {
    if (!draft.operationalFacts.paymentStatus) missing.add("paymentStatus");
  }
  if (
    draft.incident === "DUPLICATE_CHARGE" &&
    draft.operationalFacts.duplicateChargeVerified === null
  )
    missing.add("duplicateChargeVerified");
  if (draft.incident && conditionIncidents.has(draft.incident)) {
    if (draft.operationalFacts.itemCondition === null) missing.add("itemCondition");
    if (draft.operationalFacts.withinReturnWindow === null) missing.add("withinReturnWindow");
  }
  return [...missing];
}

export function assertCompleteDraft(draft: ManualCaseDraft) {
  const parsed = manualCaseDraftSchema.parse(draft);
  const missingFields = getMissingFields(parsed);
  if (missingFields.length) {
    throw new z.ZodError(
      missingFields.map((field) => ({
        code: "custom",
        path: [field],
        message: `${field} is required for this incident`,
      }))
    );
  }
  return parsed;
}

const emptyFacts: OperationalFacts = {
  paymentStatus: null,
  duplicateChargeVerified: null,
  itemCondition: null,
  withinReturnWindow: null,
  deliveryAttempts: null,
};

export function createManualDraft(
  message: string,
  hints?: {
    orderId?: string;
    customerId?: string;
    customerName?: string;
  }
): ManualCaseDraft {
  return {
    rawMessage: message,
    subject: message.trim().slice(0, 96),
    orderId: hints?.orderId || null,
    customerId: hints?.customerId || null,
    customerName: hints?.customerName || "",
    incident: null,
    urgency: "medium",
    requestedOutcome: "unspecified",
    slaHours: 24,
    orderValue: null,
    inventory: null,
    inactiveDays: null,
    trackingStatus: null,
    operationalFacts: { ...emptyFacts },
  };
}

export function manualFallbackResult(
  message: string,
  hints?: {
    orderId?: string;
    customerId?: string;
    customerName?: string;
  }
): IntakeParseResult {
  const draft = createManualDraft(message, hints);
  return {
    draft,
    confidence: 0,
    missingFields: getMissingFields(draft),
    provider: "manual",
    model: "manual-entry",
    warnings: ["Gemini is not configured. Complete the structured case fields manually."],
    manualEntryAllowed: true,
  };
}

export const geminiDraftJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    rawMessage: { type: "string" },
    subject: { type: "string" },
    orderId: { type: ["string", "null"] },
    customerId: { type: ["string", "null"] },
    customerName: { type: "string" },
    incident: { type: ["string", "null"], enum: [...incidentValues, null] },
    urgency: { type: "string", enum: ["critical", "high", "medium", "low"] },
    requestedOutcome: { type: "string", enum: ["product", "refund", "unspecified"] },
    slaHours: { type: ["integer", "null"] },
    orderValue: { type: ["integer", "null"] },
    inventory: { type: ["integer", "null"] },
    inactiveDays: { type: ["integer", "null"] },
    trackingStatus: { type: ["string", "null"] },
    operationalFacts: {
      type: "object",
      additionalProperties: false,
      properties: {
        paymentStatus: {
          type: ["string", "null"],
          enum: ["captured", "pending", "refunded", "failed", "unknown", null],
        },
        duplicateChargeVerified: { type: ["boolean", "null"] },
        itemCondition: {
          type: ["string", "null"],
          enum: ["normal", "damaged", "wrong_item", "unknown", null],
        },
        withinReturnWindow: { type: ["boolean", "null"] },
        deliveryAttempts: { type: ["integer", "null"] },
      },
      required: [
        "paymentStatus",
        "duplicateChargeVerified",
        "itemCondition",
        "withinReturnWindow",
        "deliveryAttempts",
      ],
    },
  },
  required: [
    "rawMessage",
    "subject",
    "orderId",
    "customerId",
    "customerName",
    "incident",
    "urgency",
    "requestedOutcome",
    "slaHours",
    "orderValue",
    "inventory",
    "inactiveDays",
    "trackingStatus",
    "operationalFacts",
  ],
} as const;
