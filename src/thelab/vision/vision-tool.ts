import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { TheLabConfig } from "../config/thelab-config.js";
import type { ImageAnalysisResultType, VerificationResultType } from "./schema.js";
import { ImageAnalysisResult, VerificationResult } from "./schema.js";

const execFileAsync = promisify(execFile);

const REPO_ROOT = import.meta.dirname
  ? path.resolve(import.meta.dirname, "../../..")
  : process.cwd();

export class VisionTool {
  private config: TheLabConfig;
  private analyzerPath: string;

  constructor(config: TheLabConfig) {
    this.config = config;
    this.analyzerPath = config.vision.analyzerScript.replace("{baseDir}", REPO_ROOT);
  }

  async analyzeScreenshot(
    screenshotPath: string,
    targetPath: string,
  ): Promise<ImageAnalysisResultType> {
    const result = await this.runAnalyzer({
      mode: "analyze",
      screenshot: screenshotPath,
      target: targetPath,
    });

    const parsed = ImageAnalysisResult.safeParse(result);
    if (!parsed.success) {
      console.error("[VisionTool] Schema validation failed:", parsed.error.issues);
      return {
        image_id: result.image_id ?? "unknown",
        confidence: 0,
        adjustments: [],
        flag_for_review: true,
        flag_reason: `Schema validation failed: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
      };
    }

    return parsed.data;
  }

  async verifyScreenshot(
    screenshotPath: string,
    targetPath: string,
    adjustments: unknown[],
  ): Promise<VerificationResultType> {
    const result = await this.runAnalyzer({
      mode: "verify",
      screenshot: screenshotPath,
      target: targetPath,
      adjustments: JSON.stringify(adjustments),
    });

    const parsed = VerificationResult.safeParse(result);
    if (!parsed.success) {
      return {
        image_id: "unknown",
        adjustments_applied: false,
        deviation_score: 1.0,
        needs_retry: true,
        details: `Verification parse error: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
      };
    }

    return parsed.data;
  }

  private async runAnalyzer(params: {
    mode: string;
    screenshot: string;
    target: string;
    adjustments?: string;
  }): Promise<Record<string, unknown>> {
    await fs.access(this.analyzerPath);

    const args = [
      this.analyzerPath,
      "--screenshot",
      params.screenshot,
      "--target",
      params.target,
      "--model",
      this.config.models.primary,
      "--mode",
      params.mode,
    ];

    if (params.adjustments) {
      args.push("--adjustments", params.adjustments);
    }

    try {
      const { stdout, stderr } = await execFileAsync(this.config.vision.pythonPath, args, {
        timeout: 300_000, // 5 min max per image
        maxBuffer: 10 * 1024 * 1024,
        env: {
          ...process.env,
          PYTHONUNBUFFERED: "1",
        },
      });

      if (stderr) {
        console.error("[VisionTool] stderr:", stderr.slice(0, 500));
      }

      return JSON.parse(stdout.trim());
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("[VisionTool] Execution failed:", msg);
      return {
        error: msg,
        image_id: "unknown",
        confidence: 0,
        adjustments: [],
        flag_for_review: true,
        flag_reason: `Vision analyzer error: ${msg}`,
      };
    }
  }
}
