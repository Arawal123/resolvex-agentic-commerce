export async function GET() {
  const databaseConfigured = Boolean(process.env.DATABASE_URL);
  return Response.json({
    status: "healthy",
    ready: true,
    database: databaseConfigured ? "configured" : "sandbox-fallback",
    model: process.env.OPENAI_API_KEY ? "configured" : "deterministic-sandbox",
    timestamp: new Date().toISOString(),
  });
}
