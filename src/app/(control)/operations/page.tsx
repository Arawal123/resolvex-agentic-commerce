import { PageTitle } from "@/components/app-shell";
import { OptimizerPanel } from "@/components/operations/optimizer-panel";
import { Reveal } from "@/components/ui/reveal";

export default function OperationsPage() {
  return (
    <div className="page-canvas">
      <Reveal>
        <PageTitle
          eyebrow="OPERATIONS OPTIMIZER · GLOBAL ALLOCATION"
          title="Resolve the queue, not just the ticket."
          description="A constrained allocation engine balances customer outcomes against one shared budget, finite inventory, shipping capacity, and SLA risk."
        />
      </Reveal>
      <Reveal delay={0.1}>
        <OptimizerPanel />
      </Reveal>
    </div>
  );
}
