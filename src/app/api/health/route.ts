export async function GET() {
  const databaseConfigured = Boolean(process.env.DATABASE_URL);
  return Response.json({
    status: "healthy",
    ready: true,
    database: databaseConfigured ? "configured" : "sandbox-fallback",
    intakeModel: process.env.GEMINI_API_KEY ? "gemini-configured" : "manual-entry-fallback",
    controller: "deterministic-sandbox",
    timestamp: new Date().toISOString(),
  });
}
