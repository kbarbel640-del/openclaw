import { Button } from "@/components/ui/button";

export default function App() {
  return (
    <div className="flex h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="flex-1 p-6">
        <h1 className="text-2xl font-bold">MABOS Dashboard</h1>
        <p className="text-[var(--text-secondary)] mb-4">Migration in progress</p>
        <Button>Test Button</Button>
      </div>
    </div>
  );
}
