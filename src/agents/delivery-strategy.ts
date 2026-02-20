/**
 * delivery-strategy.ts - Selects intelligent message delivery strategy
 * 
 * Analyzes task characteristics and user engagement to decide:
 * - silent: No updates until complete
 * - batch: Accumulate updates, send summary at end
 * - milestone: Send updates at major progress points
 * - stream: Stream incremental text (current partial behavior)
 */

import type { TaskCharacteristics } from './task-analyzer.js';
import type { UserEngagement } from './engagement-monitor.js';

export type DeliveryStrategy = 'silent' | 'batch' | 'milestone' | 'stream';

export interface StrategyDecision {
  strategy: DeliveryStrategy;
  reason: string;
  confidence: 'low' | 'medium' | 'high';
}

export interface StrategyConfig {
  mode: 'auto' | 'always-stream' | 'always-batch' | 'always-silent';
  toolOverrides?: Record<string, DeliveryStrategy>;
}

/**
 * Select delivery strategy based on task and engagement
 */
export function selectDeliveryStrategy(
  task: TaskCharacteristics,
  engagement: UserEngagement,
  config?: StrategyConfig,
): StrategyDecision {
  const mode = config?.mode ?? 'auto';
  
  // Manual overrides
  if (mode === 'always-stream') {
    return { strategy: 'stream', reason: 'config: always-stream', confidence: 'high' };
  }
  if (mode === 'always-batch') {
    return { strategy: 'batch', reason: 'config: always-batch', confidence: 'high' };
  }
  if (mode === 'always-silent') {
    return { strategy: 'silent', reason: 'config: always-silent', confidence: 'high' };
  }
  
  // Tool-specific overrides
  if (config?.toolOverrides) {
    for (const toolName of task.toolNames) {
      const override = config.toolOverrides[toolName];
      if (override) {
        return {
          strategy: override,
          reason: `tool override: ${toolName} → ${override}`,
          confidence: 'high',
        };
      }
    }
  }
  
  // Auto mode: intelligent decision-making
  
  // Rule 1: User actively waiting + not quick = stream progress
  if (engagement.waitingForResponse && task.estimatedDuration !== 'quick') {
    if (task.complexity === 'complex' || task.estimatedDuration === 'long') {
      return {
        strategy: 'stream',
        reason: 'user waiting + complex/long task',
        confidence: 'high',
      };
    }
    return {
      strategy: 'milestone',
      reason: 'user waiting + moderate task',
      confidence: 'high',
    };
  }
  
  // Rule 2: Quick + simple = silent
  if (task.estimatedDuration === 'quick' && task.complexity === 'simple') {
    return {
      strategy: 'silent',
      reason: 'quick + simple task',
      confidence: 'high',
    };
  }
  
  // Rule 3: Quick + moderate complexity = batch (collect then send)
  if (task.estimatedDuration === 'quick' && task.complexity === 'moderate') {
    return {
      strategy: 'batch',
      reason: 'quick but moderate complexity',
      confidence: 'medium',
    };
  }
  
  // Rule 4: Long tasks with engaged user = show progress
  if (task.estimatedDuration === 'long' && engagement.isActiveConversation) {
    if (task.complexity === 'complex') {
      return {
        strategy: 'stream',
        reason: 'long + complex + engaged user',
        confidence: 'high',
      };
    }
    return {
      strategy: 'milestone',
      reason: 'long task + engaged user',
      confidence: 'high',
    };
  }
  
  // Rule 5: Long tasks with idle user = batch summary
  if (task.estimatedDuration === 'long' && !engagement.isActiveConversation) {
    return {
      strategy: 'batch',
      reason: 'long task + idle user',
      confidence: 'high',
    };
  }
  
  // Rule 6: Moderate tasks = milestone if engaged, batch if idle
  if (task.estimatedDuration === 'moderate') {
    if (engagement.isActiveConversation) {
      return {
        strategy: 'milestone',
        reason: 'moderate task + engaged user',
        confidence: 'medium',
      };
    }
    return {
      strategy: 'batch',
      reason: 'moderate task + idle user',
      confidence: 'medium',
    };
  }
  
  // Default: batch (safer than streaming)
  return {
    strategy: 'batch',
    reason: 'default fallback',
    confidence: 'low',
  };
}

/**
 * Decide if strategy should be escalated during execution
 */
export function shouldEscalateStrategy(
  current: DeliveryStrategy,
  elapsedMs: number,
  task: TaskCharacteristics,
): { escalate: boolean; newStrategy?: DeliveryStrategy; reason?: string } {
  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  
  // Silent tasks taking >30s should escalate to batch
  if (current === 'silent' && elapsedSeconds > 30) {
    return {
      escalate: true,
      newStrategy: 'batch',
      reason: 'exceeded silent threshold',
    };
  }
  
  // Batch tasks taking >60s should show progress
  if (current === 'batch' && elapsedSeconds > 60) {
    return {
      escalate: true,
      newStrategy: 'milestone',
      reason: 'exceeded batch threshold',
    };
  }
  
  // Milestone tasks taking >120s should stream
  if (current === 'milestone' && elapsedSeconds > 120) {
    return {
      escalate: true,
      newStrategy: 'stream',
      reason: 'exceeded milestone threshold',
    };
  }
  
  return { escalate: false };
}

/**
 * Determine if text update should be sent based on strategy
 */
export function shouldSendUpdate(params: {
  strategy: DeliveryStrategy;
  toolCallComplete: boolean;
  significantProgress: boolean;
  finalUpdate: boolean;
}): boolean {
  const { strategy, toolCallComplete, significantProgress, finalUpdate } = params;
  
  switch (strategy) {
    case 'silent':
      // Only send at end
      return finalUpdate;
      
    case 'batch':
      // Only send at end
      return finalUpdate;
      
    case 'milestone':
      // Send on tool completion or significant progress
      return toolCallComplete || significantProgress || finalUpdate;
      
    case 'stream':
      // Send all updates (use existing throttling)
      return true;
  }
}
