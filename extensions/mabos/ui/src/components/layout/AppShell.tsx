import { useState, type ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { ChatPanel } from "../chat/ChatPanel";

export function AppShell({ children }: { children: ReactNode }) {
  const [activePath, setActivePath] = useState("/");

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-primary)]">
      <Sidebar activePath={activePath} onNavigate={setActivePath} />
      <main className="flex-1 ml-[280px] mr-[400px] overflow-y-auto p-6">
        {children}
      </main>
      <ChatPanel />
    </div>
  );
}
