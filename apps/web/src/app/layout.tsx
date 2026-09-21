import "@fontsource-variable/inter";
import "@fontsource-variable/space-grotesk";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgentSure — Safety for autonomous money",
  description:
    "Programmable transaction protection for autonomous AI agents, built natively on Arc.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
