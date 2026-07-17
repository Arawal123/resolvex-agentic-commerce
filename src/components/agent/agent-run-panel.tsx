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
  PLAN: "02",
  ACT: "03",
  VERIFY: "04",
  EXPLAIN: "05",
  COMPLETE: "06",
};

function eventCopy(event: AgentEvent) {
  if (event.type === "phase")
    return { phase: event.phase, title: event.title, detail: event.detail };
  if (event.type === "tool")
    return {
      phase: event.trace.phase,
      title: event.trace.name.replace(/([a-z])([A-Z])/g, "$1 $2"),
      detail: `${event.trace.status} · ${event.trace.latencyMs}ms · typed tool receipt ${event.trace.id}`,
    };
  if (event.type === "verification")
    return {
      phase: "VERIFY",
      title: event.result.check,
      detail: event.result.passed ? "Independent read-back passed." : event.result.detail,
    };
  if (event.type === "approval")
    return { phase: "ACT", title: "Human approval boundary", detail: event.reason };
  if (event.type === "error") return { phase: "RECOVER", title: event.code, detail: event.message };
  return { phase: "COMPLETE", title: "Decision record sealed", detail: event.decision.summary };
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
      {!decision && !running && events.length === 0 && (
        <div className="agent-idle">
          <div className="idle-core">
            <CircleDot />
          </div>
          <p>Controller armed</p>
          <span>
            Gemini may extract language. Deterministic policy code decides what can execute.
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
            {events
              .filter((event) => event.type !== "complete")
              .map((event, index) => {
                const copy = eventCopy(event);
                const latest =
                  index === events.filter((item) => item.type !== "complete").length - 1;
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
                      <small>{copy.phase}</small>
                      <strong>{copy.title}</strong>
                      <p>{copy.detail}</p>
                    </div>
                    <div className="event-state">
                      {latest && running ? <Sparkles /> : <Check />}
                    </div>
                  </article>
                );
              })}
            {running && (
              <div className="next-event">
                <LoaderCircle className="spin" />
                <span>Awaiting the next signed controller event</span>
              </div>
            )}
          </div>
        </div>
      )}
      {error && <div className="error-state">{error}</div>}
      {decision && !running && (
        <div className="run-result cinematic-result">
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
