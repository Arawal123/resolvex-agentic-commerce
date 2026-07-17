"use client";

import Link from "next/link";
import { motion } from "motion/react";
import {
  ArrowDown,
  ArrowRight,
  BrainCircuit,
  Check,
  Eye,
  Network,
  Orbit,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";
import { useEffect, useState } from "react";

export default function Home() {
  const [cursor, setCursor] = useState({ x: 50, y: 50 });
  useEffect(() => {
    const move = (event: PointerEvent) => setCursor({ x: event.clientX, y: event.clientY });
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, []);
  return (
    <main
      className="landing-world"
      style={{ "--land-x": `${cursor.x}px`, "--land-y": `${cursor.y}px` } as React.CSSProperties}
    >
      <div className="landing-noise" />
      <div className="landing-cursor" />
      <nav className="landing-nav">
        <Link href="/" className="landing-brand">
          <BrainCircuit />
          <strong>
            RESOLVE<span>X</span>
          </strong>
        </Link>
        <div>
          <a href="#architecture">Architecture</a>
          <a href="#explainability">Explainability</a>
          <Link href="/evaluations">Benchmarks</Link>
        </div>
        <Link href="/dashboard" className="nav-launch">
          Enter control plane <ArrowRight />
        </Link>
      </nav>
      <motion.section className="landing-hero">
        <div className="hero-atmosphere">
          <div className="planet-core">
            <i />
            <i />
            <i />
            <div className="planet-light" />
            <div className="planet-mark">
              <BrainCircuit />
            </div>
          </div>
          <div className="orbit-label one">
            <span />
            EVIDENCE ACQUIRED
          </div>
          <div className="orbit-label two">
            <span />
            POLICY VALIDATED
          </div>
          <div className="orbit-label three">
            <span />
            OUTCOME VERIFIED
          </div>
        </div>
        <div className="hero-copy">
          <motion.p initial={false}>EXPLAINABLE AUTONOMOUS COMMERCE · 2026</motion.p>
          <motion.h1 initial={false}>
            The machine can act.
            <br />
            <em>Now make it answer.</em>
          </motion.h1>
          <motion.div className="hero-bottom" initial={false}>
            <p>
              ResolveX investigates commerce incidents, executes policy-compliant remedies, verifies
              reality changed, and seals every decision in evidence.
            </p>
            <Link href="/tickets/TKT-1042">
              Launch the live case <ArrowRight />
            </Link>
          </motion.div>
        </div>
        <div className="scroll-cue">
          <ArrowDown />
          <span>DESCEND INTO THE DECISION</span>
        </div>
      </motion.section>
      <section className="manifesto">
        <span className="scene-number">01 / AUTONOMY</span>
        <div>
          <p>NOT A CHATBOT WRAPPER</p>
          <h2>
            From human friction
            <br />
            to <em>verified reality.</em>
          </h2>
        </div>
        <div className="lifecycle-river">
          {[
            { icon: Eye, name: "OBSERVE", sub: "Goal + incident" },
            { icon: BrainCircuit, name: "PLAN", sub: "Minimum tools" },
            { icon: Wrench, name: "ACT", sub: "Typed operations" },
            { icon: ShieldCheck, name: "VERIFY", sub: "Read state back" },
            { icon: Sparkles, name: "EXPLAIN", sub: "Contestable record" },
          ].map((item, index) => {
            const Icon = item.icon;
            return (
              <div key={item.name}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <Icon />
                <strong>{item.name}</strong>
                <small>{item.sub}</small>
                {index < 4 && <i />}
              </div>
            );
          })}
        </div>
      </section>
      <section id="architecture" className="architecture-scene">
        <span className="scene-number">02 / HYBRID CONTROL</span>
        <div className="architecture-copy">
          <p>GENERATIVE INTELLIGENCE, DETERMINISTIC AUTHORITY</p>
          <h2>
            Language proposes.
            <br />
            <em>Code permits.</em>
          </h2>
          <p>
            Intent, planning, and natural language meet versioned policy, deterministic scoring,
            hard monetary limits, idempotent tools, and independent verification.
          </p>
        </div>
        <div className="architecture-object">
          <div className="arch-ring outer">
            <span>LLM · PROPOSAL LAYER</span>
          </div>
          <div className="arch-ring middle">
            <span>POLICY · DECISION LAYER</span>
          </div>
          <div className="arch-ring inner">
            <span>TOOLS · REALITY LAYER</span>
          </div>
          <div className="arch-center">
            <Orbit />
            <strong>
              RESOLVE<span>X</span>
            </strong>
            <small>CONTROLLED AGENCY</small>
          </div>
          <div className="arch-node n1">ZOD ALLOWLIST</div>
          <div className="arch-node n2">IDEMPOTENCY</div>
          <div className="arch-node n3">POSTGRES AUDIT</div>
          <div className="arch-node n4">VERIFICATION</div>
        </div>
      </section>
      <section id="explainability" className="explainability-scene">
        <span className="scene-number">03 / DEEP EXPLAINABILITY</span>
        <div className="explainability-head">
          <h2>
            Trust is not a feeling.
            <br />
            <em>It is a data structure.</em>
          </h2>
          <p>
            No hidden chain-of-thought. Every displayed claim resolves to a database record, tool
            result, policy clause, deterministic calculation, or verification receipt.
          </p>
        </div>
        <div className="record-specimen">
          <div className="record-glow" />
          <div className="record-top">
            <span>DECISION DEC-1042</span>
            <b>0.94 CONFIDENCE</b>
          </div>
          <h3>PRIORITY REPLACEMENT</h3>
          <p>
            Selected because customer-goal fit, inventory availability, and SLA recovery outweighed
            operational cost.
          </p>
          <div className="specimen-score">
            {[
              ["Customer goal", 0.28],
              ["Policy compliance", 0.22],
              ["SLA recovery", 0.14],
              ["Operational cost", -0.042],
            ].map(([name, value]) => (
              <div key={name as string}>
                <span>{name}</span>
                <i
                  style={{ width: `${Math.abs(value as number) * 280}%` }}
                  className={(value as number) < 0 ? "negative" : ""}
                />
                <b>
                  {(value as number) > 0 ? "+" : ""}
                  {(value as number).toFixed(3)}
                </b>
              </div>
            ))}
          </div>
          <div className="record-footer">
            <span>
              <Check /> E-03 · shipment inactive 7d
            </span>
            <span>
              <Check /> P-02 §4.2 · replacement permitted
            </span>
            <span>
              <Check /> V-05 · resolved state verified
            </span>
          </div>
        </div>
      </section>
      <section className="operations-scene">
        <span className="scene-number">04 / OPERATIONS</span>
        <div>
          <p>GLOBAL OPTIMIZATION</p>
          <h2>
            One ticket is a story.
            <br />
            <em>The queue is a system.</em>
          </h2>
          <p>
            A constrained optimizer allocates compensation, inventory, and shipping capacity across
            the whole operation—then explains every marginal choice.
          </p>
          <Link href="/operations">
            Open optimizer <ArrowRight />
          </Link>
        </div>
        <div className="allocation-art">
          <div className="allocation-orbit">
            <Network />
          </div>
          {["TKT-1042", "TKT-1038", "TKT-1034", "TKT-1029", "TKT-1021"].map((id, i) => (
            <span key={id} style={{ "--i": i } as React.CSSProperties}>
              {id}
              <i />
            </span>
          ))}
          <strong>
            ₹20K<small>BOUND</small>
          </strong>
        </div>
      </section>
      <section className="final-portal">
        <div className="portal-light" />
        <div className="portal-copy">
          <span>RESOLVEX · SANDBOX READY</span>
          <h2>
            Watch the agent
            <br />
            change reality.
          </h2>
          <p>A complete, synthetic, reproducible judge journey. No API key required.</p>
          <Link href="/tickets/TKT-1042">
            Enter the control plane <ArrowRight />
          </Link>
        </div>
      </section>
      <footer className="landing-footer">
        <div className="landing-brand">
          <BrainCircuit />
          <strong>
            RESOLVE<span>X</span>
          </strong>
        </div>
        <p>Explainable Autonomous E-Commerce Operations Agent</p>
        <span>BUILT FOR CONTESTABLE AUTONOMY · 2026</span>
      </footer>
    </main>
  );
}
