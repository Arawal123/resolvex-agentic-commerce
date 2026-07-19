"use client";

import { useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Download,
  FlaskConical,
  MessageSquareText,
  Send,
  Shield,
  Sparkles,
} from "lucide-react";
import type {
  CandidateAction,
  CounterfactualResult,
  DecisionRecord,
  SupplyCandidate,
  SupplyCounterfactualResult,
} from "@/lib/types";

function normalizedProbabilities<T extends { utilityScore: number; valid: boolean }>(items: T[]) {
  const valid = items.filter((item) => item.valid && item.utilityScore > 0);
  const weighted = valid.map((item) => ({ item, weight: Math.exp(item.utilityScore * 6) }));
  const total = weighted.reduce((sum, row) => sum + row.weight, 0);
  return weighted
    .map(({ item, weight }) => ({ item, probability: total ? weight / total : 0 }))
    .sort((a, b) => b.probability - a.probability);
}

export function DecisionStudio({ decision }: { decision: DecisionRecord }) {
  const [question, setQuestion] = useState("What went wrong on the supply side?");
  const [answer, setAnswer] = useState("");
  const [asking, setAsking] = useState(false);
  const [inventory, setInventory] = useState(0);
  const [counterfactual, setCounterfactual] = useState<CounterfactualResult | null>(null);
  const supplyMetric = decision.rootCauseAnalysis?.counterfactual;
  const [supplyValue, setSupplyValue] = useState(supplyMetric?.replacementValue ?? 0);
  const [supplyCounterfactual, setSupplyCounterfactual] =
    useState<SupplyCounterfactualResult | null>(null);

  const customerProbabilities = normalizedProbabilities<CandidateAction>(decision.candidates);
  const supplyProbabilities = normalizedProbabilities<SupplyCandidate>(
    decision.supplyDecision?.candidates ?? []
  );
  const selectedSupplyProbability = supplyProbabilities.find(
    ({ item }) => item.action === decision.supplyDecision?.selectedAction
  )?.probability;
  const decisiveMetric = decision.supplyTrace?.metrics.find((metric) =>
    decision.rootCauseAnalysis?.primaryCause?.decisiveMetricIds.includes(metric.id)
  );

  async function ask() {
    setAsking(true);
    try {
      const response = await fetch("/api/decisions/interrogate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisionId: decision.id, question }),
      });
      const data = await response.json();
      setAnswer(data.answer);
    } finally {
      setAsking(false);
    }
  }

  async function simulateCustomer() {
    const response = await fetch("/api/decisions/counterfactual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decisionId: decision.id, field: "inventory", value: inventory }),
    });
    const data = await response.json();
    setCounterfactual(data.result);
  }

  async function simulateSupply() {
    if (!supplyMetric) return;
    const response = await fetch("/api/decisions/counterfactual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        decisionId: decision.id,
        scope: "supply",
        field: supplyMetric.metricKey,
        value: supplyValue,
      }),
    });
    const data = await response.json();
    setSupplyCounterfactual(data.result);
  }

  function exportRecord() {
    const blob = new Blob([JSON.stringify(decision, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${decision.id}-audit.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="decision-studio-v2">
      <section className="dual-decision-overview">
        <header>
          <div>
            <span>SEALED DUAL DECISION · {decision.id}</span>
            <h2>{decision.rootCauseAnalysis?.primaryCause?.label ?? decision.summary}</h2>
            <p>One shared evidence pass produced an operational diagnosis and a customer remedy.</p>
          </div>
          <button type="button" onClick={exportRecord}>
            <Download size={15} /> Export audit
          </button>
        </header>

        {decision.supplyTrace && (
          <div className="decision-pipeline" aria-label="Supply mechanism">
            {decision.supplyTrace.stages.map((stage) => (
              <div key={stage.stage} className={stage.status}>
                <i />
                <span>{stage.label}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {decision.rootCauseAnalysis && decision.supplyDecision && decision.customerOutcome ? (
        <section className="dual-decision-lanes" aria-label="Supply and customer decision chains">
          <article className="decision-chain supply-chain">
            <header>
              <div>
                <span>SUPPLY SIDE</span>
                <h3>Find and correct the failure</h3>
              </div>
              <strong>{Math.round(decision.rootCauseAnalysis.confidence * 100)}%</strong>
            </header>

            <div className="chain-sequence">
              <div className="chain-node">
                <small>01 · OBSERVED SIGNAL</small>
                <strong>{decisiveMetric?.label ?? "Reviewed operational telemetry"}</strong>
                <p>
                  {decisiveMetric
                    ? `${decisiveMetric.observed} ${decisiveMetric.unit} observed · threshold ${decisiveMetric.expected} ${decisiveMetric.unit}`
                    : "No single metric crossed the decisive threshold."}
                </p>
              </div>
              <ArrowRight aria-hidden="true" />
              <div className="chain-node selected-node">
                <small>02 · ROOT-CAUSE VERDICT</small>
                <strong>
                  {decision.rootCauseAnalysis.primaryCause?.label ?? "Inconclusive attribution"}
                </strong>
                <p>
                  {Math.round(decision.rootCauseAnalysis.confidence * 100)}% probability ·{" "}
                  {decision.rootCauseAnalysis.attribution}
                </p>
              </div>
              <ArrowRight aria-hidden="true" />
              <div className="chain-node">
                <small>03 · CORRECTIVE DECISION</small>
                <strong>{decision.supplyDecision.selectedAction.replaceAll("_", " ")}</strong>
                <p>
                  {Math.round((selectedSupplyProbability ?? 0) * 100)}% normalized selection
                  probability
                </p>
              </div>
              <ArrowRight aria-hidden="true" />
              <div className="chain-node verified-node">
                <small>04 · READ-BACK</small>
                <CheckCircle2 aria-hidden="true" />
                <strong>{decision.supplyDecision.executionStatus.replaceAll("_", " ")}</strong>
                <p>{decision.supplyDecision.verificationIds.length} verification receipt(s)</p>
              </div>
            </div>

            <div className="probability-panel">
              <div className="probability-heading">
                <span>ROOT-CAUSE PROBABILITIES</span>
                <small>normalized causal hypotheses</small>
              </div>
              {decision.rootCauseAnalysis.hypotheses.slice(0, 4).map((hypothesis) => (
                <div className="probability-row" key={hypothesis.id}>
                  <span>{hypothesis.label}</span>
                  <i>
                    <b style={{ width: `${hypothesis.probability * 100}%` }} />
                  </i>
                  <strong>{Math.round(hypothesis.probability * 100)}%</strong>
                </div>
              ))}
            </div>
          </article>

          <article className="decision-chain customer-chain">
            <header>
              <div>
                <span>CUSTOMER SIDE</span>
                <h3>Choose the safest useful remedy</h3>
              </div>
              <strong>{Math.round(decision.confidence * 100)}%</strong>
            </header>

            <div className="chain-sequence">
              <div className="chain-node">
                <small>01 · CUSTOMER GOAL</small>
                <strong>{decision.customerGoal}</strong>
                <p>Grounded in the reviewed message and requested outcome.</p>
              </div>
              <ArrowRight aria-hidden="true" />
              <div className="chain-node selected-node">
                <small>02 · REMEDY DECISION</small>
                <strong>{decision.customerOutcome.action.replaceAll("_", " ")}</strong>
                <p>{Math.round(decision.confidence * 100)}% decision confidence</p>
              </div>
              <ArrowRight aria-hidden="true" />
              <div className="chain-node">
                <small>03 · EXPECTED RESULT</small>
                <strong>{decision.customerOutcome.bestSuggestion}</strong>
                <p>{decision.customerOutcome.expectedResult}</p>
              </div>
              <ArrowRight aria-hidden="true" />
              <div className="chain-node verified-node">
                <small>04 · OUTCOME STATE</small>
                <CheckCircle2 aria-hidden="true" />
                <strong>{decision.customerOutcome.executionStatus.replaceAll("_", " ")}</strong>
                <p>{decision.customerOutcome.approvalStatus.replaceAll("_", " ")}</p>
              </div>
            </div>

            <div className="probability-panel customer-probabilities">
              <div className="probability-heading">
                <span>REMEDY SELECTION PROBABILITIES</span>
                <small>softmax-normalized deterministic utility</small>
              </div>
              {customerProbabilities.slice(0, 4).map(({ item, probability }) => (
                <div className="probability-row" key={item.id}>
                  <span>{item.action.replaceAll("_", " ")}</span>
                  <i>
                    <b style={{ width: `${probability * 100}%` }} />
                  </i>
                  <strong>{Math.round(probability * 100)}%</strong>
                </div>
              ))}
            </div>
          </article>
        </section>
      ) : (
        <section className="legacy-dual-record">
          <strong>Legacy customer-only record</strong>
          <p>Run this case again to generate supply attribution and both decision chains.</p>
        </section>
      )}

      <details className="decision-audit-disclosure">
        <summary>
          <span>
            <Shield size={17} /> Inspect evidence, interventions, and receipts
          </span>
          <small>
            {decision.evidence.length} facts · {decision.toolCalls.length} calls ·{" "}
            {decision.verification.length} checks
          </small>
        </summary>

        <div className="audit-interventions">
          {supplyMetric && (
            <section>
              <span>SUPPLY COUNTERFACTUAL</span>
              <h4>{supplyMetric.metricKey}</h4>
              <p>{supplyMetric.statement}</p>
              <label>
                Replacement value
                <input
                  type="number"
                  min="0"
                  value={supplyValue}
                  onChange={(event) => setSupplyValue(Number(event.target.value))}
                />
              </label>
              <button type="button" onClick={simulateSupply}>
                <FlaskConical size={15} /> Test intervention
              </button>
              {supplyCounterfactual && (
                <div className="audit-result">
                  <strong>
                    {supplyCounterfactual.changed
                      ? "Decision boundary crossed"
                      : "Attribution unchanged"}
                  </strong>
                  <p>{supplyCounterfactual.explanation}</p>
                </div>
              )}
            </section>
          )}

          <section>
            <span>CUSTOMER COUNTERFACTUAL</span>
            <h4>Replacement inventory</h4>
            <p>Recompute the customer remedy under a different inventory constraint.</p>
            <label>
              Inventory units
              <input
                type="number"
                min="0"
                max="20"
                value={inventory}
                onChange={(event) => setInventory(Number(event.target.value))}
              />
            </label>
            <button type="button" onClick={simulateCustomer}>
              <FlaskConical size={15} /> Recompute decision
            </button>
            {counterfactual && (
              <div className="audit-result">
                <strong>COUNTERFACTUAL</strong>
                <p>
                  {counterfactual.originalDecision.replaceAll("_", " ")} →{" "}
                  {counterfactual.counterfactualDecision.replaceAll("_", " ")}
                </p>
              </div>
            )}
          </section>
        </div>

        <div className="audit-ledgers">
          <section>
            <span>EVIDENCE</span>
            {decision.evidence.map((item) => (
              <article key={item.id}>
                <small>{item.id}</small>
                <div>
                  <strong>{item.claim}</strong>
                  <p>{item.sourceLabel}</p>
                </div>
              </article>
            ))}
          </section>
          <section>
            <span>EXECUTION & VERIFICATION</span>
            {decision.toolCalls.map((tool) => (
              <article key={tool.id}>
                <small>{tool.id}</small>
                <div>
                  <strong>{tool.name}</strong>
                  <p>
                    {tool.lane ?? "shared"} · {tool.status} · {tool.latencyMs}ms
                  </p>
                </div>
              </article>
            ))}
          </section>
        </div>
      </details>

      <section className="decision-question-panel">
        <div>
          <MessageSquareText aria-hidden="true" />
          <span>ASK THE SEALED RECORD</span>
          <p>Answers use stored evidence and receipts—never invented reasoning.</p>
        </div>
        <div>
          <div className="decision-question-chips">
            {[
              "What went wrong on the supply side?",
              "Why was this customer remedy selected?",
              "Which actions executed?",
            ].map((item) => (
              <button type="button" key={item} onClick={() => setQuestion(item)}>
                {item}
              </button>
            ))}
          </div>
          {answer && (
            <div className="decision-grounded-answer">
              <span>
                <Sparkles size={13} /> GROUNDED RESPONSE
              </span>
              <p>{answer}</p>
            </div>
          )}
          <div className="decision-ask-box">
            <textarea
              aria-label="Question about this decision"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
            />
            <button type="button" onClick={ask} disabled={asking}>
              <Send size={16} /> {asking ? "Retrieving…" : "Ask record"}
            </button>
          </div>
        </div>
      </section>

      <footer className="decision-method-note">
        Supply percentages are normalized causal hypothesis probabilities. Customer remedy
        percentages are softmax-normalized deterministic utility scores, not model certainty.
        Selected customer confidence is shown separately.
      </footer>
    </div>
  );
}
