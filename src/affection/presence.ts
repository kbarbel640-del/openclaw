import type { Presence, PresenceState } from "./v3b-engine";

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[_*~`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseMinutes(text: string): number | null {
  // very small parser for: "10m", "10 min", "in 10 minutes"
  const t = normalize(text);

  const m1 = t.match(/\b(\d{1,3})\s*m(in)?\b/);
  if (m1) return Number(m1[1]);

  const m2 = t.match(/\bin\s+(\d{1,3})\s*(min|mins|minute|minutes)\b/);
  if (m2) return Number(m2[1]);

  return null;
}

export type PresenceCommand =
  | { kind: "set"; state: PresenceState; expectedReturnAt?: string | null }
  | { kind: "none" };

export function detectPresenceCommand(input: { text: string }): PresenceCommand {
  const t = normalize(input.text);
  if (!t) return { kind: "none" };
  if (t.startsWith("/")) return { kind: "none" };

  // "back" / "im back" / "i'm back"
  if (t === "back" || t === "im back" || t === "i'm back" || t.startsWith("back ")) {
    return { kind: "set", state: "ACTIVE", expectedReturnAt: null };
  }

  // "brb" with optional time
  if (t === "brb" || t.startsWith("brb ")) {
    const mins = parseMinutes(t);
    const expectedReturnAt = mins != null ? new Date(Date.now() + mins * 60_000).toISOString() : null;
    return { kind: "set", state: "BRB", expectedReturnAt };
  }

  // "away" / "afk"
  if (t === "away" || t.startsWith("away ") || t === "afk" || t.startsWith("afk ")) {
    return { kind: "set", state: "AWAY", expectedReturnAt: null };
  }

  return { kind: "none" };
}

export function applyPresenceUpdate(presence: Presence, cmd: PresenceCommand): Presence {
  if (cmd.kind === "none") return presence;
  return {
    state: cmd.state,
    setAt: new Date().toISOString(),
    brbExpectedReturnAt: cmd.expectedReturnAt ?? null,
  };
}
