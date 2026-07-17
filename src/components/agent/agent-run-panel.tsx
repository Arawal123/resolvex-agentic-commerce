"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  Check,
  CircleDot,
  LoaderCircle,
  Play,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import type { DecisionRecord, Ticket } from "@/lib/types";

export function AgentRunPanel({ ticket }: { ticket: Ticket }) {
  const [decision, setDecision] = useState<DecisionRecord | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  async function run() {
    setRunning(true);
    setError("");
    setDecision(null);
    try {
      const response = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId: ticket.id }),
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.message);
      setDecision(data.decision);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Run failed");
    } finally {
      setRunning(false);
    }
  }
  return (
    <section className="agent-console" aria-live="polite">
      <div className="console-head">
        <div>
          <span className="console-kicker">AUTONOMOUS CONTROLLER</span>
          <h2>Observe → Plan → Act → Verify</h2>
        </div>
        <button className="primary-action" onClick={run} disabled={running}>
          {running ? (
            <LoaderCircle className="spin" size={16} />
          ) : (
            <Play size={15} fill="currentColor" />
          )}
          {running ? "Agent operating…" : decision ? "Run again safely" : "Run agent"}
        </button>
      </div>
      {!decision && !running && (
        <div className="agent-idle">
          <div className="idle-core">
            <CircleDot />
          </div>
          <p>Controller armed</p>
          <span>The model may propose. Deterministic policy code decides what can execute.</span>
        </div>
      )}
      {running && (
        <div className="live-run">
          <div className="phase-rail">
            {["OBSERVE", "PLAN", "ACT", "VERIFY", "EXPLAIN"].map((phase, index) => (
              <div key={phase} style={{ animationDelay: `${index * 0.45}s` }}>
                <span>{index + 1}</span>
                {phase}
              </div>
            ))}
          </div>
          <div className="scan-line" />
          <p>
            Retrieving minimum necessary evidence and evaluating policy-constrained alternatives…
          </p>
        </div>
      )}
      {error && <div className="error-state">{error}</div>}
      {decision && (
        <div className="run-result">
          <div className="decision-flare">
            <div>
              <small>
                SELECTED ACTION ·{" "}
                {decision.candidates.find((item) => item.action === decision.finalAction)?.id}
              </small>
              <strong>{decision.finalAction.replaceAll("_", " ")}</strong>
              <p>{decision.summary}</p>
            </div>
            <div className="confidence-ring">
              <b>{Math.round(decision.confidence * 100)}</b>
              <span>confidence</span>
            </div>
          </div>
          <div className="trace-mini">
            {decision.timeline.map((event) => (
              <div key={event.id}>
                <span>
                  <Check size={12} />
                </span>
                <div>
                  <small>{event.phase}</small>
                  <strong>{event.title}</strong>
                  <p>{event.detail}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="run-proof">
            <span>
              <Wrench size={15} />
              {decision.toolCalls.length} typed tool calls
            </span>
            <span>
              <ShieldCheck size={15} />
              {decision.verification.filter((item) => item.passed).length}/
              {decision.verification.length} verified
            </span>
            <Link href={`/decisions/${decision.id}`}>
              Open Decision Studio <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
