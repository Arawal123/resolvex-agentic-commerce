import { beforeEach, describe, expect, it } from "vitest";
import { runAgent } from "@/lib/agent/controller";
import { resetSandboxState, toolRegistry, type ToolContext } from "@/lib/tools/registry";

const context: ToolContext = {
  role: "agent",
  permissions: ["support:read", "operations:write", "finance:write", "verify:read"],
};

describe("typed tool controller", () => {
  beforeEach(() => resetSandboxState());

  it("rejects invalid tool inputs with Zod", async () => {
    await expect(
      toolRegistry.reserveInventory.call({ ticketId: "TKT-1042", quantity: 0 }, context)
    ).rejects.toThrow();
  });

  it("enforces tool permissions", async () => {
    const result = await toolRegistry.createCoupon.call(
      { ticketId: "TKT-1042", amount: 300 },
      { role: "auditor", permissions: ["support:read"] }
    );
    expect(result.code).toBe("PERMISSION_DENIED");
  });

  it("returns the same receipt for an idempotent replacement", async () => {
    const input = { ticketId: "TKT-1042", orderId: "ORD-88419", priority: true };
    const first = await toolRegistry.createReplacementOrder.call(input, {
      ...context,
      idempotencyKey: "same",
    });
    const second = await toolRegistry.createReplacementOrder.call(input, {
      ...context,
      idempotencyKey: "same",
    });
    expect(second.auditId).toBe(first.auditId);
  });

  it("runs a closed loop and independently verifies state", async () => {
    const record = await runAgent("TKT-1042");
    expect(record.finalAction).toBe("PRIORITY_REPLACEMENT");
    expect(record.toolCalls.length).toBeGreaterThan(10);
    expect(record.verification.every((item) => item.passed)).toBe(true);
    expect(record.evidence.every((item) => Boolean(item.sourceLabel))).toBe(true);
  });
});
