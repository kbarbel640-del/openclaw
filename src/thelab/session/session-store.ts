import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type {
  SessionLogType,
  SessionImageEntryType,
  ImageAnalysisResultType,
  VerificationResultType,
} from "../vision/schema.js";

/**
 * Manages editing session state with JSONL persistence for crash recovery.
 *
 * Each session is a JSONL file where each line is a state-change event.
 * The full session state can be reconstructed by replaying events.
 * This follows OpenClaw's session storage pattern.
 */
export class SessionStore {
  private sessionId: string;
  private sessionDir: string;
  private sessionFile: string;
  private state: SessionLogType;

  constructor(sessionDir: string, filmStock: string, imagePaths: string[]) {
    this.sessionId = `thelab_${Date.now()}_${randomUUID().slice(0, 8)}`;
    this.sessionDir = sessionDir;
    this.sessionFile = path.join(sessionDir, `${this.sessionId}.jsonl`);

    this.state = {
      session_id: this.sessionId,
      film_stock: filmStock,
      started_at: new Date().toISOString(),
      images: imagePaths.map((filePath) => ({
        image_id: path.basename(filePath, path.extname(filePath)),
        file_path: filePath,
        state: "pending" as const,
        analysis: null,
        verification: null,
        attempts: 0,
        started_at: null,
        completed_at: null,
        flag_reason: null,
      })),
      total_images: imagePaths.length,
      completed: 0,
      flagged: 0,
      errors: 0,
    };
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.sessionDir, { recursive: true });
    await this.writeEvent("session_start", {
      session_id: this.sessionId,
      film_stock: this.state.film_stock,
      total_images: this.state.total_images,
      started_at: this.state.started_at,
    });

    for (const image of this.state.images) {
      await this.writeEvent("image_added", {
        image_id: image.image_id,
        file_path: image.file_path,
      });
    }
  }

  /**
   * Resume a session from an existing JSONL file.
   */
  static async resume(sessionFile: string): Promise<SessionStore | null> {
    try {
      const content = await fs.readFile(sessionFile, "utf-8");
      const lines = content.trim().split("\n").filter(Boolean);

      if (lines.length === 0) {
        return null;
      }

      const firstEvent = JSON.parse(lines[0]);
      if (firstEvent.type !== "session_start") {
        return null;
      }

      const store = new SessionStore(path.dirname(sessionFile), firstEvent.data.film_stock, []);
      store.sessionId = firstEvent.data.session_id;
      store.sessionFile = sessionFile;

      for (const line of lines) {
        const event = JSON.parse(line);
        store.replayEvent(event);
      }

      return store;
    } catch (error) {
      console.error("[SessionStore] Resume failed:", error);
      return null;
    }
  }

  getSessionId(): string {
    return this.sessionId;
  }

  getState(): SessionLogType {
    return { ...this.state };
  }

  getNextPendingImage(): SessionImageEntryType | null {
    return this.state.images.find((img) => img.state === "pending") ?? null;
  }

  getCurrentProgress(): {
    total: number;
    completed: number;
    flagged: number;
    errors: number;
    pending: number;
    processing: number;
  } {
    const processing = this.state.images.filter((i) => i.state === "processing").length;
    const pending = this.state.images.filter((i) => i.state === "pending").length;
    return {
      total: this.state.total_images,
      completed: this.state.completed,
      flagged: this.state.flagged,
      errors: this.state.errors,
      pending,
      processing,
    };
  }

  async markProcessing(imageId: string): Promise<void> {
    const image = this.findImage(imageId);
    if (!image) {
      return;
    }

    image.state = "processing";
    image.attempts++;
    image.started_at = new Date().toISOString();

    await this.writeEvent("image_processing", {
      image_id: imageId,
      attempt: image.attempts,
    });
  }

  async markComplete(
    imageId: string,
    analysis: ImageAnalysisResultType,
    verification: VerificationResultType | null,
  ): Promise<void> {
    const image = this.findImage(imageId);
    if (!image) {
      return;
    }

    image.state = "complete";
    image.analysis = analysis;
    image.verification = verification;
    image.completed_at = new Date().toISOString();
    this.state.completed++;

    await this.writeEvent("image_complete", {
      image_id: imageId,
      confidence: analysis.confidence,
      adjustments_count: analysis.adjustments.length,
      verification_ok: verification?.adjustments_applied ?? null,
    });
  }

  async markFlagged(imageId: string, reason: string): Promise<void> {
    const image = this.findImage(imageId);
    if (!image) {
      return;
    }

    image.state = "flagged";
    image.flag_reason = reason;
    image.completed_at = new Date().toISOString();
    this.state.flagged++;

    await this.writeEvent("image_flagged", {
      image_id: imageId,
      reason,
    });
  }

  async markError(imageId: string, error: string): Promise<void> {
    const image = this.findImage(imageId);
    if (!image) {
      return;
    }

    image.state = "error";
    image.flag_reason = error;
    image.completed_at = new Date().toISOString();
    this.state.errors++;

    await this.writeEvent("image_error", {
      image_id: imageId,
      error,
    });
  }

  async finalize(): Promise<void> {
    await this.writeEvent("session_end", {
      session_id: this.sessionId,
      completed: this.state.completed,
      flagged: this.state.flagged,
      errors: this.state.errors,
      ended_at: new Date().toISOString(),
    });
  }

  private findImage(imageId: string): SessionImageEntryType | undefined {
    return this.state.images.find((img) => img.image_id === imageId);
  }

  private async writeEvent(type: string, data: Record<string, unknown>): Promise<void> {
    const event = {
      type,
      timestamp: new Date().toISOString(),
      data,
    };
    const line = JSON.stringify(event) + "\n";
    await fs.appendFile(this.sessionFile, line, "utf-8");
  }

  /**
   * Replay a single event to reconstruct state.
   * Used during session resume.
   */
  private replayEvent(event: { type: string; data: Record<string, unknown> }): void {
    switch (event.type) {
      case "session_start":
        this.state.started_at = event.data.started_at as string;
        this.state.total_images = event.data.total_images as number;
        break;

      case "image_added": {
        const entry: SessionImageEntryType = {
          image_id: event.data.image_id as string,
          file_path: event.data.file_path as string,
          state: "pending",
          analysis: null,
          verification: null,
          attempts: 0,
          started_at: null,
          completed_at: null,
          flag_reason: null,
        };
        this.state.images.push(entry);
        break;
      }

      case "image_processing": {
        const img = this.findImage(event.data.image_id as string);
        if (img) {
          img.state = "processing";
          img.attempts = event.data.attempt as number;
        }
        break;
      }

      case "image_complete": {
        const img = this.findImage(event.data.image_id as string);
        if (img) {
          img.state = "complete";
          this.state.completed++;
        }
        break;
      }

      case "image_flagged": {
        const img = this.findImage(event.data.image_id as string);
        if (img) {
          img.state = "flagged";
          img.flag_reason = event.data.reason as string;
          this.state.flagged++;
        }
        break;
      }

      case "image_error": {
        const img = this.findImage(event.data.image_id as string);
        if (img) {
          img.state = "error";
          img.flag_reason = event.data.error as string;
          this.state.errors++;
        }
        break;
      }
    }
  }
}
