"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  Activity,
  BarChart3,
  BookOpen,
  BrainCircuit,
  Gauge,
  Menu,
  Network,
  Settings,
  ShieldCheck,
  TicketCheck,
  X,
  Zap,
} from "lucide-react";

const nav = [
  { href: "/dashboard", label: "Command", icon: Gauge },
  { href: "/tickets", label: "Cases", icon: TicketCheck },
  { href: "/operations", label: "Optimizer", icon: Network },
  { href: "/approvals", label: "Oversight", icon: ShieldCheck },
  { href: "/policies", label: "Policy", icon: BookOpen },
  { href: "/evaluations", label: "Evaluation", icon: BarChart3 },
  { href: "/settings", label: "Control", icon: Settings },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState({ x: 50, y: 20 });
  useEffect(() => {
    const move = (event: PointerEvent) =>
      setCursor({ x: (event.clientX / innerWidth) * 100, y: (event.clientY / innerHeight) * 100 });
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, []);
  return (
    <div
      className="app-world"
      style={{ "--cursor-x": `${cursor.x}%`, "--cursor-y": `${cursor.y}%` } as React.CSSProperties}
    >
      <div className="noise" aria-hidden="true" />
      <div className="cursor-light" aria-hidden="true" />
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <div className="brand-lockup">
          <div className="brand-glyph">
            <BrainCircuit size={20} />
          </div>
          <div>
            <strong>
              RESOLVE<span>X</span>
            </strong>
            <small>CONTROL PLANE</small>
          </div>
        </div>
        <nav aria-label="Primary navigation">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={active ? "nav-link active" : "nav-link"}
                onClick={() => setOpen(false)}
              >
                <Icon size={17} />
                <span>{item.label}</span>
                {active && <i />}
              </Link>
            );
          })}
        </nav>
        <div className="runtime-card">
          <div className="runtime-orbit">
            <Activity size={14} />
          </div>
          <div>
            <span>DETERMINISTIC SANDBOX</span>
            <small>No model call · auditable</small>
          </div>
        </div>
      </aside>
      <main className="app-main">
        <header className="topbar">
          <button
            className="mobile-menu"
            onClick={() => setOpen(!open)}
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <X /> : <Menu />}
          </button>
          <div className="system-status">
            <span className="pulse-dot" />
            SYSTEM COHERENT <em>·</em> POLICY 2026.07
          </div>
          <Link href="/tickets/TKT-1042" className="judge-link">
            <Zap size={14} /> Guided judge demo
          </Link>
        </header>
        {children}
      </main>
    </div>
  );
}

export function PageTitle({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </div>
  );
}
