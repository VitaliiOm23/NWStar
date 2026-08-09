import type { Metadata } from "next";
import { RoFlexEnhancer } from "@/components/RoFlexEnhancer";
import "./globals.css";
import "./classic-site.css";
import "./customer-portal.css";
import "./owner.css";
import "./owner-extensions.css";
import "./tech.css";
import "./tech-extensions.css";
import "./workforce.css";
import "./ro-workspace.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://nwstardiagnostics.com"),
  title: { default: "NW Star Diagnostics | Mobile Mercedes & Fleet Diagnostics", template: "%s | NW Star Diagnostics" },
  description: "Mobile Mercedes-Benz, Sprinter, electrical and fleet diagnostics serving Auburn, Tacoma, Seattle and the greater Puget Sound region.",
  keywords: ["Mercedes diagnostics", "Sprinter diagnostics", "mobile diagnostics", "fleet diagnostics", "Auburn", "Tacoma", "Seattle"],
  openGraph: { title: "NW Star Diagnostics", description: "Mobile Mercedes-Benz and Sprinter diagnostics with clear findings and practical next steps.", type: "website", locale: "en_US" },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><RoFlexEnhancer />{children}</body></html>;
}
