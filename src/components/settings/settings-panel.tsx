"use client";

import { useState } from "react";
import { Check, RotateCcw, Save, SlidersHorizontal } from "lucide-react";
import { scoringWeights } from "@/lib/config";

export function SettingsPanel() {
  const [refund, setRefund] = useState(5000);
  const [level, setLevel] = useState("bounded");
  const [saved, setSaved] = useState(false);
  return (
    <div className="settings-grid">
      <section className="settings-scene">
        <div className="setting-title">
          <SlidersHorizontal />
          <div>
            <span>AUTONOMY ENVELOPE</span>
            <h2>Define the machine’s authority.</h2>
          </div>
        </div>
        <label>
          Autonomy level
          <select
            value={level}
            onChange={(event) => {
              setSaved(false);
              setLevel(event.target.value);
            }}
          >
            <option value="recommend">Recommend only</option>
            <option value="low-risk">Auto-execute low risk</option>
            <option value="bounded">Bounded monetary autonomy</option>
            <option value="sandbox">Full sandbox autonomy</option>
          </select>
        </label>
        <label>
          Maximum autonomous refund{" "}
          <div className="money-input">
            <span>₹</span>
            <input
              type="number"
              value={refund}
              onChange={(event) => {
                setSaved(false);
                setRefund(Number(event.target.value));
              }}
            />
          </div>
        </label>
        <div className="guardrail-note">
          Refunds above ₹{refund.toLocaleString("en-IN")} are routed to human oversight before any
          payment tool can execute.
        </div>
      </section>
      <section className="weight-scene">
        <div className="setting-title">
          <RotateCcw />
          <div>
            <span>SCORING WEIGHTS · v1.4.0</span>
            <h2>Visible by design.</h2>
          </div>
        </div>
        {Object.entries(scoringWeights).map(([key, value]) => (
          <div className="weight-row" key={key}>
            <span>{key}</span>
            <div>
              <i
                className={value < 0 ? "negative" : ""}
                style={{ width: `${Math.abs(value) * 280}%` }}
              />
            </div>
            <b>
              {value > 0 ? "+" : ""}
              {value.toFixed(2)}
            </b>
          </div>
        ))}
      </section>
      <div className="settings-save">
        <span>
          {saved ? (
            <>
              <Check />
              Configuration saved to this sandbox session.
            </>
          ) : (
            "Changes affect future runs; stored decisions remain immutable."
          )}
        </span>
        <button onClick={() => setSaved(true)}>
          <Save size={15} /> Save configuration
        </button>
      </div>
    </div>
  );
}
