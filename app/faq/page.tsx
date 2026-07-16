import { CtaBand, PublicShell } from "../../components/PublicShell";
const faqs=[
["Do you only work on Mercedes-Benz vehicles?","Mercedes-Benz and Sprinter are the primary focus. Electrical, network and fleet diagnostic work on other platforms may be accepted depending on the complaint and required tooling."],
["Are you a Mercedes-Benz dealership?","No. NW Star Diagnostics is an independent mobile diagnostics provider and is not affiliated with Mercedes-Benz Group AG."],
["Can you guarantee the vehicle will be repaired in one visit?","No. A diagnostic visit is intended to identify the cause or the most defensible next test. Repairs, teardown, parts, dealer authorization or follow-up testing may be required."],
["Do you perform coding and programming?","Supported coding, teach-ins and adaptations may be available when the vehicle, official access, tooling, battery support and technical conditions permit it."],
["What should I send before scheduling?","Vehicle year, make, model, VIN, mileage, location, exact symptoms, when the issue occurs, known codes and any recent repair history."],
["Do you support fleets after hours?","After-hours and scheduled fleet support may be available based on location, urgency and workload."],
["Will I receive a report?","The planned workflow includes documented findings, tests performed and recommended next steps. Final report format will depend on the service level selected."],
["How is travel charged?","Travel and minimum service charges will be confirmed before scheduling and may vary by distance, vehicle type and urgency."],
];
export default function FaqPage(){return <PublicShell eyebrow="FAQ" title="What to expect from a diagnostic visit." intro="Clear expectations protect both the customer and the diagnostic process. These answers explain the intended scope of service before scheduling."><section className="section"><div className="shell faq-list">{faqs.map(([q,a],i)=><details className="faq" key={q} open={i===0}><summary><span>{String(i+1).padStart(2,"0")}</span>{q}</summary><p>{a}</p></details>)}</div></section><CtaBand /></PublicShell>}
