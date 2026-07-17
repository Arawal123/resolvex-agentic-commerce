import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { DecisionStudio } from "@/components/decision/decision-studio";
import { getOrCreateDecision } from "@/lib/agent/controller";

export const dynamic = "force-dynamic";

export default async function DecisionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const decision = await getOrCreateDecision(id);
  return (
    <div className="page-canvas decision-page">
      <div className="studio-heading">
        <div>
          <Link className="back-link" href={`/tickets/${decision.ticketId}`}>
            <ArrowLeft size={14} /> Return to case
          </Link>
          <span className="eyebrow">DECISION STUDIO · {decision.id}</span>
          <h1>A decision you can challenge.</h1>
          <p>
            Observable facts, exact policies, scored alternatives, executed actions, and verified
            outcomes—without hidden chain-of-thought.
          </p>
        </div>
        <div className="version-stack">
          <span>{decision.versions.controller}</span>
          <span>{decision.versions.policy}</span>
          <span>{decision.versions.scoring}</span>
          <span>{decision.versions.model}</span>
        </div>
      </div>
      <DecisionStudio decision={decision} />
    </div>
  );
}
