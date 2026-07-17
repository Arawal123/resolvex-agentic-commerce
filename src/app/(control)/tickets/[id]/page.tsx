import { notFound } from "next/navigation";
import { ArrowLeft, Box, CalendarClock, MapPin, PackageCheck, Star, UserRound } from "lucide-react";
import Link from "next/link";
import { AgentRunPanel } from "@/components/agent/agent-run-panel";
import { Reveal } from "@/components/ui/reveal";
import { tickets } from "@/lib/demo-data";

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ticket = tickets.find((item) => item.id === id);
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
      <div className="case-layout">
        <Reveal delay={0.08} className="case-context">
          <section>
            <div className="context-title">
              <UserRound />
              <span>CUSTOMER SIGNAL</span>
            </div>
            <h2>{ticket.customerName}</h2>
            <p>Black tier customer · 17 lifetime orders · low anomaly risk</p>
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
            <p>Last carrier scan · synthetic authoritative demo dataset</p>
            <div className="route-line">
              <span>
                <PackageCheck /> Jaipur FC
              </span>
              <i />
              <span>
                <MapPin /> Pune Hub
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
              <small>CUSTOMER · 09:14</small>
              <p>{ticket.message}</p>
            </div>
            <div className="system-message">
              <small>RESOLVEX INTAKE · 09:14</small>
              <p>
                Goal extracted: preserve product outcome. Constraint detected: delivery deadline.
                Missing evidence will be retrieved through allowlisted tools.
              </p>
            </div>
          </section>
        </Reveal>
        <Reveal delay={0.16}>
          <AgentRunPanel ticket={ticket} />
        </Reveal>
      </div>
    </div>
  );
}
