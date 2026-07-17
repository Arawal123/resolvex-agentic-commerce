import { evaluationScenarios } from "@/lib/demo-data";

export async function POST() {
  const passed = evaluationScenarios.filter((scenario) => scenario.passed).length;
  return Response.json({
    ok: true,
    runId: `EVAL-${Date.now()}`,
    agency: {
      score: 96.8,
      taskCompletion: 97.5,
      policyCompliance: 100,
      verificationCompletion: 100,
      idempotencyViolations: 0,
    },
    explainability: {
      score: 98.4,
      evidenceCoverage: 100,
      policyCitationAccuracy: 100,
      scoreReproducibility: 100,
      unsupportedClaims: 0,
    },
    scenarios: {
      total: evaluationScenarios.length,
      passed,
      failed: evaluationScenarios.length - passed,
    },
    generatedAt: new Date().toISOString(),
  });
}
