import { notFound } from "next/navigation";
import { ArrowLeft, Box, CalendarClock, MapPin, PackageCheck, Star, UserRound } from "lucide-react";
import Link from "next/link";
import { AgentRunPanel } from "@/components/agent/agent-run-panel";
import { Reveal } from "@/components/ui/reveal";
import { getTicket } from "@/lib/tickets/repository";

export const dynamic = "force-dynamic";

export default async function TicketDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ autorun?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const ticket = await getTicket(id);
  if (!ticket) notFound();
  return (
    <div className="page-canvas ticket-detail">
      <Reveal>
        <Link className="back-link" href="/tickets">
          <ArrowLeft size={14} /> Return to case field
        </Link>
        <div className="case-hero">
          <div>
            <span>
              {ticket.id} · {ticket.incident.replaceAll("_", " ")}
            </span>
            <h1>{ticket.subject}</h1>
            <p>“{ticket.message}”</p>
            <div>
              <span className={ticket.urgency}>{ticket.urgency} priority</span>
              <span>{ticket.slaHours}h SLA window</span>
              <span>{ticket.status}</span>
            </div>
          </div>
          <div className="case-coordinates">
            <span>ORDER VALUE</span>
            <strong>₹{ticket.orderValue.toLocaleString("en-IN")}</strong>
            <small>{ticket.orderId}</small>
          </div>
        </div>
      </Reveal>
      <div className="case-layout dual-case-layout">
        <Reveal delay={0.08} className="case-context">
          <section>
            <div className="context-title">
              <UserRound />
              <span>CUSTOMER SIGNAL</span>
            </div>
            <h2>{ticket.customerName}</h2>
            <p>
              {ticket.source === "manual"
                ? "Operator-reviewed manual intake"
                : "Black tier customer · synthetic fixture"}
            </p>
            <div className="context-stats">
              <span>
                <Star /> Priority <b>{Math.round(ticket.priority * 100)}</b>
              </span>
              <span>
                <CalendarClock /> Churn risk <b>{Math.round(ticket.churnRisk * 100)}%</b>
              </span>
            </div>
          </section>
          <section>
            <div className="context-title">
              <Box />
              <span>FULFILLMENT STATE</span>
            </div>
            <h2>{ticket.trackingStatus}</h2>
            <p>Last reviewed operational snapshot · typed sandbox evidence</p>
            <div className="route-line">
              <span>
                <PackageCheck /> Fulfillment
              </span>
              <i />
              <span>
                <MapPin /> Carrier
              </span>
              <i className="failed" />
              <span>Customer</span>
            </div>
          </section>
          <section className="conversation">
            <div className="context-title">
              <span>CONVERSATION</span>
            </div>
            <div>
              <small>CUSTOMER · INTAKE</small>
              <p>{ticket.message}</p>
            </div>
            <div className="system-message">
              <small>RESOLVEX · REVIEWED FACTS</small>
              <p>
                Goal: {ticket.requestedOutcome}. Incident:{" "}
                {ticket.incident.replaceAll("_", " ").toLowerCase()}. The controller can use only
                allowlisted, schema-validated tools.
              </p>
            </div>
          </section>
        </Reveal>
        <Reveal delay={0.16}>
          <AgentRunPanel ticket={ticket} autoStart={query.autorun === "1"} />
        </Reveal>
      </div>
    </div>
  );
}
