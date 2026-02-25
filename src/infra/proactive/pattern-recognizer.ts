import { createSubsystemLogger } from "../../logging/subsystem.js";
import { getGlobalDb } from "../db.js";
import { callGateway } from "../../gateway/call.js";
import crypto from "node:crypto";

const log = createSubsystemLogger("proactive/recognizer");

export interface DetectedPattern {
  type: string;
  data: any;
  confidence: number;
}

export class PatternRecognizer {
  private static db = getGlobalDb();

  static async matchPatterns(context: string): Promise<DetectedPattern[]> {
    log.debug(`Analyzing context for patterns: ${context.slice(0, 100)}...`);

    const prompt = `Analyze this user context and identify behavioral patterns or preferences.
Context: ${context}

Return a JSON array of patterns with this structure:
[
  { "type": "pattern_type", "data": { ... }, "confidence": 0.0-1.0 }
]
Respond ONLY with JSON.`;

    const response = await callGateway<{ text: string }>({
      method: "agent",
      params: { message: prompt, lane: "main", deliver: false }
    });

    let patterns: DetectedPattern[] = [];
    try {
        const jsonText = response?.text?.replace(/```json|```/g, "").trim();
        patterns = JSON.parse(jsonText || "[]");
    } catch (err) {
        log.error("Failed to parse patterns", { error: String(err) });
    }

    if (patterns.length > 0) {
      await this.storePatterns(patterns);
    }

    return patterns;
  }

  private static async storePatterns(patterns: DetectedPattern[]) {
    const stmt = this.db.prepare(`
      INSERT INTO proactive_patterns (id, pattern_type, pattern_data, confidence, last_detected_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const pattern of patterns) {
      stmt.run(
        crypto.randomUUID(),
        pattern.type,
        JSON.stringify(pattern.data),
        pattern.confidence,
        Date.now()
      );
    }
  }
}
