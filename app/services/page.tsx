import { CtaBand, PublicShell } from "../../components/PublicShell";

const services = [
  ["Factory-focused scanning", "Full vehicle scans, fault-context review, freeze-frame interpretation and system-level test planning."],
  ["No-start / no-crank", "Battery, starter command, authorization, network, module and power-distribution diagnosis."],
  ["Electrical diagnosis", "Voltage drop, open/short circuits, sensor references, grounds, parasitic draw and intermittent faults."],
  ["CAN / module communication", "Network topology review, communication-loss diagnosis and module power/ground verification."],
  ["Sprinter systems", "Diesel, SCR/AdBlue, body, door, step, restraint, chassis and commercial-vehicle system diagnosis."],
  ["Coding & adaptations", "Supported teach-ins, calibrations, adaptations and configuration work where proper access is available."],
  ["Pre-purchase diagnostics", "Electronic system scan and findings report before a customer or fleet acquires a vehicle."],
  ["Fleet triage", "Priority fault isolation, documented next steps and coordination with the fleet or repair facility."],
  ["Second-opinion diagnosis", "Independent review when parts have already been replaced without resolving the complaint."],
];

export default function ServicesPage() {
  return <PublicShell eyebrow="Capabilities" title="Focused diagnostics. Clear next steps." intro="NW Star Diagnostics is built around measured testing, factory-level information and documentation that helps owners, shops and fleets make the right repair decision.">
    <section className="section"><div className="shell grid-3">{services.map(([title,text],i)=><article className="card" key={title}><div className="card-number">{String(i+1).padStart(2,"0")}</div><h3>{title}</h3><p>{text}</p></article>)}</div></section>
    <section className="section alt"><div className="shell split"><div><div className="eyebrow">What this is not</div><h2>No parts cannon. No unsupported promises.</h2></div><div className="prose"><p>Diagnosis identifies the most defensible cause and repair direction possible from the evidence available. Some faults require additional teardown, dealer-only authorization, repair access, or a follow-up visit.</p><p>Any coding or programming service is performed only when the vehicle, tooling, authorization and technical conditions support it.</p></div></div></section>
    <CtaBand />
  </PublicShell>;
}
