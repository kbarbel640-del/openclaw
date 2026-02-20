import { MessageCircle } from "lucide-react";

export function ChatPanel() {
  return (
    <aside className="w-[400px] h-screen fixed right-0 top-0 bg-[var(--bg-secondary)] border-l border-[var(--border-mabos)] flex flex-col z-50">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--border-mabos)] flex items-center gap-3">
        <MessageCircle className="w-5 h-5 text-[var(--accent-green)]" />
        <div>
          <div className="font-semibold text-sm">Chat with Atlas CEO</div>
          <div className="text-xs text-[var(--text-muted)]">Business Manager</div>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[var(--accent-green)]" />
          <span className="text-xs text-[var(--text-muted)]">Connected</span>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="flex flex-col items-center justify-center h-full text-center">
          <MessageCircle className="w-12 h-12 text-[var(--text-muted)] mb-4" />
          <p className="text-sm text-[var(--text-secondary)] mb-1">Chat with your MABOS agents</p>
          <p className="text-xs text-[var(--text-muted)]">Ask questions, give instructions, or review decisions</p>
        </div>
      </div>

      {/* Input */}
      <div className="p-3 border-t border-[var(--border-mabos)]">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Message Atlas CEO..."
            className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-mabos)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-green)] transition-colors"
          />
          <button className="px-3 py-2 rounded-lg bg-[var(--accent-green)] text-[var(--bg-primary)] text-sm font-medium hover:opacity-90 transition-opacity">
            Send
          </button>
        </div>
      </div>
    </aside>
  );
}
