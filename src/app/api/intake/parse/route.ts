import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { parseManualIntake } from "@/lib/intake/gemini";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const result = await parseManualIntake(await request.json());
    return NextResponse.json({
      ok: true,
      configured: Boolean(process.env.GEMINI_API_KEY) && process.env.GEMINI_DISABLED !== "true",
      result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        code: error instanceof ZodError ? "INVALID_INTAKE" : "INTAKE_PARSE_FAILED",
        message: error instanceof Error ? error.message : "The intake could not be parsed.",
        issues: error instanceof ZodError ? error.issues : undefined,
      },
      { status: error instanceof ZodError ? 400 : 502 }
    );
  }
}
