import type { ReactNode } from "react";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

export function PublicShell({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro: string; children: ReactNode }) {
  return (
    <main className="public-site">
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
        <div>
          <div className="eyebrow">Need service?</div>
          <h2>Send the vehicle details for review.</h2>
          <p>The request form keeps the complaint, location and vehicle information together.</p>
        </div>
        <a className="button" href="/request-service">Request Service</a>
      </div>
    </section>
  );
}
