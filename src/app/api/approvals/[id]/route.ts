import { z } from "zod";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const input = z
    .object({
      action: z.enum(["approve", "reject", "modify"]),
      note: z.string().max(1000).default(""),
    })
    .parse(await request.json());
  return Response.json({
    ok: true,
    approvalId: id,
    status:
      input.action === "approve" ? "approved" : input.action === "reject" ? "rejected" : "modified",
    operator: "demo-operator@resolvex.local",
    note: input.note,
    auditedAt: new Date().toISOString(),
  });
}
