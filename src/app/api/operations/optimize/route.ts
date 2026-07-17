import { z } from "zod";
import { tickets } from "@/lib/demo-data";
import { optimizeBatch } from "@/lib/optimization/batch-optimizer";

export async function POST(request: Request) {
  const input = z
    .object({
      objective: z.string().min(3),
      budget: z.number().int().positive().max(100000),
      inventory: z.number().int().nonnegative().max(1000),
    })
    .parse(await request.json());
  const plan = optimizeBatch({
    tickets: tickets.filter((ticket) => ticket.status !== "resolved"),
    budget: input.budget,
    inventory: input.inventory,
  });
  return Response.json({
    ok: true,
    objective: input.objective,
    requiresApproval: input.budget > 20000 || plan.compensationUsed > 10000,
    plan,
    alternatives: [
      {
        label: "Budget −20%",
        plan: optimizeBatch({
          tickets,
          budget: Math.round(input.budget * 0.8),
          inventory: input.inventory,
        }),
      },
      {
        label: "Inventory +5",
        plan: optimizeBatch({ tickets, budget: input.budget, inventory: input.inventory + 5 }),
      },
    ],
  });
}
