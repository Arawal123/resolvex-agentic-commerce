# Architecture

ResolveX separates probabilistic understanding from deterministic authority. Route handlers validate external input, the controller coordinates a bounded state machine, policy and decision engines compute permissions and utility, and tools alone may change operational state.

```mermaid
stateDiagram-v2
  [*] --> Observe
  Observe --> Plan
  Plan --> Act
  Act --> Verify
  Verify --> Complete: all checks pass
  Verify --> Recover: transient or inconsistent state
  Recover --> Act: retry or valid fallback
  Recover --> Approval: unsafe or low confidence
  Approval --> Act: operator approves
  Approval --> Complete: rejected and safely closed
  Complete --> Explain
  Explain --> [*]
```

```mermaid
sequenceDiagram
  participant U as Operator
  participant C as Controller
  participant R as Read Tools
  participant D as Decision Engine
  participant W as Write Tools
  participant V as Verification Tools
  U->>C: Run ticket
  C->>R: Retrieve minimum evidence
  R-->>C: Typed evidence receipts
  C->>D: Candidates + facts + versioned policy
  D-->>C: Validity, contributions, selected action
  C->>W: Idempotent operational actions
  W-->>C: Tool receipts
  C->>V: Independently read resulting state
  V-->>C: Verification results
  C-->>U: Sealed Decision Record
```

The PostgreSQL schema includes tickets, evidence, policy versions/rules, candidates, contributions, tool calls/results, execution attempts, verification, counterfactuals, approvals, refunds, replacements, coupons, optimizer allocations, evaluation results, and audit events. All clients are initialized lazily so `next build` never requires runtime secrets.

## Vercel deployment architecture

```mermaid
flowchart TB
  G[GitHub] --> V[Vercel Build + Preview]
  V --> N[Next.js App Router]
  N --> F[Node Serverless Functions]
  F --> P[(External PostgreSQL)]
  F --> G[Gemini structured intake optional]
  F --> X[Production commerce connectors]
  M[Environment variables] --> F
```
