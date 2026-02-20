import { AppShell } from "@/components/layout/AppShell";

export default function App() {
  return (
    <AppShell>
      <div>
        <h1 className="text-2xl font-bold mb-2">Overview</h1>
        <p className="text-[var(--text-secondary)]">
          Welcome to the MABOS Dashboard. Select a section from the sidebar or chat with your agents.
        </p>
      </div>
    </AppShell>
  );
}
