import type { ReactNode } from "react";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

export function PublicShell({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro: string; children: ReactNode }) {
  return (
    <main>
      <SiteHeader />
      <section className="page-hero">
        <div className="shell page-hero-grid">
          <div>
            <div className="eyebrow">{eyebrow}</div>
            <h1>{title}</h1>
          </div>
          <p>{intro}</p>
        </div>
      </section>
      {children}
      <SiteFooter />
    </main>
  );
}

export function CtaBand() {
  return (
    <section className="cta-band">
      <div className="shell cta-band-inner">
        <div><div className="eyebrow">Ready to diagnose it properly?</div><h2>Start with the complaint. Finish with evidence.</h2></div>
        <a className="button" href="/request-service">Request Service</a>
      </div>
    </section>
  );
}
