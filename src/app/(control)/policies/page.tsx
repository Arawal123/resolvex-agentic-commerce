import { BookMarked, Braces, GitBranch, Search } from "lucide-react";
import { PageTitle } from "@/components/app-shell";
import { Reveal } from "@/components/ui/reveal";
import { policies } from "@/lib/demo-data";

export default function PoliciesPage() {
  return (
    <div className="page-canvas">
      <Reveal>
        <PageTitle
          eyebrow="POLICY LIBRARY · 20 ACTIVE DOCUMENTS"
          title="Rules the machine cannot negotiate."
          description="Human-readable language and machine-evaluable conditions share one versioned source of truth."
        />
      </Reveal>
      <Reveal delay={0.08} className="policy-search">
        <Search />
        <input aria-label="Search policies" placeholder="Search clause, action, threshold…" />
        <span>POLICY SET 2026.07 · SIGNED</span>
      </Reveal>
      <Reveal delay={0.14} className="policy-library">
        {policies.map((policy, index) => (
          <article key={policy.id}>
            <div className="policy-number">{String(index + 1).padStart(2, "0")}</div>
            <div className="policy-copy">
              <span>
                {policy.id} · VERSION {policy.version} · {policy.status}
              </span>
              <h2>{policy.title}</h2>
              <p>
                <b>{policy.clause}</b> {policy.text}
              </p>
              <div>
                <span>
                  <BookMarked /> Human language
                </span>
                <span>
                  <Braces /> Machine rule
                </span>
                <span>
                  <GitBranch /> Version history
                </span>
              </div>
            </div>
            <div className="policy-rule">
              <span>WHEN</span>
              <code>
                {index === 0
                  ? "inactiveDays >= 5 && inventory > 0"
                  : index === 1
                    ? "refundAmount > autonomousLimit"
                    : "evidence.complete === true"}
              </code>
              <span>THEN</span>
              <code>{index === 1 ? "requireApproval(HUMAN)" : "permit(resolutionAction)"}</code>
            </div>
          </article>
        ))}
      </Reveal>
    </div>
  );
}
