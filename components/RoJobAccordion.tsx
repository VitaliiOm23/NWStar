"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

const AccordionContext = createContext<{
  openId: string | null;
  setOpenId: (id: string | null) => void;
} | null>(null);

export function RoJobAccordion({ children }: { children: ReactNode }) {
  const [openId, setOpenId] = useState<string | null>(null);
  return <AccordionContext.Provider value={{ openId, setOpenId }}>{children}</AccordionContext.Provider>;
}

export function RoJobAccordionItem({
  id,
  summary,
  children,
}: {
  id: string;
  summary: ReactNode;
  children: ReactNode;
}) {
  const context = useContext(AccordionContext);
  if (!context) throw new Error("RoJobAccordionItem must be used inside RoJobAccordion");

  const open = context.openId === id;
  return (
    <section className={`ro-job-accordion-item${open ? " open" : ""}`}>
      <button
        className="ro-job-accordion-summary"
        type="button"
        aria-expanded={open}
        onClick={() => context.setOpenId(open ? null : id)}
      >
        {summary}
        <span className="ro-job-chevron" aria-hidden="true">⌄</span>
      </button>
      {open ? <div className="ro-job-accordion-body">{children}</div> : null}
    </section>
  );
}
