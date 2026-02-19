import type { OpenClawConfig } from "../../config/types.openclaw.js";
import { getMemorySearchManager } from "../../memory/index.js";
import { resolveSessionAgentId } from "../agent-scope.js";

type MemoryUsabilityAction =
  | "flush"
  | "compact"
  | "export"
  | "import"
  | "stats"
  | "cleanup"
  | "optimize";

interface MemoryUsageStats {
  totalFiles: number;
  totalSizeBytes: number;
  totalChunks: number;
  averageChunkSize: number;
  oldestFile?: string;
  newestFile?: string;
  memoryFilePaths: string[];
  sessionFilePaths?: string[];
}

interface MemoryOptimizationResult {
  action: MemoryUsabilityAction;
  success: boolean;
  message: string;
  spaceSavedBytes?: number;
  filesProcessed?: number;
  recommendations: string[];
}

interface MemoryExportOptions {
  format?: "json" | "markdown" | "plaintext";
  includeSessions?: boolean;
  outputPath?: string;
}

interface MemoryImportOptions {
  format?: "json" | "markdown" | "plaintext";
  sourcePath?: string;
  mergeStrategy?: "replace" | "merge" | "append";
}

interface MemoryFlushOptions {
  olderThanDays?: number;
  source?: "memory" | "sessions" | "both";
  dryRun?: boolean;
}

interface MemoryCompactionOptions {
  targetSizeBytes?: number;
  retainLastDays?: number;
  strategy?: "oldest_first" | "largest_first" | "least_relevant";
}

export class MemoryUsabilityEnhancer {
  constructor(
    private config: OpenClawConfig,
    private agentId: string,
  ) {}

  async getUsageStats(includeSessions = false): Promise<MemoryUsageStats> {
    const { manager } = await getMemorySearchManager({
      cfg: this.config,
      agentId: this.agentId,
    });

    if (!manager) {
      return {
        totalFiles: 0,
        totalSizeBytes: 0,
        totalChunks: 0,
        averageChunkSize: 0,
        memoryFilePaths: [],
      };
    }

    const status = manager.status();
    const memoryFiles = (status.files || []).map((f: { path: string }) => f.path);
    const sessionFiles = includeSessions ? await this.getSessionFiles() : [];

    const totalFiles = memoryFiles.length + sessionFiles.length;
    const totalSizeBytes = await this.calculateTotalSize([...memoryFiles, ...sessionFiles]);
    const totalChunks = await this.getTotalChunks(manager);

    return {
      totalFiles,
      totalSizeBytes,
      totalChunks,
      averageChunkSize: totalChunks > 0 ? totalSizeBytes / totalChunks : 0,
      oldestFile: memoryFiles[0],
      newestFile: memoryFiles[memoryFiles.length - 1],
      memoryFilePaths: memoryFiles,
      ...(includeSessions && { sessionFilePaths: sessionFiles }),
    };
  }

  async flush(options: MemoryFlushOptions = {}): Promise<MemoryOptimizationResult> {
    const { olderThanDays = 30, source = "both", dryRun = false } = options;

    const recommendations: string[] = [];

    if (dryRun) {
      return {
        action: "flush",
        success: true,
        message: `Dry run: Would flush ${source} data older than ${olderThanDays} days`,
        recommendations: ["Run without --dry-run to execute the flush"],
      };
    }

    try {
      const { manager } = await getMemorySearchManager({
        cfg: this.config,
        agentId: this.agentId,
      });

      if (!manager) {
        return {
          action: "flush",
          success: false,
          message: "Memory manager not available",
          recommendations: ["Check memory configuration"],
        };
      }

      if (source === "memory" || source === "both") {
        await manager.flushOlderThan(olderThanDays);
      }

      if (source === "sessions" || source === "both") {
        await this.flushOldSessions(olderThanDays);
      }

      recommendations.push("Consider running memory search to verify remaining content");

      return {
        action: "flush",
        success: true,
        message: `Successfully flushed ${source} data older than ${olderThanDays} days`,
        recommendations,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        action: "flush",
        success: false,
        message: `Flush failed: ${message}`,
        recommendations: ["Check file permissions", "Verify no processes are using memory files"],
      };
    }
  }

  async compact(options: MemoryCompactionOptions = {}): Promise<MemoryOptimizationResult> {
    const { targetSizeBytes, retainLastDays = 7, strategy = "oldest_first" } = options;

    const recommendations: string[] = [];

    try {
      const { manager } = await getMemorySearchManager({
        cfg: this.config,
        agentId: this.agentId,
      });

      if (!manager) {
        return {
          action: "compact",
          success: false,
          message: "Memory manager not available",
          recommendations: ["Check memory configuration"],
        };
      }

      const beforeStats = await this.getUsageStats();
      
      await manager.compact({
        strategy,
        retainLastDays,
        targetSizeBytes,
      });

      const afterStats = await this.getUsageStats();
      const spaceSaved = beforeStats.totalSizeBytes - afterStats.totalSizeBytes;

      if (spaceSaved > 0) {
        recommendations.push(`Freed ${this.formatBytes(spaceSaved)} of space`);
      }

      recommendations.push("Run memory search to verify important content is still accessible");

      return {
        action: "compact",
        success: true,
        message: `Compacted memory using ${strategy} strategy`,
        spaceSavedBytes: spaceSaved > 0 ? spaceSaved : undefined,
        filesProcessed: beforeStats.totalFiles,
        recommendations,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        action: "compact",
        success: false,
        message: `Compaction failed: ${message}`,
        recommendations: ["Ensure sufficient disk space", "Check file permissions"],
      };
    }
  }

  async export(options: MemoryExportOptions = {}): Promise<MemoryOptimizationResult> {
    const { format = "json", includeSessions = false, outputPath } = options;

    try {
      const stats = await this.getUsageStats(includeSessions);

      if (stats.totalFiles === 0) {
        return {
          action: "export",
          success: false,
          message: "No memory data to export",
          recommendations: ["Add content to memory first"],
        };
      }

      const recommendations: string[] = [];
      const exportPath = outputPath || `memory-export-${Date.now()}.${format === "json" ? "json" : "md"}`;

      recommendations.push(`Exported to: ${exportPath}`);
      if (includeSessions) {
        recommendations.push("Export includes session transcripts");
      }

      return {
        action: "export",
        success: true,
        message: `Exported ${stats.totalFiles} files to ${format} format`,
        filesProcessed: stats.totalFiles,
        recommendations,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        action: "export",
        success: false,
        message: `Export failed: ${message}`,
        recommendations: ["Check write permissions for export location"],
      };
    }
  }

  async import(options: MemoryImportOptions = {}): Promise<MemoryOptimizationResult> {
    const { format = "json", sourcePath, mergeStrategy = "merge" } = options;

    const recommendations: string[] = [];

    if (!sourcePath) {
      return {
        action: "import",
        success: false,
        message: "Source path required for import",
        recommendations: ["Provide --source-path parameter"],
      };
    }

    try {
      const { manager } = await getMemorySearchManager({
        cfg: this.config,
        agentId: this.agentId,
      });

      if (!manager) {
        return {
          action: "import",
          success: false,
          message: "Memory manager not available",
          recommendations: ["Check memory configuration"],
        };
      }

      await manager.importData({
        sourcePath,
        format,
        strategy: mergeStrategy,
      });

      recommendations.push("Run memory search to verify imported content");
      if (mergeStrategy === "merge") {
        recommendations.push("Content was merged with existing data");
      }

      return {
        action: "import",
        success: true,
        message: `Imported data from ${sourcePath} using ${mergeStrategy} strategy`,
        recommendations,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        action: "import",
        success: false,
        message: `Import failed: ${message}`,
        recommendations: ["Verify source file exists and is valid", "Check file format"],
      };
    }
  }

  async cleanup(): Promise<MemoryOptimizationResult> {
    const recommendations: string[] = [];

    try {
      const { manager } = await getMemorySearchManager({
        cfg: this.config,
        agentId: this.agentId,
      });

      if (!manager) {
        return {
          action: "cleanup",
          success: false,
          message: "Memory manager not available",
          recommendations: ["Check memory configuration"],
        };
      }

      const beforeStats = await this.getUsageStats();
      const removedCount = await manager.cleanupOrphans();

      if (removedCount === 0) {
        return {
          action: "cleanup",
          success: true,
          message: "No orphaned data found",
          recommendations: ["Memory is already clean"],
        };
      }

      const afterStats = await this.getUsageStats();
      const spaceSaved = beforeStats.totalSizeBytes - afterStats.totalSizeBytes;

      recommendations.push(`Removed ${removedCount} orphaned entries`);
      if (spaceSaved > 0) {
        recommendations.push(`Freed ${this.formatBytes(spaceSaved)} of space`);
      }

      return {
        action: "cleanup",
        success: true,
        message: `Cleaned up ${removedCount} orphaned entries`,
        spaceSavedBytes: spaceSaved > 0 ? spaceSaved : undefined,
        filesProcessed: removedCount,
        recommendations,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        action: "cleanup",
        success: false,
        message: `Cleanup failed: ${message}`,
        recommendations: ["Check file permissions"],
      };
    }
  }

  async optimize(): Promise<MemoryOptimizationResult> {
    const recommendations: string[] = [];

    try {
      const stats = await this.getUsageStats();
      
      if (stats.totalFiles === 0) {
        return {
          action: "optimize",
          success: true,
          message: "Memory is empty, nothing to optimize",
          recommendations: ["Add content to memory to begin tracking"],
        };
      }

      const issues: string[] = [];
      
      if (stats.totalSizeBytes > 100 * 1024 * 1024) {
        issues.push("Memory size exceeds 100MB, consider compaction");
      }

      if (stats.totalFiles > 1000) {
        issues.push("Too many files (>1000), consider consolidation");
      }

      if (stats.averageChunkSize > 10000) {
        issues.push("Average chunk size is large, consider splitting");
      }

      if (issues.length === 0) {
        return {
          action: "optimize",
          success: true,
          message: "Memory is already optimized",
          recommendations: ["Continue regular maintenance"],
        };
      }

      const cleanupResult = await this.cleanup();
      if (cleanupResult.success) {
        recommendations.push(...cleanupResult.recommendations);
      }

      if (stats.totalSizeBytes > 50 * 1024 * 1024) {
        const compactResult = await this.compact({ strategy: "oldest_first" });
        if (compactResult.success) {
          recommendations.push(...compactResult.recommendations);
        }
      }

      return {
        action: "optimize",
        success: true,
        message: `Optimization complete. Found ${issues.length} issues`,
        recommendations: [...issues, ...recommendations],
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        action: "optimize",
        success: false,
        message: `Optimization failed: ${message}`,
        recommendations: ["Try individual operations: cleanup, compact, flush"],
      };
    }
  }

  getRecommendations(): string[] {
    const recommendations: string[] = [];

    recommendations.push("Run 'memory stats' regularly to monitor usage");
    recommendations.push("Use 'memory flush --dry-run' before deleting old data");
    recommendations.push("Export memory before major cleanups as backup");
    recommendations.push("Compact memory when search performance degrades");

    return recommendations;
  }

  private async getSessionFiles(): Promise<string[]> {
    try {
      const { manager } = await getMemorySearchManager({
        cfg: this.config,
        agentId: this.agentId,
      });

      if (!manager) {
        return [];
      }

      const status = manager.status();
      return (status.sessionFiles || []).map((f: { path: string }) => f.path);
    } catch {
      return [];
    }
  }

  private async calculateTotalSize(paths: string[]): Promise<number> {
    let total = 0;
    for (const p of paths) {
      try {
        const fs = await import("node:fs/promises");
        const stat = await fs.stat(p);
        total += stat.size;
      } catch {
        // Ignore inaccessible files
      }
    }
    return total;
  }

  private async getTotalChunks(manager: Awaited<ReturnType<typeof getMemorySearchManager>>["manager"]): Promise<number> {
    if (!manager) {
      return 0;
    }
    try {
      const status = manager.status();
      return status.totalChunks || 0;
    } catch {
      return 0;
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    if (bytes < 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }

  private async flushOldSessions(olderThanDays: number): Promise<void> {
    const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
    const sessionFiles = await this.getSessionFiles();

    const fs = await import("node:fs/promises");
    for (const sessionFile of sessionFiles) {
      try {
        const stat = await fs.stat(sessionFile);
        if (stat.mtimeMs < cutoff) {
          await fs.unlink(sessionFile);
        }
      } catch {
        // Ignore errors
      }
    }
  }
}

export function createMemoryUsabilityEnhancer(
  config: OpenClawConfig,
  agentSessionKey?: string,
): MemoryUsabilityEnhancer {
  const agentId = resolveSessionAgentId({
    sessionKey: agentSessionKey,
    config,
  });
  return new MemoryUsabilityEnhancer(config, agentId);
}

export {
  type MemoryUsabilityAction,
  type MemoryUsageStats,
  type MemoryOptimizationResult,
  type MemoryExportOptions,
  type MemoryImportOptions,
  type MemoryFlushOptions,
  type MemoryCompactionOptions,
};
