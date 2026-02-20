/**
 * delivery-telemetry.ts - Learn optimal message delivery patterns from usage
 * 
 * Purpose: Track delivery decisions and outcomes to optimize strategy selection
 * 
 * Learning dimensions:
 * - Which strategies work best for which task types?
 * - When do users engage vs. stay idle?
 * - Which tool combinations benefit from streaming vs. batching?
 * - What's the optimal escalation timing?
 */

import fs from "node:fs/promises";
import path from "node:path";
import type { DeliveryStrategy } from "./delivery-strategy.js";
import type { TaskCharacteristics } from "./task-analyzer.js";
import type { UserEngagement } from "./engagement-monitor.js";

export interface DeliveryEvent {
  timestamp: number;
  sessionKey: string;
  
  // Decision inputs
  strategy: DeliveryStrategy;
  taskDuration: "quick" | "moderate" | "long";
  taskComplexity: "simple" | "moderate" | "complex";
  taskWorkType: string;
  userEngaged: boolean;
  userWaiting: boolean;
  
  // Execution tracking
  actualDurationMs: number;
  toolCallsExecuted: number;
  messagessentCount: number;
  strategyEscalated: boolean;
  escalatedTo?: DeliveryStrategy;
  escalationTrigger?: "timeout" | "error" | "complexity";
  
  // Outcome metrics
  userRespondedWithinMs?: number;  // Did user reply? How fast?
  taskCompleted: boolean;
  hadErrors: boolean;
  
  // Learning signals
  strategyEffective: boolean | null;  // null = unknown yet
  userFeedback?: "helpful" | "noisy" | "missed";
}

export interface DeliveryPattern {
  taskType: string;  // e.g., "quick-simple-read", "long-complex-research"
  recommendedStrategy: DeliveryStrategy;
  confidence: number;  // 0-1, based on sample size and consistency
  sampleSize: number;
  avgDurationMs: number;
  escalationRate: number;  // % of tasks that needed escalation
  userEngagementRate: number;  // % where user was active
}

const TELEMETRY_FILE = "data/delivery-telemetry.jsonl";
const PATTERNS_FILE = "data/delivery-patterns.json";
const LEARNING_INTERVAL_MS = 60 * 60 * 1000;  // Learn every hour

export class DeliveryTelemetry {
  private telemetryPath: string;
  private patternsPath: string;
  private learningTimer: NodeJS.Timeout | null = null;
  
  constructor(dataDir: string) {
    this.telemetryPath = path.join(dataDir, TELEMETRY_FILE);
    this.patternsPath = path.join(dataDir, PATTERNS_FILE);
  }
  
  /**
   * Record a delivery decision and its outcome
   */
  async recordEvent(event: DeliveryEvent): Promise<void> {
    try {
      const line = JSON.stringify(event) + "\n";
      await fs.appendFile(this.telemetryPath, line, "utf8");
    } catch (error) {
      console.error(`Failed to record delivery telemetry: ${error}`);
    }
  }
  
  /**
   * Load recent telemetry events for analysis
   */
  async loadRecentEvents(limitDays = 7): Promise<DeliveryEvent[]> {
    try {
      const content = await fs.readFile(this.telemetryPath, "utf8");
      const lines = content.trim().split("\n");
      const cutoff = Date.now() - limitDays * 24 * 60 * 60 * 1000;
      
      return lines
        .map(line => {
          try {
            return JSON.parse(line) as DeliveryEvent;
          } catch {
            return null;
          }
        })
        .filter((event): event is DeliveryEvent => 
          event !== null && event.timestamp > cutoff
        );
    } catch {
      return [];
    }
  }
  
  /**
   * Analyze telemetry to discover effective patterns
   */
  async learnPatterns(): Promise<DeliveryPattern[]> {
    const events = await this.loadRecentEvents(7);
    
    if (events.length < 10) {
      // Not enough data yet
      return [];
    }
    
    // Group by task type
    const groups = new Map<string, DeliveryEvent[]>();
    
    for (const event of events) {
      const key = `${event.taskDuration}-${event.taskComplexity}-${event.taskWorkType}`;
      const existing = groups.get(key) || [];
      existing.push(event);
      groups.set(key, existing);
    }
    
    // Analyze each group
    const patterns: DeliveryPattern[] = [];
    
    for (const [taskType, groupEvents] of groups) {
      if (groupEvents.length < 3) {
        continue;  // Need at least 3 samples
      }
      
      // Count strategy effectiveness
      const strategyCounts = new Map<DeliveryStrategy, {
        total: number;
        effective: number;
        escalated: number;
        avgDuration: number;
      }>();
      
      for (const event of groupEvents) {
        const stats = strategyCounts.get(event.strategy) || {
          total: 0,
          effective: 0,
          escalated: 0,
          avgDuration: 0
        };
        
        stats.total++;
        if (event.strategyEffective === true) {
          stats.effective++;
        }
        if (event.strategyEscalated) {
          stats.escalated++;
        }
        stats.avgDuration += event.actualDurationMs;
        
        strategyCounts.set(event.strategy, stats);
      }
      
      // Find most effective strategy
      let bestStrategy: DeliveryStrategy = "batch";
      let bestScore = 0;
      
      for (const [strategy, stats] of strategyCounts) {
        const effectiveness = stats.effective / stats.total;
        const stability = 1 - (stats.escalated / stats.total);
        const score = effectiveness * 0.7 + stability * 0.3;
        
        if (score > bestScore) {
          bestScore = score;
          bestStrategy = strategy;
        }
      }
      
      const bestStats = strategyCounts.get(bestStrategy)!;
      
      patterns.push({
        taskType,
        recommendedStrategy: bestStrategy,
        confidence: Math.min(bestStats.total / 20, 1),  // Full confidence at 20+ samples
        sampleSize: groupEvents.length,
        avgDurationMs: bestStats.avgDuration / bestStats.total,
        escalationRate: bestStats.escalated / bestStats.total,
        userEngagementRate: groupEvents.filter(e => e.userEngaged).length / groupEvents.length
      });
    }
    
    // Save learned patterns
    await this.savePatterns(patterns);
    
    return patterns;
  }
  
  /**
   * Get learned pattern for a task type
   */
  async getPattern(task: TaskCharacteristics): Promise<DeliveryPattern | null> {
    try {
      const content = await fs.readFile(this.patternsPath, "utf8");
      const patterns = JSON.parse(content) as DeliveryPattern[];
      
      const key = `${task.estimatedDuration}-${task.complexity}-${task.workType}`;
      return patterns.find(p => p.taskType === key) || null;
    } catch {
      return null;
    }
  }
  
  /**
   * Save learned patterns to disk
   */
  private async savePatterns(patterns: DeliveryPattern[]): Promise<void> {
    try {
      const dir = path.dirname(this.patternsPath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(this.patternsPath, JSON.stringify(patterns, null, 2), "utf8");
    } catch (error) {
      console.error(`Failed to save delivery patterns: ${error}`);
    }
  }
  
  /**
   * Start periodic pattern learning
   */
  startLearning(): void {
    if (this.learningTimer) {
      return;
    }
    
    this.learningTimer = setInterval(async () => {
      console.log("Learning delivery patterns from telemetry...");
      const patterns = await this.learnPatterns();
      console.log(`Learned ${patterns.length} delivery patterns`);
    }, LEARNING_INTERVAL_MS);
    
    // Initial learning on startup (after 5 minutes)
    setTimeout(() => {
      void this.learnPatterns();
    }, 5 * 60 * 1000);
  }
  
  /**
   * Stop periodic learning
   */
  stopLearning(): void {
    if (this.learningTimer) {
      clearInterval(this.learningTimer);
      this.learningTimer = null;
    }
  }
  
  /**
   * Generate optimization report
   */
  async generateOptimizationReport(): Promise<string> {
    const events = await this.loadRecentEvents(7);
    const patterns = await this.learnPatterns();
    
    if (events.length === 0) {
      return "No delivery telemetry collected yet.";
    }
    
    let report = "# Delivery Strategy Optimization Report\n\n";
    report += `**Period:** Last 7 days\n`;
    report += `**Sample size:** ${events.length} delivery decisions\n\n`;
    
    // Strategy distribution
    const strategyDist = events.reduce((acc, e) => {
      acc[e.strategy] = (acc[e.strategy] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    report += "## Strategy Distribution\n\n";
    for (const [strategy, count] of Object.entries(strategyDist)) {
      const pct = ((count / events.length) * 100).toFixed(1);
      report += `- **${strategy}**: ${count} (${pct}%)\n`;
    }
    
    // Escalation rate
    const escalated = events.filter(e => e.strategyEscalated).length;
    const escalationRate = ((escalated / events.length) * 100).toFixed(1);
    report += `\n**Escalation rate:** ${escalationRate}%\n\n`;
    
    // Learned patterns
    if (patterns.length > 0) {
      report += "## Learned Patterns\n\n";
      for (const pattern of patterns.toSorted((a, b) => b.confidence - a.confidence)) {
        report += `### ${pattern.taskType}\n`;
        report += `- **Recommended:** ${pattern.recommendedStrategy}\n`;
        report += `- **Confidence:** ${(pattern.confidence * 100).toFixed(0)}%\n`;
        report += `- **Sample size:** ${pattern.sampleSize}\n`;
        report += `- **Avg duration:** ${Math.round(pattern.avgDurationMs / 1000)}s\n`;
        report += `- **Escalation rate:** ${(pattern.escalationRate * 100).toFixed(1)}%\n\n`;
      }
    }
    
    return report;
  }
}
