import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("memory");

export type MemoryThresholds = {
  /** Warning threshold (0-1): Log warning when memory usage exceeds this */
  warning: number;
  /** Critical threshold (0-1): Start aggressive cleanup when memory exceeds this */
  critical: number;
  /** Fatal threshold (0-1): Graceful shutdown when memory exceeds this */
  fatal: number;
  /** Maximum heap size in bytes (0 = use system default) */
  maxHeapSize?: number;
};

export const DEFAULT_THRESHOLDS: MemoryThresholds = {
  warning: 0.75, // 75% of available memory
  critical: 0.85, // 85% of available memory
  fatal: 0.95, // 95% of available memory
};

/**
 * Load memory thresholds from environment variables
 */
export function loadMemoryThresholdsFromEnv(): Partial<MemoryThresholds> {
  const thresholds: Partial<MemoryThresholds> = {};

  const warning = process.env.OPENCLAW_MEMORY_WARNING_THRESHOLD;
  if (warning) {
    const value = parseFloat(warning);
    if (Number.isFinite(value) && value > 0 && value <= 1) {
      thresholds.warning = value;
    }
  }

  const critical = process.env.OPENCLAW_MEMORY_CRITICAL_THRESHOLD;
  if (critical) {
    const value = parseFloat(critical);
    if (Number.isFinite(value) && value > 0 && value <= 1) {
      thresholds.critical = value;
    }
  }

  const fatal = process.env.OPENCLAW_MEMORY_FATAL_THRESHOLD;
  if (fatal) {
    const value = parseFloat(fatal);
    if (Number.isFinite(value) && value > 0 && value <= 1) {
      thresholds.fatal = value;
    }
  }

  const maxHeapSize = process.env.OPENCLAW_MEMORY_MAX_HEAP_SIZE_MB;
  if (maxHeapSize) {
    const valueMB = parseInt(maxHeapSize, 10);
    if (Number.isFinite(valueMB) && valueMB > 0) {
      thresholds.maxHeapSize = valueMB * 1024 * 1024; // Convert MB to bytes
    }
  }

  return thresholds;
}

export type MemoryStats = {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  arrayBuffers: number;
  /** Memory usage ratio (0-1) based on heapTotal vs maxHeapSize */
  usageRatio: number;
  /** Timestamp of this measurement */
  timestamp: number;
};

export type MemoryMonitorOptions = {
  /** Memory thresholds */
  thresholds?: Partial<MemoryThresholds>;
  /** Check interval in milliseconds */
  checkIntervalMs?: number;
  /** Enable automatic garbage collection when critical */
  enableAutoGC?: boolean;
  /** Callback when warning threshold is exceeded */
  onWarning?: (stats: MemoryStats) => void;
  /** Callback when critical threshold is exceeded */
  onCritical?: (stats: MemoryStats) => void;
  /** Callback when fatal threshold is exceeded */
  onFatal?: (stats: MemoryStats) => void;
};

export type MemoryMonitor = {
  /** Start monitoring */
  start: () => void;
  /** Stop monitoring */
  stop: () => void;
  /** Get current memory stats */
  getStats: () => MemoryStats;
  /** Force garbage collection (if available) */
  forceGC: () => void;
  /** Check if memory usage is healthy */
  isHealthy: () => boolean;
};

/**
 * Get current memory usage statistics
 */
function getMemoryStats(maxHeapSize?: number): MemoryStats {
  const usage = process.memoryUsage();
  const heapUsed = usage.heapUsed;
  const heapTotal = usage.heapTotal;
  const external = usage.external;
  const rss = usage.rss;
  const arrayBuffers = usage.arrayBuffers ?? 0;

  // Calculate usage ratio based on heapTotal vs maxHeapSize
  // If maxHeapSize is not set, use heapTotal as baseline (conservative)
  const effectiveMax = maxHeapSize ?? heapTotal;
  const usageRatio = effectiveMax > 0 ? heapUsed / effectiveMax : 0;

  return {
    heapUsed,
    heapTotal,
    external,
    rss,
    arrayBuffers,
    usageRatio: Math.min(usageRatio, 1.0), // Cap at 1.0
    timestamp: Date.now(),
  };
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Create a memory monitor with configurable thresholds and callbacks
 */
export function createMemoryMonitor(options: MemoryMonitorOptions = {}): MemoryMonitor {
  const thresholds: MemoryThresholds = {
    ...DEFAULT_THRESHOLDS,
    ...options.thresholds,
  };
  const checkIntervalMs = options.checkIntervalMs ?? 30000; // Default: 30 seconds
  const enableAutoGC = options.enableAutoGC ?? true;

  let intervalId: NodeJS.Timeout | null = null;
  let lastWarningTime = 0;
  let lastCriticalTime = 0;
  let lastFatalTime = 0;
  const warningCooldownMs = 60000; // 1 minute between warnings
  const criticalCooldownMs = 30000; // 30 seconds between critical warnings
  const fatalCooldownMs = 10000; // 10 seconds between fatal warnings

  // Try to get max heap size from v8 flags
  let maxHeapSize = thresholds.maxHeapSize;
  if (!maxHeapSize && typeof process.env.NODE_OPTIONS === "string") {
    const match = process.env.NODE_OPTIONS.match(/--max-old-space-size=(\d+)/);
    if (match) {
      maxHeapSize = parseInt(match[1], 10) * 1024 * 1024; // Convert MB to bytes
    }
  }

  const checkMemory = () => {
    try {
      const stats = getMemoryStats(maxHeapSize);
      const { usageRatio } = stats;

      // Check fatal threshold
      if (usageRatio >= thresholds.fatal) {
        const now = Date.now();
        if (now - lastFatalTime >= fatalCooldownMs) {
          lastFatalTime = now;
          log.error(
            `Memory usage FATAL: ${(usageRatio * 100).toFixed(1)}% (threshold: ${(thresholds.fatal * 100).toFixed(1)}%)`,
            {
              heapUsed: formatBytes(stats.heapUsed),
              heapTotal: formatBytes(stats.heapTotal),
              rss: formatBytes(stats.rss),
              usageRatio: `${(usageRatio * 100).toFixed(1)}%`,
            },
          );
          options.onFatal?.(stats);
        }
        return;
      }

      // Check critical threshold
      if (usageRatio >= thresholds.critical) {
        const now = Date.now();
        if (now - lastCriticalTime >= criticalCooldownMs) {
          lastCriticalTime = now;
          log.warn(
            `Memory usage CRITICAL: ${(usageRatio * 100).toFixed(1)}% (threshold: ${(thresholds.critical * 100).toFixed(1)}%)`,
            {
              heapUsed: formatBytes(stats.heapUsed),
              heapTotal: formatBytes(stats.heapTotal),
              rss: formatBytes(stats.rss),
              usageRatio: `${(usageRatio * 100).toFixed(1)}%`,
            },
          );
          options.onCritical?.(stats);

          // Force garbage collection if enabled
          if (enableAutoGC) {
            forceGarbageCollection();
          }
        }
        return;
      }

      // Check warning threshold
      if (usageRatio >= thresholds.warning) {
        const now = Date.now();
        if (now - lastWarningTime >= warningCooldownMs) {
          lastWarningTime = now;
          log.warn(
            `Memory usage WARNING: ${(usageRatio * 100).toFixed(1)}% (threshold: ${(thresholds.warning * 100).toFixed(1)}%)`,
            {
              heapUsed: formatBytes(stats.heapUsed),
              heapTotal: formatBytes(stats.heapTotal),
              rss: formatBytes(stats.rss),
              usageRatio: `${(usageRatio * 100).toFixed(1)}%`,
            },
          );
          options.onWarning?.(stats);

          // Suggest garbage collection
          if (enableAutoGC) {
            forceGarbageCollection();
          }
        }
      }
    } catch (error) {
      log.error("Memory check failed", { error });
    }
  };

  return {
    start: () => {
      if (intervalId !== null) {
        log.warn("Memory monitor already started");
        return;
      }
      log.info("Starting memory monitor", {
        checkIntervalMs,
        thresholds: {
          warning: `${(thresholds.warning * 100).toFixed(1)}%`,
          critical: `${(thresholds.critical * 100).toFixed(1)}%`,
          fatal: `${(thresholds.fatal * 100).toFixed(1)}%`,
        },
        maxHeapSize: maxHeapSize ? formatBytes(maxHeapSize) : "system default",
      });
      intervalId = setInterval(checkMemory, checkIntervalMs);
      // Run initial check
      checkMemory();
    },
    stop: () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
        log.info("Memory monitor stopped");
      }
    },
    getStats: () => getMemoryStats(maxHeapSize),
    forceGC: forceGarbageCollection,
    isHealthy: () => {
      const stats = getMemoryStats(maxHeapSize);
      return stats.usageRatio < thresholds.warning;
    },
  };
}

/**
 * Force garbage collection if available (requires --expose-gc flag)
 */
function forceGarbageCollection(): void {
  if (global.gc && typeof global.gc === "function") {
    try {
      global.gc();
      log.debug("Forced garbage collection");
    } catch (error) {
      log.warn("Garbage collection failed", { error });
    }
  } else {
    log.debug("Garbage collection not available (requires --expose-gc flag)");
  }
}

/**
 * Get recommended Node.js memory flags based on available system memory
 */
export function getRecommendedMemoryFlags(): string[] {
  const totalMemory = require("os").totalmem();
  const gb = totalMemory / (1024 * 1024 * 1024);

  // Recommend max-old-space-size based on available memory
  // Use ~70% of available memory for heap, but cap at reasonable limits
  let maxHeapMB: number;
  if (gb < 2) {
    maxHeapMB = Math.floor((totalMemory * 0.5) / (1024 * 1024)); // 50% for low memory systems
  } else if (gb < 4) {
    maxHeapMB = Math.floor((totalMemory * 0.6) / (1024 * 1024)); // 60% for medium systems
  } else {
    maxHeapMB = Math.floor((totalMemory * 0.7) / (1024 * 1024)); // 70% for larger systems
  }

  // Cap at reasonable maximums
  maxHeapMB = Math.min(maxHeapMB, 8192); // Max 8GB

  const flags: string[] = [];
  if (maxHeapMB > 0) {
    flags.push(`--max-old-space-size=${maxHeapMB}`);
  }
  flags.push("--expose-gc"); // Enable garbage collection API

  return flags;
}
