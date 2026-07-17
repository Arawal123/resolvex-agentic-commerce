import Link from "next/link";
import { ArrowUpRight, Filter, Plus, Search, SlidersHorizontal } from "lucide-react";
import { PageTitle } from "@/components/app-shell";
import { Reveal } from "@/components/ui/reveal";
import { listTickets } from "@/lib/tickets/repository";

export const dynamic = "force-dynamic";

export default async function TicketsPage() {
  const tickets = await listTickets();
  return (
    <div className="page-canvas">
      <Reveal>
        <PageTitle
          eyebrow={`CASE INTAKE · ${tickets.length} VISIBLE`}
          title="Human problems, machine clarity."
          description="Priority-ranked incidents with policy, SLA, and approval context visible before the agent moves."
        >
          <Link href="/intake" className="intake-launch">
            <Plus size={16} /> New manual case
          </Link>
        </PageTitle>
      </Reveal>
      <Reveal delay={0.08} className="queue-controls">
        <label>
          <Search size={16} />
          <input aria-label="Search tickets" placeholder="Search case, customer, order…" />
        </label>
        <button>
          <Filter size={15} /> Incident: All
        </button>
        <button>
          <SlidersHorizontal size={15} /> SLA risk
        </button>
        <span>LIVE QUEUE · UPDATED NOW</span>
      </Reveal>
      <Reveal delay={0.14} className="ticket-constellation">
        {tickets.map((ticket, index) => (
          <Link href={`/tickets/${ticket.id}`} key={ticket.id} className="ticket-line">
            <div className="ticket-ordinal">{String(index + 1).padStart(2, "0")}</div>
            <div className="ticket-main">
              <div>
                <span>
                  {ticket.id} · {ticket.orderId}
                </span>
                <h2>{ticket.subject}</h2>
                <p>
                  {ticket.customerName} · {ticket.message}
                </p>
              </div>
              <div className="ticket-tags">
                <span>{ticket.incident.replaceAll("_", " ")}</span>
                <span className={ticket.urgency}>{ticket.urgency}</span>
                <span>{ticket.source === "manual" ? "MANUAL INTAKE" : ticket.status}</span>
              </div>
            </div>
            <div className="ticket-risk">
              <span>SLA WINDOW</span>
              <strong>{ticket.slaHours}h</strong>
              <small>churn {Math.round(ticket.churnRisk * 100)}%</small>
            </div>
            <ArrowUpRight />
          </Link>
        ))}
      </Reveal>
    </div>
  );
}
