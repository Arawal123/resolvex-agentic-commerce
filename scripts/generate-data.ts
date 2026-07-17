import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

let seed = 20260717;
function random() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
}
function pick<T>(values: T[]) {
  return values[Math.floor(random() * values.length)];
}
function id(prefix: string, index: number) {
  return `${prefix}-${String(index + 1).padStart(5, "0")}`;
}

const firstNames = [
  "Aarav",
  "Maya",
  "Zoya",
  "Kabir",
  "Ishita",
  "Arjun",
  "Meera",
  "Vihaan",
  "Anaya",
  "Rohan",
];
const lastNames = ["Rao", "Shah", "Khan", "Mehta", "Sen", "Patel", "Iyer", "Kapoor"];
const incidents = [
  "DELAYED_DELIVERY",
  "DAMAGED_PRODUCT",
  "WRONG_PRODUCT",
  "RETURN_REQUEST",
  "LOST_SHIPMENT",
  "OUT_OF_STOCK",
  "DUPLICATE_CHARGE",
  "DELIVERY_FAILURE",
];
const statuses = ["created", "packed", "in_transit", "hub_scan", "out_for_delivery", "delivered"];

const customers = Array.from({ length: 500 }, (_, i) => ({
  id: id("CUS", i),
  name: `${pick(firstNames)} ${pick(lastNames)}`,
  email: `customer${i + 1}@synthetic.resolvex.local`,
  priority: Number((0.25 + random() * 0.74).toFixed(3)),
  synthetic: true,
}));
const products = Array.from({ length: 300 }, (_, i) => ({
  id: id("PRD", i),
  sku: `RX-${String(i + 1).padStart(4, "0")}`,
  name: `${pick(["Aura", "Vector", "Nova", "Mono", "Arc"])} ${pick(["Headphones", "Camera", "Jacket", "Watch", "Speaker", "Lens"])}`,
  priceInr: Math.round(499 + random() * 29500),
  synthetic: true,
}));
const warehouses = Array.from({ length: 12 }, (_, i) => ({
  id: id("WH", i),
  code: ["BLR", "DEL", "BOM", "PNQ", "JAI", "HYD"][i % 6] + `-${(i % 2) + 1}`,
  city: ["Bengaluru", "Delhi", "Mumbai", "Pune", "Jaipur", "Hyderabad"][i % 6],
  synthetic: true,
}));
const orders = Array.from({ length: 1500 }, (_, i) => ({
  id: id("ORD", i),
  customerId: customers[Math.floor(random() * customers.length)].id,
  totalInr: Math.round(699 + random() * 45000),
  status: pick(["paid", "shipped", "delivered", "cancelled"]),
  placedAt: new Date(Date.UTC(2026, 5, 1) + i * 1800000).toISOString(),
  synthetic: true,
}));
const orderItems = Array.from({ length: 2500 }, (_, i) => {
  const order = orders[i % orders.length];
  const product = products[Math.floor(random() * products.length)];
  return {
    id: id("ITM", i),
    orderId: order.id,
    productId: product.id,
    quantity: random() > 0.9 ? 2 : 1,
    unitPriceInr: product.priceInr,
    synthetic: true,
  };
});
const payments = orders.map((order, i) => ({
  id: id("PAY", i),
  orderId: order.id,
  amountInr: order.totalInr,
  status: i % 97 === 0 ? "duplicate_capture" : "captured",
  synthetic: true,
}));
const shipments = orders.map((order, i) => ({
  id: id("SHP", i),
  orderId: order.id,
  status: i % 19 === 0 ? "delayed" : i % 53 === 0 ? "lost" : pick(statuses),
  promisedAt: new Date(Date.UTC(2026, 6, 1) + i * 1900000).toISOString(),
  synthetic: true,
}));
const shipmentEvents = Array.from({ length: 8000 }, (_, i) => {
  const shipment = shipments[i % shipments.length];
  return {
    id: id("EVT", i),
    shipmentId: shipment.id,
    code: pick(statuses),
    location: pick(warehouses).city,
    occurredAt: new Date(Date.UTC(2026, 5, 1) + i * 240000).toISOString(),
    synthetic: true,
  };
});
const inventory = Array.from({ length: 600 }, (_, i) => ({
  id: id("INV", i),
  productId: products[i % products.length].id,
  warehouseId: warehouses[i % warehouses.length].id,
  available: Math.floor(random() * 35),
  reserved: Math.floor(random() * 5),
  synthetic: true,
}));
const tickets = Array.from({ length: 250 }, (_, i) => ({
  id: id("TKT", i),
  orderId: orders[(i * 5) % orders.length].id,
  customerId: orders[(i * 5) % orders.length].customerId,
  incident: incidents[i % incidents.length],
  urgency: pick(["low", "medium", "high", "critical"]),
  status: pick(["open", "running", "approval", "resolved"]),
  message: `Synthetic ${incidents[i % incidents.length].toLowerCase().replaceAll("_", " ")} case ${i + 1}`,
  synthetic: true,
}));
const ticketMessages = Array.from({ length: 600 }, (_, i) => ({
  id: id("MSG", i),
  ticketId: tickets[i % tickets.length].id,
  author: i % 2 ? "support" : "customer",
  body: `Deterministic synthetic message ${i + 1}`,
  synthetic: true,
}));
const refunds = Array.from({ length: 100 }, (_, i) => ({
  id: id("RF", i),
  orderId: orders[i * 7].id,
  amountInr: Math.round(300 + random() * 9000),
  status: "verified",
  synthetic: true,
}));
const replacementOrders = Array.from({ length: 100 }, (_, i) => ({
  id: id("RPL", i),
  originalOrderId: orders[i * 9].id,
  status: "created",
  synthetic: true,
}));
const policies = Array.from({ length: 20 }, (_, i) => ({
  id: `P-${String(i + 1).padStart(2, "0")}`,
  version: `1.${i + 1}`,
  clause: `§${(i % 5) + 1}.${(i % 4) + 1}`,
  synthetic: true,
}));
const auditEvents = Array.from({ length: 1000 }, (_, i) => ({
  id: id("AUD", i),
  actor: i % 4 ? "agent" : "operator",
  action: pick(["tool.called", "policy.checked", "action.executed", "state.verified"]),
  at: new Date(Date.UTC(2026, 6, 1) + i * 60000).toISOString(),
  synthetic: true,
}));
const operationalBudgets = Array.from({ length: 14 }, (_, i) => ({
  id: id("BGT", i),
  date: new Date(Date.UTC(2026, 6, i + 1)).toISOString().slice(0, 10),
  limitInr: 20000,
  consumedInr: Math.round(random() * 18000),
  synthetic: true,
}));
const evaluationCases = Array.from({ length: 40 }, (_, i) => ({
  id: `EV-${String(i + 1).padStart(2, "0")}`,
  incident: incidents[i % incidents.length],
  expectedAction: pick([
    "PRIORITY_REPLACEMENT",
    "FULL_REFUND",
    "COURIER_INVESTIGATION",
    "HUMAN_ESCALATION",
  ]),
  synthetic: true,
}));

const output = {
  metadata: {
    seed: 20260717,
    generatedAt: "2026-07-17T00:00:00.000Z",
    license: "CC0 synthetic data",
    authoritative: true,
  },
  customers,
  products,
  warehouses,
  orders,
  orderItems,
  payments,
  shipments,
  shipmentEvents,
  inventory,
  tickets,
  ticketMessages,
  refunds,
  replacementOrders,
  policies,
  auditEvents,
  operationalBudgets,
  evaluationCases,
};
mkdirSync(join(process.cwd(), "data"), { recursive: true });
writeFileSync(join(process.cwd(), "data", "demo-seed.json"), JSON.stringify(output));
writeFileSync(
  join(process.cwd(), "data", "dataset-summary.json"),
  JSON.stringify(
    {
      metadata: output.metadata,
      counts: {
        customers: customers.length,
        products: products.length,
        warehouses: warehouses.length,
        orders: orders.length,
        orderItems: orderItems.length,
        payments: payments.length,
        shipments: shipments.length,
        shipmentEvents: shipmentEvents.length,
        inventory: inventory.length,
        tickets: tickets.length,
        ticketMessages: ticketMessages.length,
        refunds: refunds.length,
        replacementOrders: replacementOrders.length,
        policies: policies.length,
        auditEvents: auditEvents.length,
        operationalBudgets: operationalBudgets.length,
        evaluationCases: evaluationCases.length,
      },
    },
    null,
    2
  )
);
console.log("ResolveX synthetic dataset generated with fixed seed 20260717.");
