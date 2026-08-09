"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function BasicDiagnosticButton({ repairOrderId, rate, added }: { repairOrderId: string; rate: number; added: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(added);
  const [error, setError] = useState("");

  async function addDiagnostic() {
    if (busy || done) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/repair-orders/basic-diagnostic", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ repairOrderId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not add diagnostic charge.");
      setDone(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not add diagnostic charge.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ro-inline-diagnostic">
      <div>
        <span>Starting diagnostic</span>
        <strong>${Number(rate || 100).toFixed(0)}</strong>
        <small>Additional diagnostic time is added only when needed.</small>
      </div>
      <button className="button" type="button" disabled={busy || done} onClick={addDiagnostic}>
        {done ? "Diagnostic added" : busy ? "Adding…" : "Add diagnostic"}
      </button>
      {error ? <small className="form-error">{error}</small> : null}
    </div>
  );
}
