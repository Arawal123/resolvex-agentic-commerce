import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { createCaseRequestSchema } from "@/lib/intake/schema";
import { createManualTicket, listTickets } from "@/lib/tickets/repository";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ ok: true, tickets: await listTickets() });
}

export async function POST(request: Request) {
  try {
    const input = createCaseRequestSchema.parse(await request.json());
    const ticket = await createManualTicket(input.draft, input.parseMetadata);
    revalidatePath("/tickets");
    return NextResponse.json({ ok: true, ticket }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        code: error instanceof ZodError ? "INCOMPLETE_CASE" : "CASE_CREATE_FAILED",
        message: error instanceof Error ? error.message : "The case could not be created.",
        issues: error instanceof ZodError ? error.issues : undefined,
      },
      { status: error instanceof ZodError ? 400 : 500 }
    );
  }
}
