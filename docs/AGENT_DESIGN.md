# Agent design

The controller implements intake, investigation, planning, candidate generation, deterministic validation, selection, execution, verification, recovery, and explanation. It retrieves only evidence required for the incident class. Plans identify tool order, failure paths, and approval gates.

The model is optional and limited to classification, planning, candidate proposal, and prose. It cannot emit SQL, execute arbitrary code, or write records. Final eligibility, refunds, budget accounting, inventory, approvals, idempotency, utility, verification, and counterfactuals are deterministic TypeScript.

Tool calls require Zod-valid inputs, an explicit permission, structured outputs, an audit ID, a failure code, and an optional idempotency key. Financial and fulfillment actions should run inside database transactions in a production connector. Verification uses separate read paths and never equates “no exception” with success.

Low confidence, missing critical evidence, conflicting policy, fraud signals, repeated tool failure, large refunds, and high-impact batches enter human oversight. The operator decision and note are attributed and a resume event continues the same run.
