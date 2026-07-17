import { NextResponse } from "next/server";
import { z } from "zod";
import { runAgent } from "@/lib/agent/controller";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { ticketId } = z.object({ ticketId: z.string().min(1) }).parse(await request.json());
    return NextResponse.json({
      ok: true,
      mode: process.env.GEMINI_API_KEY
        ? "gemini-intake/deterministic-engine"
        : "deterministic-sandbox",
      decision: await runAgent(ticketId),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        code: "AGENT_RUN_FAILED",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 400 }
    );
  }
}
