import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://nwstardiagnostics.com"),
  title: { default: "NW Star Diagnostics | Mobile Mercedes & Fleet Diagnostics", template: "%s | NW Star Diagnostics" },
  description: "Mobile Mercedes-Benz, Sprinter, electrical and fleet diagnostics serving Auburn, Tacoma, Seattle and the greater Puget Sound region.",
  keywords: ["Mercedes diagnostics", "Sprinter diagnostics", "mobile diagnostics", "fleet diagnostics", "Auburn", "Tacoma", "Seattle"],
  openGraph: { title: "NW Star Diagnostics", description: "Precision mobile diagnosis. Less downtime.", type: "website", locale: "en_US" },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
