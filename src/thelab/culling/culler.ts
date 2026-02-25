/**
 * Sophie's Culling Pipeline
 *
 * Professional editors cull in passes:
 *   Pass 1: Eliminate obvious rejects (blur, closed eyes, cut-off subjects)
 *   Pass 2: Group duplicates, pick the best from each group
 *   Pass 3: Rank remaining by quality and story impact
 *
 * Sophie uses EXIF data and vision analysis to automate this process,
 * flagging uncertain decisions for the photographer's review.
 */

import { randomUUID } from "node:crypto";
import type { TheLabConfig } from "../config/thelab-config.js";
import { extractQuickExif as exifExtractQuick } from "../exif/exif-reader.js";

export type CullVerdict = "pick" | "reject" | "maybe" | "review";

export type RejectReason =
  | "blur"
  | "closed_eyes"
  | "cut_off_subject"
  | "extreme_overexposure"
  | "extreme_underexposure"
  | "duplicate_inferior"
  | "test_shot";

export interface CullResult {
  imageId: string;
  filePath: string;
  verdict: CullVerdict;
  confidence: number;
  reasons: string[];
  rejectReasons?: RejectReason[];
  duplicateGroupId?: string;
  qualityScore?: number;
}

export interface CullSessionStats {
  total: number;
  picks: number;
  rejects: number;
  maybes: number;
  reviews: number;
  duplicateGroups: number;
  elapsed: number;
}

export interface CullCallbacks {
  onProgress?: (completed: number, total: number) => void;
  onVerdict?: (result: CullResult) => void;
  onDuplicateGroup?: (groupId: string, images: string[]) => void;
  onComplete?: (stats: CullSessionStats) => void;
}

interface ExifQuickData {
  shutterSpeed?: number;
  aperture?: number;
  iso?: number;
  focalLength?: number;
  flash?: boolean;
  timestamp?: string;
}

/**
 * Analyzes a set of images and produces cull verdicts.
 *
 * The culler works in three passes:
 * 1. Technical quality check (blur, exposure, focus)
 * 2. Duplicate detection and grouping
 * 3. Quality ranking within groups
 */
export class Culler {
  private config: TheLabConfig;
  private callbacks: CullCallbacks;
  private results: Map<string, CullResult> = new Map();

  constructor(config: TheLabConfig, callbacks: CullCallbacks = {}) {
    this.config = config;
    this.callbacks = callbacks;
  }

  /**
   * Run the full culling pipeline on a set of image paths.
   */
  async cull(imagePaths: string[]): Promise<CullResult[]> {
    const startTime = Date.now();
    const results: CullResult[] = [];

    // Pass 1: Technical quality check
    for (let i = 0; i < imagePaths.length; i++) {
      const result = await this.evaluateImage(imagePaths[i]);
      results.push(result);
      this.results.set(result.imageId, result);
      this.callbacks.onProgress?.(i + 1, imagePaths.length);
      this.callbacks.onVerdict?.(result);
    }

    // Pass 2: Duplicate detection
    const groups = this.detectDuplicateGroups(results);
    for (const [groupId, members] of groups) {
      this.callbacks.onDuplicateGroup?.(
        groupId,
        members.map((m) => m.filePath),
      );
      this.rankWithinGroup(members);
    }

    // Pass 3: Compile stats
    const stats = this.computeStats(results, groups.size, Date.now() - startTime);
    this.callbacks.onComplete?.(stats);

    return results;
  }

  /**
   * Evaluate a single image for technical quality.
   * Returns a preliminary verdict before duplicate analysis.
   */
  private async evaluateImage(filePath: string): Promise<CullResult> {
    const imageId = randomUUID().slice(0, 8);
    const reasons: string[] = [];
    const rejectReasons: RejectReason[] = [];
    let confidence = 0.8;

    const exif = await this.extractQuickExif(filePath);

    // Check for extreme exposure issues via EXIF heuristics
    if (exif.iso && exif.iso > 12800) {
      reasons.push(`Very high ISO (${exif.iso}) — likely noisy`);
      confidence -= 0.1;
    }

    if (exif.shutterSpeed && exif.shutterSpeed > 0.5 && !exif.flash) {
      reasons.push(`Slow shutter (${exif.shutterSpeed}s) without flash — likely motion blur`);
      rejectReasons.push("blur");
      confidence -= 0.2;
    }

    // Focal length vs shutter speed rule (reciprocal rule)
    if (exif.focalLength && exif.shutterSpeed) {
      const minShutter = 1 / exif.focalLength;
      if (exif.shutterSpeed > minShutter * 2 && !exif.flash) {
        reasons.push(
          `Shutter speed (${exif.shutterSpeed}s) too slow for focal length (${exif.focalLength}mm)`,
        );
        rejectReasons.push("blur");
        confidence -= 0.15;
      }
    }

    let verdict: CullVerdict = "pick";
    if (rejectReasons.length > 0 && confidence < 0.5) {
      verdict = "reject";
    } else if (rejectReasons.length > 0) {
      verdict = "review";
    } else if (confidence < 0.7) {
      verdict = "maybe";
    }

    return {
      imageId,
      filePath,
      verdict,
      confidence: Math.max(0, Math.min(1, confidence)),
      reasons,
      rejectReasons: rejectReasons.length > 0 ? rejectReasons : undefined,
    };
  }

  /**
   * Group images that were taken within a short time window
   * at similar settings (likely duplicates / burst shots).
   */
  private detectDuplicateGroups(results: CullResult[]): Map<string, CullResult[]> {
    const groups = new Map<string, CullResult[]>();
    const sorted = [...results].toSorted((a, b) => a.filePath.localeCompare(b.filePath));

    let currentGroup: CullResult[] = [];
    let groupId = "";

    for (let i = 0; i < sorted.length; i++) {
      if (currentGroup.length === 0) {
        groupId = randomUUID().slice(0, 8);
        currentGroup.push(sorted[i]);
        continue;
      }

      const isSimilar = this.areLikelyDuplicates(currentGroup[currentGroup.length - 1], sorted[i]);

      if (isSimilar) {
        currentGroup.push(sorted[i]);
      } else {
        if (currentGroup.length > 1) {
          groups.set(groupId, currentGroup);
          for (const member of currentGroup) {
            member.duplicateGroupId = groupId;
          }
        }
        groupId = randomUUID().slice(0, 8);
        currentGroup = [sorted[i]];
      }
    }

    if (currentGroup.length > 1) {
      groups.set(groupId, currentGroup);
      for (const member of currentGroup) {
        member.duplicateGroupId = groupId;
      }
    }

    return groups;
  }

  /**
   * Within a duplicate group, rank images and mark inferior ones.
   * The best image stays "pick"; others become "duplicate_inferior" rejects.
   */
  private rankWithinGroup(group: CullResult[]): void {
    group.sort((a, b) => b.confidence - a.confidence);

    for (let i = 1; i < group.length; i++) {
      if (group[i].verdict === "pick") {
        group[i].verdict = "maybe";
        group[i].reasons.push(`Duplicate group — similar to ${group[0].filePath.split("/").pop()}`);
        if (!group[i].rejectReasons) {
          group[i].rejectReasons = [];
        }
        group[i].rejectReasons!.push("duplicate_inferior");
      }
    }
  }

  /**
   * Heuristic: two images are likely duplicates if they have sequential
   * filenames (burst mode produces sequential numbering).
   */
  private areLikelyDuplicates(a: CullResult, b: CullResult): boolean {
    const numA = this.extractFileNumber(a.filePath);
    const numB = this.extractFileNumber(b.filePath);

    if (numA !== null && numB !== null) {
      return Math.abs(numA - numB) <= 3;
    }

    return false;
  }

  private extractFileNumber(filePath: string): number | null {
    const match = filePath.match(/(\d{3,})(?=\.[^.]+$)/);
    return match ? parseInt(match[1], 10) : null;
  }

  /**
   * Quick EXIF extraction for culling decisions.
   * Uses exiftool to read key fields (ISO, shutter speed, aperture, focal length, flash).
   */
  private async extractQuickExif(filePath: string): Promise<ExifQuickData> {
    return exifExtractQuick(filePath);
  }

  private computeStats(
    results: CullResult[],
    duplicateGroups: number,
    elapsed: number,
  ): CullSessionStats {
    return {
      total: results.length,
      picks: results.filter((r) => r.verdict === "pick").length,
      rejects: results.filter((r) => r.verdict === "reject").length,
      maybes: results.filter((r) => r.verdict === "maybe").length,
      reviews: results.filter((r) => r.verdict === "review").length,
      duplicateGroups,
      elapsed,
    };
  }
}
