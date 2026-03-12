import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Syntellia",
  description: "Scan any interface and turn its visual and UX system into structured intelligence."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
