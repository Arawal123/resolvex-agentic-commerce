import { PageTitle } from "@/components/app-shell";
import { EvaluationRunner } from "@/components/evaluation/evaluation-runner";
import { Reveal } from "@/components/ui/reveal";
import { evaluationScenarios } from "@/lib/demo-data";

export default function EvaluationsPage() {
  return (
    <div className="page-canvas">
      <Reveal>
        <PageTitle
          eyebrow="EVALUATION CENTER · REGRESSION 026"
          title="Evidence over confidence."
          description="Two independent benchmark suites measure whether the agent truly acts, verifies, and explains—under forty known-outcome scenarios."
        />
      </Reveal>
      <Reveal delay={0.1}>
        <EvaluationRunner />
      </Reveal>
      <Reveal delay={0.18} className="scenario-matrix">
        <div className="scenario-head">
          <span>SCENARIO</span>
          <span>INCIDENT</span>
          <span>EXPECTED OUTCOME</span>
          <span>RESULT</span>
        </div>
        {evaluationScenarios.slice(0, 8).map((scenario) => (
          <div key={scenario.id}>
            <span>{scenario.id}</span>
            <strong>{scenario.name}</strong>
            <code>{scenario.expected}</code>
            <b className={scenario.passed ? "pass" : "fail"}>
              {scenario.passed ? "PASS" : "REGRESSION"}
            </b>
          </div>
        ))}
      </Reveal>
    </div>
  );
}
