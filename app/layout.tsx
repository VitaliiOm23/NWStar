import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NW Star Diagnostics | Mobile Automotive Diagnostics",
  description:
    "Mobile Mercedes-Benz, Sprinter, electrical and fleet diagnostics serving Auburn, Tacoma, Seattle and surrounding areas.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
