import { HEARTBEAT_TOKEN } from "../auto-reply/tokens.js";

type CronEventWithRelayPrompt = {
  text: string;
  relayPrompt?: string | null;
};

// Build a dynamic prompt for cron events by embedding the actual event content.
// This ensures the model sees the reminder text directly instead of relying on
// "shown in the system messages above" which may not be visible in context.
export function buildCronEventPrompt(pendingEvents: CronEventWithRelayPrompt[]): string {
  // Extract relayPrompt from first event (all events from same cron job have same relayPrompt)
  const relayPrompt = pendingEvents[0]?.relayPrompt;

  const eventText = pendingEvents
    .map((e) => (typeof e === "string" ? e : e.text))
    .join("\n")
    .trim();
  if (!eventText) {
    return (
      "A scheduled cron event was triggered, but no event content was found. " +
      "Reply HEARTBEAT_OK."
    );
  }

  const base = "A scheduled reminder has been triggered. The reminder content is:\n\n" + eventText;

  // If relayPrompt is explicitly null, no relay instruction
  if (relayPrompt === null) {
    return base;
  }

  // If relayPrompt is a custom string, use it
  if (typeof relayPrompt === "string") {
    return base + "\n\n" + relayPrompt;
  }

  // Default behavior: relay to user
  return base + "\n\nPlease relay this reminder to the user in a helpful and friendly way.";
}

const HEARTBEAT_OK_PREFIX = HEARTBEAT_TOKEN.toLowerCase();

// Detect heartbeat-specific noise so cron reminders don't trigger on non-reminder events.
function isHeartbeatAckEvent(evt: string): boolean {
  const trimmed = evt.trim();
  if (!trimmed) {
    return false;
  }
  const lower = trimmed.toLowerCase();
  if (!lower.startsWith(HEARTBEAT_OK_PREFIX)) {
    return false;
  }
  const suffix = lower.slice(HEARTBEAT_OK_PREFIX.length);
  if (suffix.length === 0) {
    return true;
  }
  return !/[a-z0-9_]/.test(suffix[0]);
}

function isHeartbeatNoiseEvent(evt: string): boolean {
  const lower = evt.trim().toLowerCase();
  if (!lower) {
    return false;
  }
  return (
    isHeartbeatAckEvent(lower) ||
    lower.includes("heartbeat poll") ||
    lower.includes("heartbeat wake")
  );
}

export function isExecCompletionEvent(evt: string): boolean {
  return evt.toLowerCase().includes("exec finished");
}

// Returns true when a system event should be treated as real cron reminder content.
export function isCronSystemEvent(evt: string) {
  if (!evt.trim()) {
    return false;
  }
  return !isHeartbeatNoiseEvent(evt) && !isExecCompletionEvent(evt);
}
