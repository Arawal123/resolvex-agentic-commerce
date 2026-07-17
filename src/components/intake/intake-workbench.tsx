"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BrainCircuit,
  Check,
  ChevronLeft,
  CircleAlert,
  LoaderCircle,
  LockKeyhole,
  ScanText,
  Sparkles,
} from "lucide-react";
import { getMissingFields, incidentValues } from "@/lib/intake/schema";
import type { IntakeParseResult, ManualCaseDraft, OperationalFacts } from "@/lib/types";

const labels: Record<string, string> = {
  incident: "Incident classification",
  customerName: "Customer name",
  orderValue: "Order value",
  inventory: "Available inventory",
  inactiveDays: "Inactive tracking days",
  trackingStatus: "Tracking state",
  paymentStatus: "Payment status",
  duplicateChargeVerified: "Duplicate charge confirmation",
  itemCondition: "Item condition",
  withinReturnWindow: "Return eligibility",
};

function numberValue(value: string) {
  return value === "" ? null : Number(value);
}

function booleanValue(value: string) {
  return value === "" ? null : value === "true";
}

export function IntakeWorkbench() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [hints, setHints] = useState({ orderId: "", customerId: "", customerName: "" });
  const [result, setResult] = useState<IntakeParseResult | null>(null);
  const [parsing, setParsing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const draft = result?.draft ?? null;
  const missing = useMemo(() => (draft ? getMissingFields(draft) : []), [draft]);
  const stage = result ? 2 : 1;
  const showDelivery = Boolean(
    draft?.incident &&
    ["DELAYED_DELIVERY", "LOST_SHIPMENT", "DELIVERY_FAILURE"].includes(draft.incident)
  );
  const showInventory = Boolean(
    draft?.incident &&
    [
      "DELAYED_DELIVERY",
      "LOST_SHIPMENT",
      "DAMAGED_PRODUCT",
      "WRONG_PRODUCT",
      "OUT_OF_STOCK",
    ].includes(draft.incident) &&
    draft.requestedOutcome !== "refund"
  );
  const showPayment = Boolean(
    draft &&
    (draft.requestedOutcome === "refund" ||
      ["DUPLICATE_CHARGE", "RETURN_REQUEST"].includes(draft.incident ?? ""))
  );
  const showCondition = Boolean(
    draft?.incident &&
    ["DAMAGED_PRODUCT", "WRONG_PRODUCT", "RETURN_REQUEST"].includes(draft.incident)
  );

  function updateDraft(patch: Partial<ManualCaseDraft>) {
    setResult((current) =>
      current ? { ...current, draft: { ...current.draft, ...patch } } : current
    );
  }

  function updateFacts(patch: Partial<OperationalFacts>) {
    if (!draft) return;
    updateDraft({ operationalFacts: { ...draft.operationalFacts, ...patch } });
  }

  async function parse() {
    setParsing(true);
    setError("");
    try {
      const response = await fetch("/api/intake/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, hints }),
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.message || "The intake could not be understood.");
      setResult(data.result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The intake could not be understood.");
    } finally {
      setParsing(false);
    }
  }

  async function createAndRun() {
    if (!result || missing.length) return;
    setCreating(true);
    setError("");
    try {
      const response = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draft: result.draft,
          parseMetadata: {
            provider: result.provider,
            model: result.model,
            confidence: result.confidence,
            warnings: result.warnings,
          },
        }),
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.message || "The case could not be created.");
      router.push(`/tickets/${data.ticket.id}?autorun=1`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The case could not be created.");
      setCreating(false);
    }
  }

  return (
    <div className="intake-world">
      <div className="intake-aurora" aria-hidden="true" />
      <header className="intake-header">
        <div>
          <span>MANUAL-INPUT AGENT ENGINE</span>
          <h1>{result ? "Review the facts." : "Describe the problem."}</h1>
          <p>
            {result
              ? "Only incident-required evidence is shown."
              : "Review the facts, then let the bounded engine operate."}
          </p>
        </div>
        <div className="intake-safety">
          <LockKeyhole size={16} /> NO MODEL TOOL ACCESS
        </div>
      </header>

      <div className="intake-stage-rail" aria-label="Intake progress">
        {["Describe problem", "Review extracted facts", "Live execution"].map((label, index) => {
          const step = index + 1;
          const active = step === stage;
          const complete = step < stage;
          return (
            <div key={label} className={active ? "active" : complete ? "complete" : ""}>
              <span>{complete ? <Check size={13} /> : `0${step}`}</span>
              <p>{label}</p>
              <i />
            </div>
          );
        })}
      </div>

      {!result ? (
        <main className="intake-compose">
          <section className="intake-prompt-zone">
            <div className="prompt-sigil">
              <BrainCircuit />
            </div>
            <label htmlFor="customer-problem">What happened?</label>
            <textarea
              id="customer-problem"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Describe the customer’s problem in natural language. Include any facts you already know…"
              minLength={10}
              maxLength={5000}
              autoFocus
            />
            <div className="prompt-foot">
              <span>{message.length} / 5000</span>
              <span>TEXT ONLY · NO FILE UPLOADS</span>
            </div>
          </section>
          <aside className="intake-context-strip">
            <span>OPTIONAL IDENTITY HINTS</span>
            <label>
              Order ID
              <input
                value={hints.orderId}
                onChange={(event) => setHints({ ...hints, orderId: event.target.value })}
                placeholder="ORD-…"
              />
            </label>
            <label>
              Customer ID
              <input
                value={hints.customerId}
                onChange={(event) => setHints({ ...hints, customerId: event.target.value })}
                placeholder="CUS-…"
              />
            </label>
            <label>
              Customer name
              <input
                value={hints.customerName}
                onChange={(event) => setHints({ ...hints, customerName: event.target.value })}
                placeholder="Full name"
              />
            </label>
          </aside>
          <div className="intake-command">
            <div>
              <ScanText size={18} />
              <p>
                <strong>Language extraction only</strong>
                <span>No policy decisions. No action permissions.</span>
              </p>
            </div>
            <button onClick={parse} disabled={message.trim().length < 10 || parsing}>
              {parsing ? <LoaderCircle className="spin" /> : <Sparkles />}{" "}
              {parsing ? "Reading signal…" : "Extract case facts"}
              <ArrowRight />
            </button>
          </div>
        </main>
      ) : draft ? (
        <main className="intake-review">
          <div className="review-head">
            <button onClick={() => setResult(null)}>
              <ChevronLeft /> Rewrite description
            </button>
            <div className="parse-meter">
              <span>
                {result.provider === "gemini" ? "GEMINI EXTRACTION" : "STRUCTURED MANUAL FALLBACK"}
              </span>
              <strong>
                {result.provider === "manual"
                  ? "MANUAL"
                  : `${Math.round(result.confidence * 100)}%`}
              </strong>
              <i>
                <b style={{ width: `${result.confidence * 100}%` }} />
              </i>
            </div>
          </div>

          <section className="missing-radar">
            <div>
              <CircleAlert />
              <span>EVIDENCE GATE</span>
            </div>
            {missing.length ? (
              <p>
                {missing.length} fact{missing.length === 1 ? "" : "s"} must be confirmed before
                execution.
              </p>
            ) : (
              <p>Operational snapshot complete. The bounded controller may run.</p>
            )}
            <div>
              {missing.map((field) => (
                <span key={field}>{labels[field]}</span>
              ))}
            </div>
          </section>

          <div className="review-grid">
            <fieldset>
              <legend>CASE IDENTITY</legend>
              <label className="wide">
                Customer message
                <textarea
                  value={draft.rawMessage}
                  onChange={(e) => updateDraft({ rawMessage: e.target.value })}
                />
              </label>
              <label className="wide">
                Case subject
                <input
                  value={draft.subject}
                  onChange={(e) => updateDraft({ subject: e.target.value })}
                />
              </label>
              <label className={missing.includes("customerName") ? "missing" : ""}>
                Customer name
                <input
                  value={draft.customerName}
                  onChange={(e) => updateDraft({ customerName: e.target.value })}
                />
              </label>
              <label>
                Order ID
                <input
                  value={draft.orderId ?? ""}
                  onChange={(e) => updateDraft({ orderId: e.target.value || null })}
                />
              </label>
              <label>
                Customer ID
                <input
                  value={draft.customerId ?? ""}
                  onChange={(e) => updateDraft({ customerId: e.target.value || null })}
                />
              </label>
            </fieldset>

            <fieldset>
              <legend>INCIDENT & INTENT</legend>
              <label className={missing.includes("incident") ? "missing" : ""}>
                Incident
                <select
                  value={draft.incident ?? ""}
                  onChange={(e) =>
                    updateDraft({
                      incident: (e.target.value || null) as ManualCaseDraft["incident"],
                    })
                  }
                >
                  <option value="">Select incident</option>
                  {incidentValues.map((incident) => (
                    <option key={incident} value={incident}>
                      {incident.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Urgency
                <select
                  value={draft.urgency}
                  onChange={(e) =>
                    updateDraft({ urgency: e.target.value as ManualCaseDraft["urgency"] })
                  }
                >
                  {["critical", "high", "medium", "low"].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label>
                Requested outcome
                <select
                  value={draft.requestedOutcome}
                  onChange={(e) =>
                    updateDraft({
                      requestedOutcome: e.target.value as ManualCaseDraft["requestedOutcome"],
                    })
                  }
                >
                  <option value="product">Product</option>
                  <option value="refund">Refund</option>
                  <option value="unspecified">Unspecified</option>
                </select>
              </label>
              <label>
                SLA hours
                <input
                  type="number"
                  min="1"
                  value={draft.slaHours ?? ""}
                  onChange={(e) => updateDraft({ slaHours: numberValue(e.target.value) })}
                />
              </label>
            </fieldset>

            <fieldset>
              <legend>OPERATIONAL SNAPSHOT</legend>
              <label className={missing.includes("orderValue") ? "missing" : ""}>
                Order value (₹)
                <input
                  type="number"
                  min="0"
                  value={draft.orderValue ?? ""}
                  onChange={(e) => updateDraft({ orderValue: numberValue(e.target.value) })}
                />
              </label>
              {showInventory && (
                <label className={missing.includes("inventory") ? "missing" : ""}>
                  Available inventory
                  <input
                    type="number"
                    min="0"
                    value={draft.inventory ?? ""}
                    onChange={(e) => updateDraft({ inventory: numberValue(e.target.value) })}
                  />
                </label>
              )}
              {showDelivery && (
                <label className={missing.includes("inactiveDays") ? "missing" : ""}>
                  Inactive days
                  <input
                    type="number"
                    min="0"
                    value={draft.inactiveDays ?? ""}
                    onChange={(e) => updateDraft({ inactiveDays: numberValue(e.target.value) })}
                  />
                </label>
              )}
              {showDelivery && (
                <label className={`wide ${missing.includes("trackingStatus") ? "missing" : ""}`}>
                  Tracking state
                  <input
                    value={draft.trackingStatus ?? ""}
                    onChange={(e) => updateDraft({ trackingStatus: e.target.value || null })}
                  />
                </label>
              )}
              {showPayment && (
                <label className={missing.includes("paymentStatus") ? "missing" : ""}>
                  Payment status
                  <select
                    value={draft.operationalFacts.paymentStatus ?? ""}
                    onChange={(e) =>
                      updateFacts({
                        paymentStatus: (e.target.value ||
                          null) as OperationalFacts["paymentStatus"],
                      })
                    }
                  >
                    <option value="">Select status</option>
                    {["captured", "pending", "refunded", "failed", "unknown"].map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </label>
              )}
              {draft.incident === "DUPLICATE_CHARGE" && (
                <label className={missing.includes("duplicateChargeVerified") ? "missing" : ""}>
                  Duplicate confirmed
                  <select
                    value={
                      draft.operationalFacts.duplicateChargeVerified === null
                        ? ""
                        : String(draft.operationalFacts.duplicateChargeVerified)
                    }
                    onChange={(e) =>
                      updateFacts({ duplicateChargeVerified: booleanValue(e.target.value) })
                    }
                  >
                    <option value="">Select</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </label>
              )}
              {showCondition && (
                <label className={missing.includes("itemCondition") ? "missing" : ""}>
                  Item condition
                  <select
                    value={draft.operationalFacts.itemCondition ?? ""}
                    onChange={(e) =>
                      updateFacts({
                        itemCondition: (e.target.value ||
                          null) as OperationalFacts["itemCondition"],
                      })
                    }
                  >
                    <option value="">Select condition</option>
                    {["normal", "damaged", "wrong_item", "unknown"].map((value) => (
                      <option key={value}>{value.replaceAll("_", " ")}</option>
                    ))}
                  </select>
                </label>
              )}
              {showCondition && (
                <label className={missing.includes("withinReturnWindow") ? "missing" : ""}>
                  Return eligible
                  <select
                    value={
                      draft.operationalFacts.withinReturnWindow === null
                        ? ""
                        : String(draft.operationalFacts.withinReturnWindow)
                    }
                    onChange={(e) =>
                      updateFacts({ withinReturnWindow: booleanValue(e.target.value) })
                    }
                  >
                    <option value="">Select</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </label>
              )}
            </fieldset>
          </div>

          <div className="create-run-dock">
            <div>
              <LockKeyhole />
              <p>
                <strong>Deterministic execution boundary</strong>
                <span>
                  Policy, thresholds, approvals, tools, and verification remain code-controlled.
                </span>
              </p>
            </div>
            <button onClick={createAndRun} disabled={missing.length > 0 || creating}>
              {creating ? <LoaderCircle className="spin" /> : <BrainCircuit />}
              {creating ? "Creating secure run…" : "Create & Run"}
              <ArrowRight />
            </button>
          </div>
        </main>
      ) : null}
      {error && (
        <div className="intake-error" role="alert">
          <CircleAlert />
          {error}
        </div>
      )}
    </div>
  );
}
