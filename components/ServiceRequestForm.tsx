"use client";

import { FormEvent, useState } from "react";

type FormState = "idle" | "submitting" | "success" | "error";

export function ServiceRequestForm() {
  const [state, setState] = useState<FormState>("idle");
  const [message, setMessage] = useState("");
  const [reference, setReference] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("submitting");
    setMessage("");

    const form = event.currentTarget;
    const body = Object.fromEntries(new FormData(form).entries());

    try {
      const response = await fetch("/api/service-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();

      if (!response.ok) throw new Error(result.error || "Unable to submit request.");

      setReference(result.reference);
      setState("success");
      form.reset();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to submit request.");
      setState("error");
    }
  }

  if (state === "success") {
    return (
      <div className="form success-panel" role="status">
        <div className="eyebrow">Request received</div>
        <h2>Thank you. Your information is in the queue.</h2>
        <p className="section-copy">We will review the complaint and contact you to confirm scope, location and scheduling.</p>
        <div className="reference-box"><span>Reference</span><strong>{reference}</strong></div>
        <button className="button secondary" type="button" onClick={() => setState("idle")}>Submit another vehicle</button>
      </div>
    );
  }

  return (
    <form className="form" onSubmit={submit} noValidate>
      <div className="form-grid">
        <div className="field"><label htmlFor="fullName">Customer name *</label><input id="fullName" name="fullName" autoComplete="name" required minLength={2} maxLength={100} /></div>
        <div className="field"><label htmlFor="phone">Phone *</label><input id="phone" name="phone" type="tel" autoComplete="tel" required maxLength={30} /></div>
        <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="email" maxLength={160} /></div>
        <div className="field"><label htmlFor="companyName">Company / fleet</label><input id="companyName" name="companyName" maxLength={120} /></div>
        <div className="field"><label htmlFor="year">Year</label><input id="year" name="year" inputMode="numeric" placeholder="2024" maxLength={4} /></div>
        <div className="field"><label htmlFor="make">Make *</label><input id="make" name="make" required maxLength={60} defaultValue="Mercedes-Benz" /></div>
        <div className="field"><label htmlFor="model">Model *</label><input id="model" name="model" required maxLength={80} placeholder="Sprinter 2500" /></div>
        <div className="field"><label htmlFor="vin">VIN</label><input id="vin" name="vin" minLength={17} maxLength={17} autoCapitalize="characters" /></div>
        <div className="field"><label htmlFor="mileage">Mileage</label><input id="mileage" name="mileage" inputMode="numeric" /></div>
        <div className="field"><label htmlFor="unitNumber">Fleet unit number</label><input id="unitNumber" name="unitNumber" maxLength={40} /></div>
        <div className="field full"><label htmlFor="serviceLocation">Vehicle location *</label><input id="serviceLocation" name="serviceLocation" required maxLength={240} placeholder="City or complete service address" /></div>
        <div className="field"><label htmlFor="preferredTime">Preferred date / time</label><input id="preferredTime" name="preferredTime" maxLength={120} placeholder="Weekday after 5 PM" /></div>
        <div className="field"><label htmlFor="urgency">Urgency</label><select id="urgency" name="urgency" defaultValue="normal"><option value="normal">Normal</option><option value="vehicle-down">Vehicle down</option><option value="fleet-priority">Fleet priority</option></select></div>
        <div className="field full"><label htmlFor="complaint">Exact complaint / symptoms *</label><textarea id="complaint" name="complaint" required minLength={10} maxLength={4000} placeholder="Describe when it happens, warning messages, sounds, drivability changes and what the vehicle will or will not do." /></div>
        <div className="field full"><label htmlFor="knownCodes">Known fault codes</label><textarea id="knownCodes" name="knownCodes" maxLength={2000} placeholder="Include exact code numbers and control units when available." /></div>
        <div className="field full"><label htmlFor="priorWork">Previous diagnosis or repair attempts</label><textarea id="priorWork" name="priorWork" maxLength={3000} /></div>
        <div className="honeypot" aria-hidden="true"><label htmlFor="website">Website</label><input id="website" name="website" tabIndex={-1} autoComplete="off" /></div>
        <div className="field full consent-row"><label className="checkbox-label"><input type="checkbox" name="consent" value="yes" required /> <span>I authorize NW Star Diagnostics to contact me about this request. I understand this submission is not a confirmed appointment or repair authorization.</span></label></div>
        <div className="field full">
          <button className="button" type="submit" disabled={state === "submitting"}>{state === "submitting" ? "Sending request…" : "Submit diagnostic request"}</button>
          {state === "error" && <p className="form-error" role="alert">{message}</p>}
          <p className="notice">Do not include payment-card numbers, Social Security numbers or passwords. Photos and diagnostic files will be added through the secure upload stage.</p>
        </div>
      </div>
    </form>
  );
}
