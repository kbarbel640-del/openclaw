import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { ChatPanel } from "../chat/ChatPanel";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-primary)]">
      <Sidebar />
      <main className="flex-1 ml-[280px] mr-[400px] overflow-y-auto p-6">
        {children}
      </main>
      <ChatPanel />
    </div>
  );
}
