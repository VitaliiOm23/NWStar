"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import styles from "./RoFlexEnhancer.module.css";

export function RoFlexEnhancer() {
  const pathname = usePathname();
  const router = useRouter();
  const repairOrderId = useMemo(() => {
    const match = pathname.match(/^\/(?:admin\/repair-orders|tech\/repair-orders)\/([^/]+)$/);
    return match?.[1] || null;
  }, [pathname]);
  const canManageDiagnostic = /^\/admin\/repair-orders\/[^/]+$/.test(pathname);

  const [rate, setRate] = useState<number | null>(null);
  const [added, setAdded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!repairOrderId) return;

    const relaxValidation = () => {
      document.querySelectorAll(".ro-detail-page form, .tech-ro-page form").forEach((form) => {
        (form as HTMLFormElement).noValidate = true;
        form.querySelectorAll("[required]").forEach((field) => field.removeAttribute("required"));
      });
    };

    relaxValidation();
    const observer = new MutationObserver(relaxValidation);
    observer.observe(document.body, { childList: true, subtree: true });

    if (!canManageDiagnostic) {
      return () => observer.disconnect();
    }

    let cancelled = false;
    fetch(`/api/repair-orders/basic-diagnostic?repairOrderId=${encodeURIComponent(repairOrderId)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load diagnostic charge.");
        return response.json();
      })
      .then((data) => {
        if (cancelled) return;
        setRate(Number(data.rate || 100));
        setAdded(Boolean(data.added));
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load diagnostic charge.");
      });

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [repairOrderId, canManageDiagnostic]);

  if (!repairOrderId || !canManageDiagnostic) return null;

  async function addBasicDiagnostic() {
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
      setRate(Number(data.rate || rate || 100));
      setAdded(true);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not add diagnostic charge.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className={styles.panel} aria-label="Basic diagnostic charge">
      <div className={styles.top}>
        <div>
          <span className={styles.label}>Customer starting charge</span>
          <div className={styles.title}>Basic diagnostic</div>
        </div>
        <div className={styles.price}>${Number(rate ?? 100).toFixed(0)}</div>
      </div>
      <p className={styles.copy}>
        Initial diagnostic charge. If the problem needs more diagnostic time, add that time separately after discussing it with the customer.
      </p>
      <button className={styles.button} type="button" disabled={busy || added} onClick={addBasicDiagnostic}>
        {added ? "Basic diagnostic added" : busy ? "Adding…" : "Add basic diagnostic to RO"}
      </button>
      {error ? <span className={styles.error}>{error}</span> : null}
    </aside>
  );
}
