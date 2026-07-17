import { readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

if (!process.env.DATABASE_URL) {
  console.error(
    "DATABASE_URL is required. Start Docker Compose or configure a Vercel-compatible PostgreSQL provider."
  );
  process.exit(1);
}

type Seed = {
  customers: Array<{ id: string; name: string; email: string; priority: number }>;
  products: Array<{ sku: string; name: string; priceInr: number }>;
  warehouses: Array<{ code: string; city: string }>;
};
const seed = JSON.parse(
  readFileSync(join(process.cwd(), "data", "demo-seed.json"), "utf8")
) as Seed;
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
try {
  await sql.begin(async (tx) => {
    for (const item of seed.customers)
      await tx`insert into customers (external_id, name, email, priority) values (${item.id}, ${item.name}, ${item.email}, ${item.priority}) on conflict (external_id) do nothing`;
    for (const item of seed.products)
      await tx`insert into products (sku, name, price_inr) values (${item.sku}, ${item.name}, ${item.priceInr}) on conflict (sku) do nothing`;
    for (const item of seed.warehouses)
      await tx`insert into warehouses (code, city) values (${item.code}, ${item.city}) on conflict (code) do nothing`;
  });
  console.log(
    `Seeded ${seed.customers.length} customers, ${seed.products.length} products, and ${seed.warehouses.length} warehouses. Use the generator output for full scenario fixtures.`
  );
} finally {
  await sql.end();
}
