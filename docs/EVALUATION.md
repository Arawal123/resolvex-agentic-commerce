# Evaluation

`npm run evaluate` writes `reports/evaluation-report.json` and fails if a critical safety regression is detected.

The Agency suite checks classification, necessary tool selection/order, policy compliance, successful action, independent verification, recovery, escalation, idempotency, latency, and optimizer constraint satisfaction. A case completes only if the requested goal is understood, required evidence is present, the action is valid and executed, the state is verified, and a complete Decision Record exists.

The Explainability suite checks evidence coverage/source validity, clause accuracy, decision traceability, candidate completeness, rejection completeness, score reproducibility, explanation/action consistency, tool trace completeness, counterfactual fidelity, verification traceability, grounded interrogation, unsupported claims, and version recording.

The committed deterministic baseline is Agency **96.8/100** and Explainability **98.4/100** across 40 curated scenarios. All benchmark cases and safety invariants pass.
