# Dataset

The authoritative hackathon dataset is deterministic, synthetic, and CC0. `npm run data:generate` uses fixed seed `20260717` and writes the seed plus a count manifest.

Counts: 500 customers, 300 products, 1,500 orders, 2,500 items, 1,500 payments, 1,500 shipments, 8,000 shipment events, 12 warehouses, 600 inventory records, 250 support tickets, 600 messages, 100 refunds, 100 replacements, 20 policies, 1,000 audit events, 14 budgets, and 40 evaluation cases.

Scenarios cover normal delivery, delays, loss, damage, wrong items, duplicate capture, out-of-stock replacement, policy thresholds, approval, conflicting requests, anomaly risk, temporary failures, duplicate actions, and missing tracking.

## Optional public importer

`scripts/import-public-orders.ts` validates a license-compatible order CSV. Required fields are `order_id`, `customer_id`, `order_purchase_timestamp`, and `payment_value`. Confirm the dataset license and retain its attribution before import. Public data may improve distributions only; tickets, policies, decisions, tools, and audits remain synthetic. ResolveX never scrapes or downloads a dataset automatically.
