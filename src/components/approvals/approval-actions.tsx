"use client";

import { useState } from "react";
import { Check, PenLine, X } from "lucide-react";

export function ApprovalActions({ approvalId }: { approvalId: string }) {
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("");
  async function act(action: "approve" | "reject" | "modify") {
    const response = await fetch(`/api/approvals/${approvalId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, note }),
    });
    const data = await response.json();
    setStatus(data.status);
  }
  if (status)
    return (
      <div className="approval-complete">
        <Check />
        Decision {status}. Agent resume event recorded.
      </div>
    );
  return (
    <div className="approval-actions">
      <textarea
        aria-label="Operator note"
        placeholder="Add operator note (optional)"
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
      <div>
        <button className="reject" onClick={() => act("reject")}>
          <X size={14} /> Reject
        </button>
        <button onClick={() => act("modify")}>
          <PenLine size={14} /> Modify
        </button>
        <button className="approve" onClick={() => act("approve")}>
          <Check size={14} /> Approve & resume
        </button>
      </div>
    </div>
  );
}
