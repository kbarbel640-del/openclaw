/**
 * Messaging Approval Flow
 *
 * Extends the SessionNotifier pattern to support a flagged-image approval workflow:
 *   1. Sophie flags an image she's unsure about
 *   2. Sends the photographer a message with the flag info
 *   3. Photographer replies: "approve" / "skip" / "I'll handle it"
 *   4. Sophie acts on the response
 *
 * This creates a conversational editing workflow where the photographer
 * can manage Sophie's work from their phone.
 */

import { sendIMessage } from "./imessage.js";

export type ApprovalResponse = "approve" | "skip" | "handle_manually" | "unknown";

export interface FlaggedImageInfo {
  imageId: string;
  filePath: string;
  scenario: string;
  flagReason: string;
  confidence: number;
  /** Optional suggested adjustments Sophie would apply if approved */
  suggestedAdjustments?: Array<{ control: string; delta: number }>;
}

export interface ApprovalCallbacks {
  onApprovalSent?: (imageId: string) => void;
  onResponseReceived?: (imageId: string, response: ApprovalResponse) => void;
}

export class ApprovalFlow {
  private recipient: string;
  private enabled: boolean;
  private callbacks: ApprovalCallbacks;

  /** Track pending approvals by image ID */
  private pending = new Map<string, FlaggedImageInfo>();

  constructor(recipient: string, enabled = true, callbacks: ApprovalCallbacks = {}) {
    this.recipient = recipient;
    this.enabled = enabled;
    this.callbacks = callbacks;
  }

  /**
   * Send a flagged image to the photographer for approval.
   */
  async sendForApproval(info: FlaggedImageInfo): Promise<void> {
    if (!this.enabled) {
      return;
    }

    this.pending.set(info.imageId, info);

    const adjustmentSummary = info.suggestedAdjustments
      ? info.suggestedAdjustments
          .slice(0, 5)
          .map((a) => `  ${a.control}: ${a.delta > 0 ? "+" : ""}${a.delta.toFixed(1)}`)
          .join("\n")
      : "  (no suggested edits)";

    const message = [
      `The Lab — Review Needed`,
      "",
      `Image: ${info.imageId}`,
      `Scenario: ${info.scenario}`,
      `Confidence: ${(info.confidence * 100).toFixed(0)}%`,
      `Reason: ${info.flagReason}`,
      "",
      `Suggested edits:`,
      adjustmentSummary,
      "",
      `Reply:`,
      `  "approve" — apply suggested edits`,
      `  "skip" — skip this image`,
      `  "I'll handle it" — leave for manual editing`,
    ].join("\n");

    const sent = await sendIMessage(this.recipient, message);
    if (sent) {
      this.callbacks.onApprovalSent?.(info.imageId);
    }
  }

  /**
   * Parse a reply from the photographer into an approval response.
   */
  parseResponse(replyText: string): ApprovalResponse {
    const lower = replyText.toLowerCase().trim();

    if (lower === "approve" || lower === "yes" || lower === "ok" || lower === "go") {
      return "approve";
    }

    if (lower === "skip" || lower === "no" || lower === "pass") {
      return "skip";
    }

    if (
      lower.includes("handle") ||
      lower.includes("i'll") ||
      lower.includes("manual") ||
      lower.includes("myself")
    ) {
      return "handle_manually";
    }

    return "unknown";
  }

  /**
   * Process a reply for a specific image.
   */
  processReply(imageId: string, replyText: string): ApprovalResponse {
    const response = this.parseResponse(replyText);
    this.pending.delete(imageId);
    this.callbacks.onResponseReceived?.(imageId, response);
    return response;
  }

  /**
   * Get all pending approvals.
   */
  getPending(): FlaggedImageInfo[] {
    return [...this.pending.values()];
  }

  /**
   * Check if an image is pending approval.
   */
  isPending(imageId: string): boolean {
    return this.pending.has(imageId);
  }

  /**
   * Cancel a pending approval request.
   */
  cancel(imageId: string): void {
    this.pending.delete(imageId);
  }

  /**
   * Send a batch summary of flagged images.
   */
  async sendBatchSummary(flaggedImages: FlaggedImageInfo[]): Promise<void> {
    if (!this.enabled || flaggedImages.length === 0) {
      return;
    }

    const summary = [
      `The Lab — ${flaggedImages.length} Images Need Review`,
      "",
      ...flaggedImages.map(
        (img, i) =>
          `${i + 1}. ${img.imageId} — ${img.flagReason} (${(img.confidence * 100).toFixed(0)}%)`,
      ),
      "",
      "Open The Lab to review and approve each image.",
    ].join("\n");

    await sendIMessage(this.recipient, summary);
  }
}
