"use client";

import { FormEvent, useState } from "react";

type FormState = "idle" | "submitting" | "success" | "error";

type ServiceRequestFormProps = {
  initialComplaint?: string;
};

export function ServiceRequestForm({ initialComplaint = "" }: ServiceRequestFormProps) {
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
        <h2>Your vehicle information was submitted.</h2>
        <p>We will review the complaint and contact you about scope, location and scheduling.</p>
        <div className="reference-box"><span>Reference number</span><strong>{reference}</strong></div>
        <button className="button secondary" type="button" onClick={() => setState("idle")}>Submit another vehicle</button>
      </div>
    );
  }

  return (
    <form className="form service-request-form" onSubmit={submit} noValidate>
      <div className="form-heading">
        <span>Service request</span>
        <h2>Vehicle and complaint details</h2>
        <p>{initialComplaint ? "The concern you selected is already filled in below. Add any details that will help describe the problem." : "Required fields are marked with an asterisk."}</p>
      </div>

      <fieldset className="form-section">
        <legend>Contact</legend>
        <div className="form-grid">
          <div className="field"><label htmlFor="fullName">Name *</label><input id="fullName" name="fullName" autoComplete="name" required minLength={2} maxLength={100} /></div>
          <div className="field"><label htmlFor="phone">Phone *</label><input id="phone" name="phone" type="tel" autoComplete="tel" required maxLength={30} /></div>
          <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="email" maxLength={160} /></div>
          <div className="field"><label htmlFor="companyName">Company or fleet</label><input id="companyName" name="companyName" maxLength={120} /></div>
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend>Vehicle</legend>
        <div className="form-grid">
          <div className="field"><label htmlFor="year">Year</label><input id="year" name="year" inputMode="numeric" placeholder="2024" maxLength={4} /></div>
          <div className="field"><label htmlFor="make">Make *</label><input id="make" name="make" required maxLength={60} placeholder="Mercedes-Benz, Ford, Tesla, Toyota…" /></div>
          <div className="field"><label htmlFor="model">Model *</label><input id="model" name="model" required maxLength={80} placeholder="Sprinter 2500, Transit, Model 3…" /></div>
          <div className="field"><label htmlFor="mileage">Mileage</label><input id="mileage" name="mileage" inputMode="numeric" /></div>
          <div className="field full"><label htmlFor="serviceLocation">Vehicle location *</label><input id="serviceLocation" name="serviceLocation" required maxLength={240} placeholder="City or service address" /></div>
        </div>
      </fieldset>

      <fieldset className="form-section">
        <legend>Problem</legend>
        <div className="form-grid">
          <div className="field"><label htmlFor="urgency">Vehicle status</label><select id="urgency" name="urgency" defaultValue="normal"><option value="normal">Driveable / normal priority</option><option value="vehicle-down">Vehicle is down</option><option value="fleet-priority">Fleet priority</option></select></div>
          <div className="field"><label htmlFor="preferredTime">Preferred timing</label><input id="preferredTime" name="preferredTime" maxLength={120} placeholder="Weekday evening, Saturday, etc." /></div>
          <div className="field full"><label htmlFor="complaint">What is the vehicle doing? *</label><textarea id="complaint" name="complaint" required minLength={10} maxLength={4000} defaultValue={initialComplaint} placeholder="Describe the warning message, symptom, sound or drivability problem. Include when it happens and whether the vehicle still starts and drives." /></div>
        </div>
      </fieldset>

      <details className="optional-details">
        <summary>Add VIN, fault codes and previous repair details</summary>
        <div className="optional-details-body form-grid">
          <div className="field"><label htmlFor="vin">VIN</label><input id="vin" name="vin" minLength={17} maxLength={17} autoCapitalize="characters" /></div>
          <div className="field"><label htmlFor="unitNumber">Fleet unit number</label><input id="unitNumber" name="unitNumber" maxLength={40} /></div>
          <div className="field full"><label htmlFor="knownCodes">Known fault codes</label><textarea id="knownCodes" name="knownCodes" maxLength={2000} placeholder="Include exact code numbers and control units when available." /></div>
          <div className="field full"><label htmlFor="priorWork">Previous diagnosis or repair attempts</label><textarea id="priorWork" name="priorWork" maxLength={3000} placeholder="List recent repairs, parts replaced or tests already performed." /></div>
        </div>
      </details>

      <div className="honeypot" aria-hidden="true"><label htmlFor="website">Website</label><input id="website" name="website" tabIndex={-1} autoComplete="off" /></div>

      <div className="consent-row">
        <label className="checkbox-label"><input type="checkbox" name="consent" value="yes" required /> <span>I authorize NW Star Diagnostics to contact me about this request. I understand this is not a confirmed appointment or repair authorization.</span></label>
      </div>

      <div className="form-submit-row">
        <button className="button" type="submit" disabled={state === "submitting"}>{state === "submitting" ? "Sending request…" : "Send Service Request"}</button>
        <p className="notice">Do not enter payment-card numbers, Social Security numbers or passwords.</p>
      </div>

      {state === "error" && <p className="form-error" role="alert">{message}</p>}
    </form>
  );
}
