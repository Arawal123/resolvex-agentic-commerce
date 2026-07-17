import type { ToolName } from "@/lib/tools/registry";
import type { ActionType, IncidentType, MissingCaseField } from "@/lib/types";

interface ActionExecutionContract {
  writeTools: ToolName[];
  verificationTools: ToolName[];
}

export interface IncidentPlaybook {
  label: string;
  requiredEvidence: MissingCaseField[];
  candidates: ActionType[];
  readTools: ToolName[];
  applicablePolicies: string[];
  primaryPolicy: string;
  executionHandlers: Partial<Record<ActionType, ActionExecutionContract>>;
}

const baseReads: ToolName[] = ["getCustomerProfile", "getOrderDetails", "retrieveRelevantPolicies"];

const actionContracts: Record<ActionType, ActionExecutionContract> = {
  PRIORITY_REPLACEMENT: {
    writeTools: [
      "createReplacementOrder",
      "reserveInventory",
      "createCoupon",
      "notifyWarehouse",
      "sendCustomerMessage",
      "resolveTicket",
    ],
    verificationTools: [
      "verifyReplacement",
      "verifyInventoryReservation",
      "verifyCoupon",
      "verifyCustomerNotification",
      "verifyTicketState",
    ],
  },
  STANDARD_REPLACEMENT: {
    writeTools: [
      "createReplacementOrder",
      "reserveInventory",
      "notifyWarehouse",
      "sendCustomerMessage",
      "resolveTicket",
    ],
    verificationTools: [
      "verifyReplacement",
      "verifyInventoryReservation",
      "verifyCustomerNotification",
      "verifyTicketState",
    ],
  },
  FULL_REFUND: {
    writeTools: ["issueRefund", "sendCustomerMessage", "resolveTicket"],
    verificationTools: ["verifyRefund", "verifyCustomerNotification", "verifyTicketState"],
  },
  PARTIAL_REFUND: {
    writeTools: ["issuePartialRefund", "sendCustomerMessage", "resolveTicket"],
    verificationTools: ["verifyRefund", "verifyCustomerNotification", "verifyTicketState"],
  },
  COUPON_COMPENSATION: {
    writeTools: ["createCoupon", "sendCustomerMessage", "resolveTicket"],
    verificationTools: ["verifyCoupon", "verifyCustomerNotification", "verifyTicketState"],
  },
  COURIER_INVESTIGATION: {
    writeTools: ["openCourierInvestigation", "scheduleFollowUp"],
    verificationTools: ["verifyCourierInvestigation", "verifyFollowUp"],
  },
  WAIT_AND_MONITOR: {
    writeTools: ["scheduleFollowUp"],
    verificationTools: ["verifyFollowUp"],
  },
  HUMAN_ESCALATION: {
    writeTools: ["escalateToHuman"],
    verificationTools: [],
  },
};

function definePlaybook(
  definition: Omit<IncidentPlaybook, "executionHandlers" | "applicablePolicies"> & {
    applicablePolicies?: string[];
  }
): IncidentPlaybook {
  return {
    ...definition,
    applicablePolicies: definition.applicablePolicies ?? [definition.primaryPolicy],
    executionHandlers: Object.fromEntries(
      definition.candidates.map((candidate) => [candidate, actionContracts[candidate]])
    ),
  };
}

export const incidentPlaybooks: Record<IncidentType, IncidentPlaybook> = {
  DELAYED_DELIVERY: definePlaybook({
    label: "Delayed delivery recovery",
    requiredEvidence: ["trackingStatus", "inactiveDays", "inventory", "orderValue"],
    candidates: [
      "PRIORITY_REPLACEMENT",
      "STANDARD_REPLACEMENT",
      "FULL_REFUND",
      "PARTIAL_REFUND",
      "WAIT_AND_MONITOR",
      "COURIER_INVESTIGATION",
      "HUMAN_ESCALATION",
    ],
    readTools: [...baseReads, "getTrackingHistory", "checkInventory", "getShippingOptions"],
    primaryPolicy: "P-02 §4.2",
  }),
  DAMAGED_PRODUCT: definePlaybook({
    label: "Damaged goods resolution",
    requiredEvidence: ["itemCondition", "withinReturnWindow", "inventory", "orderValue"],
    candidates: ["STANDARD_REPLACEMENT", "FULL_REFUND", "PARTIAL_REFUND", "HUMAN_ESCALATION"],
    readTools: [...baseReads, "checkInventory", "getPaymentStatus"],
    primaryPolicy: "P-08 §3.3",
  }),
  WRONG_PRODUCT: definePlaybook({
    label: "Wrong item correction",
    requiredEvidence: ["itemCondition", "withinReturnWindow", "inventory", "orderValue"],
    candidates: ["STANDARD_REPLACEMENT", "FULL_REFUND", "PARTIAL_REFUND", "HUMAN_ESCALATION"],
    readTools: [...baseReads, "checkInventory", "getPaymentStatus"],
    primaryPolicy: "P-08 §3.6",
  }),
  RETURN_REQUEST: definePlaybook({
    label: "Return eligibility review",
    requiredEvidence: ["itemCondition", "withinReturnWindow", "paymentStatus", "orderValue"],
    candidates: ["FULL_REFUND", "PARTIAL_REFUND", "HUMAN_ESCALATION"],
    readTools: [...baseReads, "getPaymentStatus", "getCustomerCaseHistory"],
    primaryPolicy: "P-09 §2.2",
  }),
  LOST_SHIPMENT: definePlaybook({
    label: "Lost shipment recovery",
    requiredEvidence: ["trackingStatus", "inactiveDays", "inventory", "orderValue"],
    candidates: [
      "PRIORITY_REPLACEMENT",
      "STANDARD_REPLACEMENT",
      "FULL_REFUND",
      "COURIER_INVESTIGATION",
      "HUMAN_ESCALATION",
    ],
    readTools: [...baseReads, "getTrackingHistory", "checkInventory", "getShippingOptions"],
    primaryPolicy: "P-02 §5.1",
  }),
  OUT_OF_STOCK: definePlaybook({
    label: "Inventory failure recovery",
    requiredEvidence: ["inventory", "orderValue"],
    candidates: ["FULL_REFUND", "COUPON_COMPENSATION", "WAIT_AND_MONITOR", "HUMAN_ESCALATION"],
    readTools: [...baseReads, "checkInventory", "getPaymentStatus"],
    primaryPolicy: "P-06 §1.4",
  }),
  DUPLICATE_CHARGE: definePlaybook({
    label: "Duplicate payment reversal",
    requiredEvidence: ["duplicateChargeVerified", "paymentStatus", "orderValue"],
    candidates: ["FULL_REFUND", "HUMAN_ESCALATION"],
    readTools: [...baseReads, "getPaymentStatus", "getCustomerCaseHistory"],
    primaryPolicy: "P-11 §1.2",
  }),
  DELIVERY_FAILURE: definePlaybook({
    label: "Failed delivery recovery",
    requiredEvidence: ["trackingStatus", "inactiveDays", "inventory", "orderValue"],
    candidates: [
      "COURIER_INVESTIGATION",
      "STANDARD_REPLACEMENT",
      "WAIT_AND_MONITOR",
      "COUPON_COMPENSATION",
      "HUMAN_ESCALATION",
    ],
    readTools: [...baseReads, "getTrackingHistory", "checkInventory", "getShippingOptions"],
    primaryPolicy: "P-02 §6.2",
  }),
  UNSUPPORTED_REQUEST: definePlaybook({
    label: "Unsupported request containment",
    requiredEvidence: ["orderValue"],
    candidates: ["HUMAN_ESCALATION"],
    readTools: baseReads,
    primaryPolicy: "P-01 §1.1",
  }),
};

export function getPlaybook(incident: IncidentType) {
  return incidentPlaybooks[incident];
}
