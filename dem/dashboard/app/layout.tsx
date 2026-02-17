import type { Metadata } from "next";
import { GatewayProvider } from "@/providers/gateway-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Six Fingered Man",
  description: "Governed autonomy for AI agents — Mission Control Dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased">
        <GatewayProvider>{children}</GatewayProvider>
      </body>
    </html>
  );
}
