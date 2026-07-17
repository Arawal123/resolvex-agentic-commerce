import { z } from "zod";
import { getOrCreateDecision } from "@/lib/agent/controller";
import { answerDecisionQuestion } from "@/lib/agent/interrogate";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { decisionId, question } = z
    .object({ decisionId: z.string(), question: z.string().min(3).max(500) })
    .parse(await request.json());
  const decision = await getOrCreateDecision(decisionId);
  return Response.json({
    ok: true,
    answer: answerDecisionQuestion(decision, question),
    groundedIn: {
      evidence: decision.evidence.map((item) => item.id),
      tools: decision.toolCalls.map((item) => item.id),
    },
  });
}
