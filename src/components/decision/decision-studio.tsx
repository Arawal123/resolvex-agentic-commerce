"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownRight,
  CheckCircle2,
  Download,
  FlaskConical,
  MessageSquareText,
  Send,
  Shield,
  Sparkles,
  XCircle,
} from "lucide-react";
import type { CounterfactualResult, DecisionRecord } from "@/lib/types";

export function DecisionStudio({ decision }: { decision: DecisionRecord }) {
  const [question, setQuestion] = useState("Why was replacement chosen instead of refund?");
  const [answer, setAnswer] = useState("");
  const [asking, setAsking] = useState(false);
  const [inventory, setInventory] = useState(0);
  const [counterfactual, setCounterfactual] = useState<CounterfactualResult | null>(null);
  const selected = useMemo(
    () => decision.candidates.find((item) => item.action === decision.finalAction)!,
    [decision]
  );
  const maxScore = Math.max(...decision.candidates.map((item) => item.utilityScore));
  async function ask() {
    setAsking(true);
    const response = await fetch("/api/decisions/interrogate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decisionId: decision.id, question }),
    });
    const data = await response.json();
    setAnswer(data.answer);
    setAsking(false);
  }
  async function simulate() {
    const response = await fetch("/api/decisions/counterfactual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decisionId: decision.id, field: "inventory", value: inventory }),
    });
    const data = await response.json();
    setCounterfactual(data.result);
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
    <div className="studio-grid">
      <section className="decision-monolith">
        <div className="monolith-top">
          <span>FINAL DECISION</span>
          <button onClick={exportRecord}>
            <Download size={14} /> Export audit
          </button>
        </div>
        <div className="decision-title">
          <div className="decision-index">01</div>
          <div>
            <h2>{decision.finalAction.replaceAll("_", " ")}</h2>
            <p>{decision.summary}</p>
          </div>
          <div className="confidence-block">
            <strong>{Math.round(decision.confidence * 100)}%</strong>
            <span>evidence confidence</span>
          </div>
        </div>
        <div className="goal-strip">
          <span>CUSTOMER GOAL</span>
          <p>{decision.customerGoal}</p>
        </div>
        <div className="proof-grid">
          <div>
            <b>{decision.evidence.length}</b>
            <span>source-bound facts</span>
          </div>
          <div>
            <b>{decision.candidates.length}</b>
            <span>alternatives evaluated</span>
          </div>
          <div>
            <b>{decision.toolCalls.length}</b>
            <span>tool receipts</span>
          </div>
          <div>
            <b>{decision.verification.length}</b>
            <span>verification checks</span>
          </div>
        </div>
      </section>

      <section className="studio-section evidence-section">
        <div className="section-intro">
          <span>02 · EVIDENCE GRAPH</span>
          <h3>Every claim has an address.</h3>
          <p>
            Click-source references map directly to records, tool outputs, policy clauses,
            calculations, or verification receipts.
          </p>
        </div>
        <div className="evidence-ledger">
          {decision.evidence.map((item) => (
            <article id={item.id} key={item.id}>
              <div className="evidence-id">{item.id}</div>
              <div>
                <strong>{item.claim}</strong>
                <span>
                  {item.sourceType} · {item.sourceLabel}
                </span>
              </div>
              <code>{String(item.value)}</code>
            </article>
          ))}
        </div>
      </section>

      <section className="studio-section candidates-section">
        <div className="section-intro">
          <span>03 · CONTESTED ALTERNATIVES</span>
          <h3>The winner was earned.</h3>
          <p>
            Scores are reproducible from versioned weights. Invalid actions are rejected before
            selection.
          </p>
        </div>
        <div className="candidate-stack">
          {[...decision.candidates]
            .sort((a, b) => b.utilityScore - a.utilityScore)
            .map((candidate) => (
              <article
                key={candidate.id}
                className={
                  candidate.action === decision.finalAction ? "candidate selected" : "candidate"
                }
              >
                <div className="candidate-head">
                  <span>{candidate.id}</span>
                  <strong>{candidate.action.replaceAll("_", " ")}</strong>
                  {candidate.valid ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
                  <b>{candidate.utilityScore.toFixed(3)}</b>
                </div>
                <div className="score-track">
                  <i
                    style={{
                      width: `${maxScore ? (candidate.utilityScore / maxScore) * 100 : 0}%`,
                    }}
                  />
                </div>
                {candidate.rejectionReasons.length > 0 && (
                  <p>{candidate.rejectionReasons.join(" ")}</p>
                )}
              </article>
            ))}
        </div>
      </section>

      <section className="studio-section contribution-section">
        <div className="section-intro">
          <span>04 · FACTOR ATTRIBUTION</span>
          <h3>Utility, decomposed.</h3>
          <p>
            {selected.id} · {decision.versions.scoring}
          </p>
        </div>
        <div className="factor-field">
          {selected.factorContributions.map((factor) => (
            <div key={factor.factor}>
              <div className="factor-label">
                <span>{factor.factor}</span>
                <em>
                  {factor.value.toFixed(2)} × {factor.weight.toFixed(2)}
                </em>
                <b className={factor.contribution < 0 ? "negative" : ""}>
                  {factor.contribution > 0 ? "+" : ""}
                  {factor.contribution.toFixed(3)}
                </b>
              </div>
              <div className="factor-track">
                <i
                  className={factor.contribution < 0 ? "negative" : ""}
                  style={{ width: `${Math.abs(factor.contribution) * 250}%` }}
                />
              </div>
              <small>{factor.evidenceIds.join(" · ")}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="studio-section counterfactual-section">
        <div className="section-intro">
          <span>05 · COUNTERFACTUAL LAB</span>
          <h3>Change reality. Re-run the rules.</h3>
          <p>This is a deterministic engine rerun, never generated speculation.</p>
        </div>
        <div className="counterfactual-lab">
          <div className="cf-control">
            <label htmlFor="inventory">Replacement inventory</label>
            <div>
              <input
                id="inventory"
                type="range"
                min="0"
                max="20"
                value={inventory}
                onChange={(event) => setInventory(Number(event.target.value))}
              />
              <output>{inventory} units</output>
            </div>
            <button onClick={simulate}>
              <FlaskConical size={15} /> Recompute decision
            </button>
          </div>
          {counterfactual ? (
            <div className="cf-result">
              <div>
                <span>ORIGINAL</span>
                <strong>{counterfactual.originalDecision.replaceAll("_", " ")}</strong>
              </div>
              <ArrowDownRight />
              <div>
                <span>COUNTERFACTUAL</span>
                <strong>{counterfactual.counterfactualDecision.replaceAll("_", " ")}</strong>
              </div>
              <p>
                {counterfactual.smallestDecisionChangingCondition} ·{" "}
                {counterfactual.policiesTriggered.join(" · ") || "No new policy trigger"}
              </p>
            </div>
          ) : (
            <div className="cf-placeholder">
              <Sparkles />
              <span>Set an alternate inventory value, then recompute.</span>
            </div>
          )}
        </div>
      </section>

      <section className="studio-section trace-section">
        <div className="section-intro">
          <span>06 · EXECUTION PROOF</span>
          <h3>Actions, then independent verification.</h3>
          <p>
            Successful calls are insufficient on their own. State is read back through separate
            verification tools.
          </p>
        </div>
        <div className="tool-ledger">
          {decision.toolCalls.map((tool) => (
            <article key={tool.id}>
              <span>{tool.id}</span>
              <div>
                <strong>{tool.name}</strong>
                <small>
                  {tool.phase} · {tool.latencyMs}ms · {tool.status}
                </small>
              </div>
              <code>{JSON.stringify(tool.output)}</code>
            </article>
          ))}
        </div>
        <div className="verification-grid">
          {decision.verification.map((item) => (
            <article key={item.id}>
              <Shield size={16} />
              <div>
                <span>{item.id}</span>
                <strong>{item.check}</strong>
                <p>{item.detail}</p>
              </div>
              <CheckCircle2 size={18} />
            </article>
          ))}
        </div>
      </section>

      <section className="interrogate-panel">
        <div className="interrogate-copy">
          <MessageSquareText />
          <span>07 · ASK ABOUT THIS DECISION</span>
          <h3>
            Interrogate the record,
            <br />
            not an invented story.
          </h3>
          <p>
            Answers are assembled exclusively from stored evidence, candidate scores, policy checks,
            tool receipts, and verification results.
          </p>
        </div>
        <div className="interrogate-chat">
          <div className="prompt-chips">
            {[
              "Which policy authorized this?",
              "What had the greatest influence?",
              "Which actions executed?",
            ].map((item) => (
              <button key={item} onClick={() => setQuestion(item)}>
                {item}
              </button>
            ))}
          </div>
          {answer && (
            <div className="grounded-answer">
              <span>
                <Sparkles size={13} /> GROUNDED RESPONSE
              </span>
              <p>{answer}</p>
            </div>
          )}
          <div className="ask-box">
            <textarea
              aria-label="Question about this decision"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
            />
            <button onClick={ask} disabled={asking}>
              <Send size={16} />
              {asking ? "Retrieving…" : "Ask record"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
