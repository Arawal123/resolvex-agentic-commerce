import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Coins,
  Gauge,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";
import { PageTitle } from "@/components/app-shell";
import { Reveal } from "@/components/ui/reveal";
import { operationalMetrics } from "@/lib/demo-data";
import { listTickets } from "@/lib/tickets/repository";

const metrics = [
  {
    label: "Open cases",
    value: operationalMetrics.openTickets,
    unit: "live",
    icon: Gauge,
    tone: "amber",
  },
  {
    label: "Autonomously resolved",
    value: operationalMetrics.autonomousResolved,
    unit: "this week",
    icon: Sparkles,
    tone: "cyan",
  },
  {
    label: "Pending oversight",
    value: operationalMetrics.pendingApprovals,
    unit: "actionable",
    icon: ShieldCheck,
    tone: "violet",
  },
  {
    label: "Median resolution",
    value: operationalMetrics.avgResolutionMinutes,
    unit: "minutes",
    icon: Clock3,
    tone: "green",
  },
];

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const tickets = await listTickets();
  return (
    <div className="page-canvas dashboard-canvas">
      <Reveal>
        <PageTitle
          eyebrow="EXECUTIVE COMMAND · 17 JUL 2026"
          title="The operation is thinking."
          description="A live view of autonomous resolution, operational risk, and the proof behind every machine decision."
        />
      </Reveal>
      <Reveal delay={0.08} className="command-hero">
        <div className="command-core">
          <div className="core-rings">
            <i />
            <i />
            <i />
            <div>
              <b>96.8</b>
              <span>agency score</span>
            </div>
          </div>
          <div className="command-copy">
            <span>CONTROL PLANE STATUS</span>
            <h2>
              186 customer outcomes.
              <br />
              <em>Zero invisible decisions.</em>
            </h2>
            <p>
              Every autonomous action this week has a reproducible score, policy citation, tool
              receipt, and independent verification.
            </p>
            <div>
              <span>
                <CheckCircle2 /> 100% policy compliant
              </span>
              <span>
                <Wrench /> 99.2% tool success
              </span>
              <span>
                <ShieldCheck /> 100% verified
              </span>
            </div>
          </div>
        </div>
        <div className="throughput-spark">
          <span>RESOLUTION THROUGHPUT · 24H</span>
          <div>
            {[22, 38, 31, 54, 45, 64, 58, 76, 68, 84, 72, 92].map((height, index) => (
              <i key={index} style={{ height: `${height}%` }} />
            ))}
          </div>
          <p>
            <b>+18.4%</b> against prior 24 hours
          </p>
        </div>
      </Reveal>
      <Reveal delay={0.14} className="metric-ribbon">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <article key={metric.label} className={metric.tone}>
              <div>
                <Icon size={16} />
                <span>{metric.label}</span>
              </div>
              <strong>{metric.value}</strong>
              <small>{metric.unit}</small>
            </article>
          );
        })}
      </Reveal>
      <div className="dashboard-split">
        <Reveal delay={0.2} className="recent-runs">
          <div className="panel-title">
            <div>
              <span>RECENT AUTONOMOUS RUNS</span>
              <h3>Decision stream</h3>
            </div>
            <Link href="/tickets">
              Open queue <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="run-table">
            {tickets.slice(0, 4).map((ticket, index) => (
              <Link href={`/tickets/${ticket.id}`} key={ticket.id}>
                <span className={`run-state ${ticket.status}`}>
                  <i />
                </span>
                <div>
                  <strong>{ticket.subject}</strong>
                  <small>
                    {ticket.id} · {ticket.customerName}
                  </small>
                </div>
                <b>{ticket.incident.replaceAll("_", " ")}</b>
                <em>{index === 0 ? "ready" : ticket.status}</em>
                <ArrowUpRight size={14} />
              </Link>
            ))}
          </div>
        </Reveal>
        <Reveal delay={0.26} className="alert-stack">
          <div className="panel-title">
            <div>
              <span>OPERATIONAL SIGNALS</span>
              <h3>Attention field</h3>
            </div>
            <AlertTriangle size={18} />
          </div>
          <article className="signal high">
            <span>01</span>
            <div>
              <strong>Courier NCR-4 degradation</strong>
              <p>18 delayed shipments share a hub transition failure.</p>
            </div>
            <b>HIGH</b>
          </article>
          <article className="signal">
            <span>02</span>
            <div>
              <strong>Compensation runway</strong>
              <p>₹7,160 remains in today’s autonomous budget.</p>
            </div>
            <Coins size={16} />
          </article>
          <article className="signal">
            <span>03</span>
            <div>
              <strong>Inventory pressure</strong>
              <p>SKU-A91 replacement pool falls below 5 units.</p>
            </div>
            <b>WATCH</b>
          </article>
        </Reveal>
      </div>
    </div>
  );
}
