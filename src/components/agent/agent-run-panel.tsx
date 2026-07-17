"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  CircleDot,
  LoaderCircle,
  Play,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";
import type { AgentEvent, DecisionRecord, Ticket } from "@/lib/types";

const phaseNumber: Record<string, string> = {
  OBSERVE: "01",
  DIAGNOSE: "02",
  PLAN: "03",
  ACT: "04",
  VERIFY: "05",
  EXPLAIN: "06",
  COMPLETE: "07",
};

function eventCopy(event: AgentEvent) {
  if (event.type === "phase")
    return {
      phase: event.phase,
      title: event.title,
      detail: event.detail,
      lane: event.lane ?? "shared",
    };
  if (event.type === "tool")
    return {
      phase: event.trace.phase,
      title: event.trace.name.replace(/([a-z])([A-Z])/g, "$1 $2"),
      detail: `${event.trace.status} · ${event.trace.latencyMs}ms · typed receipt ${event.trace.id}`,
      lane: event.lane ?? event.trace.lane ?? "shared",
    };
  if (event.type === "verification")
    return {
      phase: "VERIFY",
      title: event.result.check,
      detail: event.result.passed ? "Independent read-back passed." : event.result.detail,
      lane: event.lane ?? event.result.lane ?? "shared",
    };
  if (event.type === "approval")
    return {
      phase: "ACT",
      title: "Human approval boundary",
      detail: event.reason,
      lane: event.lane ?? "customer",
    };
  if (event.type === "error")
    return {
      phase: "RECOVER",
      title: event.code,
      detail: event.message,
      lane: event.lane ?? "shared",
    };
  return {
    phase: "COMPLETE",
    title: "Decision record sealed",
    detail: event.decision.summary,
    lane: event.lane ?? "shared",
  };
}

function pause(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

export function AgentRunPanel({
  ticket,
  autoStart = false,
}: {
  ticket: Ticket;
  autoStart?: boolean;
}) {
  const [decision, setDecision] = useState<DecisionRecord | null>(null);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const autoStarted = useRef(false);

  const run = useCallback(async () => {
    if (running) return;
    setRunning(true);
    setError("");
    setDecision(null);
    setEvents([]);
    try {
      const response = await fetch("/api/agent/run/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({ ticketId: ticket.id }),
      });
      if (!response.ok || !response.body)
        throw new Error("The execution stream could not be opened.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const packets = buffer.split("\n\n");
        buffer = packets.pop() ?? "";
        for (const packet of packets) {
          const dataLine = packet.split("\n").find((line) => line.startsWith("data: "));
          if (!dataLine) continue;
          const event = JSON.parse(dataLine.slice(6)) as AgentEvent;
          setEvents((current) => [...current, event]);
          if (event.type === "complete") setDecision(event.decision);
          if (event.type === "error") throw new Error(event.message);
          await pause(event.type === "tool" ? 145 : 260);
        }
        if (done) break;
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Run failed");
    } finally {
      setRunning(false);
    }
  }, [running, ticket.id]);

  useEffect(() => {
    if (!autoStart || autoStarted.current) return;
    const key = `resolvex:autorun:${ticket.id}`;
    if (sessionStorage.getItem(key)) return;
    const timer = window.setTimeout(() => {
      if (autoStarted.current) return;
      autoStarted.current = true;
      sessionStorage.setItem(key, "started");
      void run();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [autoStart, run, ticket.id]);

  const visibleEvents = events.filter((event) => event.type !== "complete");
  return (
    <section className="agent-console" aria-live="polite">
      <div className="console-head">
        <div>
          <span className="console-kicker">DUAL-LANE CONTROLLER</span>
          <h2>Observe → Diagnose → Resolve</h2>
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
      {!decision && !running && events.length === 0 && (
        <div className="agent-idle">
          <div className="idle-core">
            <CircleDot />
          </div>
          <p>Controller armed</p>
          <span>
            One evidence pass. Supply cause and customer remedy remain independently bounded.
          </span>
        </div>
      )}
      {(running || events.length > 0) && (
        <div className="cinematic-run">
          <div className="run-horizon">
            <i />
            <span>{running ? "LIVE EXECUTION" : "TRACE SEALED"}</span>
            <i />
          </div>
          <div className="event-cascade">
            {visibleEvents.map((event, index) => {
              const copy = eventCopy(event);
              const latest = index === visibleEvents.length - 1;
              return (
                <article
                  key={`${event.type}-${index}`}
                  className={latest && running ? "latest" : ""}
                >
                  <div className="event-coordinate">
                    <span>{phaseNumber[copy.phase] ?? "·"}</span>
                    <i />
                  </div>
                  <div>
                    <small>
                      {copy.lane} / {copy.phase}
                    </small>
                    <strong>{copy.title}</strong>
                    <p>{copy.detail}</p>
                  </div>
                  <div className="event-state">{latest && running ? <Sparkles /> : <Check />}</div>
                </article>
              );
            })}
            {running && (
              <div className="next-event">
                <LoaderCircle className="spin" />
                <span>Awaiting the next signed event</span>
              </div>
            )}
          </div>
        </div>
      )}
      {error && <div className="error-state">{error}</div>}
      {decision && !running && (
        <div className="run-result cinematic-result">
          {decision.rootCauseAnalysis &&
          decision.supplyTrace &&
          decision.supplyDecision &&
          decision.customerOutcome ? (
            <>
              <div className="causal-verdict">
                <div>
                  <small>SHARED CAUSAL VERDICT</small>
                  <strong>
                    {decision.rootCauseAnalysis.primaryCause?.label ?? "Inconclusive attribution"}
                  </strong>
                  <p>
                    {decision.rootCauseAnalysis.attribution} ·{" "}
                    {Math.round(decision.rootCauseAnalysis.confidence * 100)}% probability
                  </p>
                </div>
                <div className="causal-pipeline" aria-label="Commerce supply pipeline">
                  {decision.supplyTrace.stages.map((stage) => (
                    <span key={stage.stage} className={stage.status} title={stage.label}>
                      <i />
                      <em>{stage.label}</em>
                    </span>
                  ))}
                </div>
              </div>
              <div className="dual-outcomes">
                <article className="outcome-lane supply-lane">
                  <small>SUPPLY SIDE</small>
                  <h3>{decision.supplyDecision.selectedAction.replaceAll("_", " ")}</h3>
                  <p>{decision.supplyDecision.summary}</p>
                  <div className="lane-status">
                    <span>{decision.rootCauseAnalysis.attribution}</span>
                    <b>{decision.supplyDecision.executionStatus.replaceAll("_", " ")}</b>
                  </div>
                  <details>
                    <summary>Inspect causal evidence</summary>
                    <div className="causal-details">
                      {decision.rootCauseAnalysis.decisiveFactors.map((factor) => (
                        <p key={factor}>{factor}</p>
                      ))}
                      {decision.rootCauseAnalysis.counterfactual && (
                        <p>{decision.rootCauseAnalysis.counterfactual.statement}</p>
                      )}
                      <ol>
                        {decision.rootCauseAnalysis.hypotheses.slice(0, 4).map((hypothesis) => (
                          <li key={hypothesis.id}>
                            <span>{hypothesis.label}</span>
                            <b>{Math.round(hypothesis.probability * 100)}%</b>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </details>
                </article>
                <article className="outcome-lane customer-lane">
                  <small>CUSTOMER SIDE</small>
                  <h3>{decision.customerOutcome.bestSuggestion}</h3>
                  <p>{decision.customerOutcome.expectedResult}</p>
                  <div className="lane-status">
                    <span>{decision.customerOutcome.action.replaceAll("_", " ")}</span>
                    <b>{decision.customerOutcome.executionStatus.replaceAll("_", " ")}</b>
                  </div>
                  <details>
                    <summary>Why this remedy</summary>
                    <div className="causal-details">
                      <p>{decision.customerOutcome.rationale}</p>
                      {decision.customerOutcome.rankedAlternatives.map((alternative) => (
                        <p key={alternative.action}>
                          {alternative.action.replaceAll("_", " ")} ·{" "}
                          {alternative.utilityScore.toFixed(3)}
                        </p>
                      ))}
                    </div>
                  </details>
                </article>
              </div>
            </>
          ) : (
            <div className="decision-flare">
              <div>
                <small>LEGACY CUSTOMER DECISION</small>
                <strong>{decision.finalAction.replaceAll("_", " ")}</strong>
                <p>{decision.summary}</p>
              </div>
              <div className="confidence-ring">
                <b>{Math.round(decision.confidence * 100)}</b>
                <span>confidence</span>
              </div>
            </div>
          )}
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
