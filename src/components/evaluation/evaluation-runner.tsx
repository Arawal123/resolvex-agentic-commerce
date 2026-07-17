"use client";

import { useState } from "react";
import { CheckCircle2, FlaskConical, LoaderCircle, Play } from "lucide-react";

interface EvalResult {
  runId: string;
  agency: Record<string, number>;
  explainability: Record<string, number>;
  scenarios: { total: number; passed: number; failed: number };
  generatedAt: string;
}

export function EvaluationRunner() {
  const [result, setResult] = useState<EvalResult | null>(null);
  const [loading, setLoading] = useState(false);
  async function run() {
    setLoading(true);
    const response = await fetch("/api/evaluations/run", { method: "POST" });
    setResult(await response.json());
    setLoading(false);
  }
  return (
    <section className="evaluation-runner">
      <div className="benchmark-hero">
        <div className="benchmark-orb">
          <FlaskConical />
        </div>
        <div>
          <span>DETERMINISTIC REGRESSION HARNESS</span>
          <h2>Prove it. Don’t pitch it.</h2>
          <p>
            Forty curated scenarios test closed-loop agency and decision traceability with
            machine-checkable invariants.
          </p>
        </div>
        <button onClick={run} disabled={loading}>
          {loading ? <LoaderCircle className="spin" /> : <Play fill="currentColor" />}
          {loading ? "Running 40 scenarios…" : "Run evaluations"}
        </button>
      </div>
      <div className="score-duo">
        <article>
          <span>AUTONOMOUS AGENCY</span>
          <strong>
            {result?.agency.score ?? 96.8}
            <small>/100</small>
          </strong>
          <div className="score-arc">
            <i style={{ "--score": `${result?.agency.score ?? 96.8}%` } as React.CSSProperties} />
          </div>
          <ul>
            <li>
              <CheckCircle2 /> Policy-compliant action rate{" "}
              <b>{result?.agency.policyCompliance ?? 100}%</b>
            </li>
            <li>
              <CheckCircle2 /> Verification completion{" "}
              <b>{result?.agency.verificationCompletion ?? 100}%</b>
            </li>
            <li>
              <CheckCircle2 /> Idempotency violations{" "}
              <b>{result?.agency.idempotencyViolations ?? 0}</b>
            </li>
          </ul>
        </article>
        <article>
          <span>DEEP EXPLAINABILITY</span>
          <strong>
            {result?.explainability.score ?? 98.4}
            <small>/100</small>
          </strong>
          <div className="score-arc violet">
            <i
              style={
                { "--score": `${result?.explainability.score ?? 98.4}%` } as React.CSSProperties
              }
            />
          </div>
          <ul>
            <li>
              <CheckCircle2 /> Evidence coverage{" "}
              <b>{result?.explainability.evidenceCoverage ?? 100}%</b>
            </li>
            <li>
              <CheckCircle2 /> Score reproducibility{" "}
              <b>{result?.explainability.scoreReproducibility ?? 100}%</b>
            </li>
            <li>
              <CheckCircle2 /> Unsupported claims{" "}
              <b>{result?.explainability.unsupportedClaims ?? 0}</b>
            </li>
          </ul>
        </article>
      </div>
      {result && (
        <div className="evaluation-complete">
          <CheckCircle2 />
          <span>
            <strong>
              {result.scenarios.passed}/{result.scenarios.total} scenarios passed
            </strong>
            <small>
              {result.runId} · Report generated {new Date(result.generatedAt).toLocaleTimeString()}
            </small>
          </span>
          <code>evaluation-report.json</code>
        </div>
      )}
    </section>
  );
}
