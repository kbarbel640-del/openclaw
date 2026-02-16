import type { Metadata } from "next";
import { GatewayProvider } from "@/providers/gateway-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "DEM Mission Control",
  description: "Diabolus Ex Machina - Real-time Agent Monitoring Dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased">
        <GatewayProvider>{children}</GatewayProvider>
      </body>
    </html>
  );
}
