"use client";

import { useState } from "react";
import { CheckCircle2, LoaderCircle, Network, Play, ShieldAlert, Sparkles } from "lucide-react";
import type { BatchPlan } from "@/lib/optimization/batch-optimizer";

interface OptimizationResponse {
  objective: string;
  requiresApproval: boolean;
  plan: BatchPlan;
  alternatives: Array<{ label: string; plan: BatchPlan }>;
}

export function OptimizerPanel() {
  const [objective, setObjective] = useState(
    "Resolve today's delayed-order queue while keeping compensation below ₹20,000 and preserving inventory for high-priority customers."
  );
  const [budget, setBudget] = useState(20000);
  const [inventory, setInventory] = useState(12);
  const [result, setResult] = useState<OptimizationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [executed, setExecuted] = useState(false);
  async function optimize() {
    setLoading(true);
    setExecuted(false);
    const response = await fetch("/api/operations/optimize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objective, budget, inventory }),
    });
    setResult(await response.json());
    setLoading(false);
  }
  return (
    <div className="optimizer-world">
      <section className="objective-console">
        <div className="objective-mark">
          <Network />
        </div>
        <div className="objective-input">
          <label>OPERATIONAL OBJECTIVE</label>
          <textarea value={objective} onChange={(event) => setObjective(event.target.value)} />
          <div className="constraint-row">
            <label>
              <span>COMPENSATION CEILING</span>
              <input
                type="number"
                value={budget}
                onChange={(event) => setBudget(Number(event.target.value))}
              />
              <em>INR</em>
            </label>
            <label>
              <span>REPLACEMENT INVENTORY</span>
              <input
                type="number"
                value={inventory}
                onChange={(event) => setInventory(Number(event.target.value))}
              />
              <em>UNITS</em>
            </label>
            <button onClick={optimize} disabled={loading}>
              {loading ? <LoaderCircle className="spin" /> : <Sparkles />}
              {loading ? "Solving constraints…" : "Generate batch plan"}
            </button>
          </div>
        </div>
      </section>
      {!result && (
        <div className="optimizer-idle">
          <div className="constraint-orbit">
            <i />
            <i />
            <i />
            <Network />
          </div>
          <h2>One objective. Many constrained futures.</h2>
          <p>
            The optimizer chooses at most one policy-valid action per case while respecting the
            shared budget, inventory, SLA, and priority constraints.
          </p>
        </div>
      )}
      {result && (
        <div className="batch-plan">
          <div className="batch-score">
            <div>
              <span>OBJECTIVE SCORE</span>
              <strong>{result.plan.objectiveScore.toFixed(2)}</strong>
              <small>deterministic branch-and-bound allocation</small>
            </div>
            <div className="utilization">
              <span>Budget</span>
              <div>
                <i
                  style={{
                    width: `${(result.plan.compensationUsed / result.plan.budgetLimit) * 100}%`,
                  }}
                />
              </div>
              <b>
                ₹{result.plan.compensationUsed.toLocaleString("en-IN")} / ₹
                {result.plan.budgetLimit.toLocaleString("en-IN")}
              </b>
              <span>Inventory</span>
              <div>
                <i
                  style={{
                    width: `${(result.plan.inventoryConsumed / result.plan.inventoryLimit) * 100}%`,
                  }}
                />
              </div>
              <b>
                {result.plan.inventoryConsumed} / {result.plan.inventoryLimit} units
              </b>
            </div>
            <div className="batch-outcomes">
              <div>
                <b>{result.plan.casesResolved}</b>
                <span>cases resolved</span>
              </div>
              <div>
                <b>{result.plan.slaBreachesAvoided}</b>
                <span>SLA breaches avoided</span>
              </div>
              <div>
                <b>{result.plan.escalated}</b>
                <span>escalated</span>
              </div>
            </div>
          </div>
          <div className="allocation-list">
            <div className="allocation-head">
              <span>CASE</span>
              <span>SELECTED ACTION</span>
              <span>UTILITY</span>
              <span>COST</span>
            </div>
            {result.plan.allocations.map((item) => (
              <article key={item.ticketId}>
                <span>{item.ticketId}</span>
                <strong>{item.action.replaceAll("_", " ")}</strong>
                <b>{item.utility.toFixed(3)}</b>
                <em>₹{item.cost.toLocaleString("en-IN")}</em>
                <p>{item.rationale}</p>
              </article>
            ))}
          </div>
          <div className="batch-footer">
            <div>
              {result.requiresApproval ? <ShieldAlert /> : <CheckCircle2 />}
              <span>
                <strong>
                  {result.requiresApproval
                    ? "Operator confirmation required"
                    : "Within autonomous bounds"}
                </strong>
                <small>Every executed case will be verified independently.</small>
              </span>
            </div>
            <button onClick={() => setExecuted(true)} disabled={executed}>
              <Play size={15} fill="currentColor" />
              {executed ? "Batch queued & audit sealed" : "Confirm sandbox execution"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
