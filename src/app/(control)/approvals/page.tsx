import { AlertTriangle, ArrowRight, CircleDollarSign, ShieldCheck } from "lucide-react";
import { ApprovalActions } from "@/components/approvals/approval-actions";
import { PageTitle } from "@/components/app-shell";
import { Reveal } from "@/components/ui/reveal";

export default function ApprovalsPage() {
  return (
    <div className="page-canvas">
      <Reveal>
        <PageTitle
          eyebrow="HUMAN OVERSIGHT · 6 PENDING"
          title="Authority has an edge."
          description="High-impact actions stop here—with the exact reason, evidence, policy boundary, and financial effect required for an informed intervention."
        />
      </Reveal>
      <Reveal delay={0.1} className="approval-portal">
        <div className="approval-reason">
          <div className="risk-sigil">
            <ShieldCheck />
          </div>
          <div>
            <span>APR-1038 · FINANCIAL REMEDY</span>
            <h2>₹12,450 duplicate-charge refund</h2>
            <p>
              The payment ledger confirms two captures, but P-05 §2.1 limits autonomous refunds to
              ₹5,000 in bounded mode.
            </p>
          </div>
          <div className="risk-tier">
            <small>RISK TIER</small>
            <strong>H2</strong>
            <span>HUMAN REQUIRED</span>
          </div>
        </div>
        <div className="approval-evidence">
          <article>
            <span>EVIDENCE</span>
            <strong>2 captures · same order · same amount</strong>
            <small>E-12 · Payment ledger / PAY-88271</small>
          </article>
          <ArrowRight />
          <article>
            <span>POLICY BOUNDARY</span>
            <strong>₹7,450 above autonomous limit</strong>
            <small>P-05 §2.1 · Financial Remedies v3.7</small>
          </article>
          <ArrowRight />
          <article>
            <span>PROPOSED ACTION</span>
            <strong>Full duplicate reversal</strong>
            <small>A-02 · utility 0.944 · policy-valid with approval</small>
          </article>
        </div>
        <div className="financial-impact">
          <CircleDollarSign />
          <div>
            <span>FINANCIAL EFFECT</span>
            <strong>−₹12,450 customer refund</strong>
            <small>No compensation-budget impact · original payment method</small>
          </div>
          <div>
            <AlertTriangle />
            <span>Execution has not occurred</span>
          </div>
        </div>
        <ApprovalActions approvalId="APR-1038" />
      </Reveal>
      <Reveal delay={0.18} className="approval-queue-mini">
        <div>
          <span>APR-1014</span>
          <strong>Low-confidence lost shipment</strong>
          <em>critical evidence missing</em>
        </div>
        <div>
          <span>APR-1008</span>
          <strong>Repeat-abuse anomaly</strong>
          <em>fraud review</em>
        </div>
        <div>
          <span>APR-0996</span>
          <strong>₹8,999 damaged-item refund</strong>
          <em>monetary threshold</em>
        </div>
      </Reveal>
    </div>
  );
}
