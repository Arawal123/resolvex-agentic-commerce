import { getOrCreateDecision } from "@/lib/agent/controller";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return Response.json({ ok: true, decision: await getOrCreateDecision(id) });
}
