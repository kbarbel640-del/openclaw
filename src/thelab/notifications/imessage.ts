import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * Send an iMessage to a phone number or email via AppleScript.
 * Works without any external dependencies — uses macOS Messages.app directly.
 */
export async function sendIMessage(to: string, text: string): Promise<boolean> {
  const escapedText = text.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const escapedTo = to.replace(/"/g, '\\"');

  const script = `
    tell application "Messages"
      set targetService to 1st account whose service type = iMessage
      set targetBuddy to participant "${escapedTo}" of targetService
      send "${escapedText}" to targetBuddy
    end tell
  `;

  try {
    await execFileAsync("osascript", ["-e", script], { timeout: 10_000 });
    return true;
  } catch (error) {
    console.warn("[iMessage] Failed to send:", error instanceof Error ? error.message : error);
    return false;
  }
}

/**
 * Notification manager for The Lab editing sessions.
 * Sends progress updates, flagged image alerts, and session summaries via iMessage.
 */
export class SessionNotifier {
  private recipient: string;
  private enabled: boolean;
  private progressInterval: number;
  private lastNotifiedCount = 0;

  constructor(recipient: string, enabled = true, progressInterval = 25) {
    this.recipient = recipient;
    this.enabled = enabled;
    this.progressInterval = progressInterval;
  }

  async notifySessionStart(totalImages: number, mode: string): Promise<void> {
    if (!this.enabled) {
      return;
    }
    await sendIMessage(
      this.recipient,
      `🔬 The Lab — Session started\n${totalImages} images, mode: ${mode}\nI'll update you as I work.`,
    );
  }

  async notifyProgress(completed: number, total: number, flagged: number): Promise<void> {
    if (!this.enabled) {
      return;
    }
    if (completed - this.lastNotifiedCount < this.progressInterval) {
      return;
    }

    this.lastNotifiedCount = completed;
    const pct = Math.round((completed / total) * 100);
    await sendIMessage(
      this.recipient,
      `🔬 The Lab — Progress: ${completed}/${total} (${pct}%)\nFlagged for review: ${flagged}`,
    );
  }

  async notifyFlagged(imageId: string, reason: string, scenario: string): Promise<void> {
    if (!this.enabled) {
      return;
    }
    await sendIMessage(
      this.recipient,
      `🔬 The Lab — Flagged: ${imageId}\nScenario: ${scenario}\nReason: ${reason}`,
    );
  }

  async notifySessionComplete(stats: {
    totalImages: number;
    completed: number;
    flagged: number;
    errors: number;
    elapsedMs: number;
    scenariosUsed: number;
  }): Promise<void> {
    if (!this.enabled) {
      return;
    }

    const hours = Math.floor(stats.elapsedMs / 3_600_000);
    const minutes = Math.floor((stats.elapsedMs % 3_600_000) / 60_000);
    const timeStr = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

    const savedHours = Math.round((stats.completed * 2.5) / 60);

    await sendIMessage(
      this.recipient,
      [
        "🔬 The Lab — Session complete",
        "",
        `✅ Edited: ${stats.completed}/${stats.totalImages}`,
        `🚩 Flagged for review: ${stats.flagged}`,
        `❌ Errors: ${stats.errors}`,
        `🎬 Scenarios used: ${stats.scenariosUsed}`,
        `⏱ Time: ${timeStr}`,
        `💡 Estimated time saved: ~${savedHours} hours`,
        "",
        stats.flagged > 0
          ? `${stats.flagged} images need your eye. Open The Lab to review.`
          : "All images processed. Ready for your final review.",
      ].join("\n"),
    );
  }
}
