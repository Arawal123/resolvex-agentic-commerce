import { readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

const input = process.argv[2];
if (!input) {
  console.error("Usage: npm run import:public -- path/to/orders.csv");
  process.exit(1);
}
const lines = readFileSync(input, "utf8").trim().split(/\r?\n/);
const headers = lines[0].split(",").map((value) => value.trim());
const required = ["order_id", "customer_id", "order_purchase_timestamp", "payment_value"];
const missing = required.filter((field) => !headers.includes(field));
if (missing.length) {
  console.error(`Missing required fields: ${missing.join(", ")}`);
  process.exit(1);
}
const adapter = {
  source: basename(input),
  importedAt: new Date().toISOString(),
  rows: lines.length - 1,
  attributionRequired: true,
  note: "Only normalized order realism is imported; support, policy, decision, and tool data remain synthetic.",
};
writeFileSync(
  join(process.cwd(), "data", "public-import-manifest.json"),
  JSON.stringify(adapter, null, 2)
);
console.log(
  `Validated ${adapter.rows} public order rows. See docs/DATASET.md before importing into PostgreSQL.`
);
