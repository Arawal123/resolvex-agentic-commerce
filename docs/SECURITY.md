# Security

ResolveX validates external input with Zod, keeps secrets server-side, applies role-aware tool permissions, uses idempotency keys for consequential operations, records structured failure codes, bounds retries and runtime, and separates sandbox from production connectors. The model cannot generate SQL, execute code, or bypass the tool allowlist.

Production refund, replacement, inventory, and ticket mutations must use PostgreSQL transactions and unique idempotency constraints. Authorization must be revalidated in route handlers and server-side operations; proxy middleware is never the only gate. Rate-limit model-backed endpoints, sanitize customer content before downstream display, and redact provider secrets from audit payloads.

Report vulnerabilities privately to the repository owner. Do not open a public issue with exploitable details.
