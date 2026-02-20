/**
 * task-analyzer.ts - Analyzes task characteristics for intelligent delivery
 * 
 * Inspects tool calls and message content to estimate:
 * - Duration (quick/moderate/long)
 * - Complexity (simple/moderate/complex)
 * - Work type (read/write/execute/research/code/mixed)
 */

export type TaskDuration = 'quick' | 'moderate' | 'long';
export type TaskComplexity = 'simple' | 'moderate' | 'complex';
export type WorkType = 'read' | 'write' | 'execute' | 'research' | 'code' | 'mixed';

export interface TaskCharacteristics {
  estimatedDuration: TaskDuration;
  complexity: TaskComplexity;
  workType: WorkType;
  toolCount: number;
  hasLongRunningTools: boolean;
  toolNames: string[];
}

const SLOW_TOOLS = new Set([
  'exec',
  'web_search',
  'web_fetch',
  'browser',
  'sessions_spawn',
  'subagents',
  'recall',
  'memory_search',
]);

const WRITE_TOOLS = new Set(['write', 'edit', 'gateway']);
const READ_TOOLS = new Set(['read', 'memory_get', 'memory_search']);
const EXECUTE_TOOLS = new Set(['exec', 'process']);
const RESEARCH_TOOLS = new Set(['web_search', 'web_fetch', 'recall', 'browser']);
const CODE_TOOLS = new Set(['write', 'edit', 'exec']);

function classifyWorkType(toolNames: string[]): WorkType {
  if (toolNames.length === 0) {return 'mixed';}
  
  const isRead = toolNames.every(t => READ_TOOLS.has(t));
  const isWrite = toolNames.some(t => WRITE_TOOLS.has(t));
  const isExecute = toolNames.some(t => EXECUTE_TOOLS.has(t));
  const isResearch = toolNames.some(t => RESEARCH_TOOLS.has(t));
  const isCode = toolNames.filter(t => CODE_TOOLS.has(t)).length >= 2;
  
  if (isRead && !isWrite && !isExecute) {return 'read';}
  if (isWrite && toolNames.length <= 3) {return 'write';}
  if (isExecute && !isCode) {return 'execute';}
  if (isResearch) {return 'research';}
  if (isCode) {return 'code';}
  
  return 'mixed';
}

export function analyzeTask(params: {
  toolCalls?: Array<{ name: string }>;
  messageText?: string;
}): TaskCharacteristics {
  const toolCalls = params.toolCalls ?? [];
  const toolCount = toolCalls.length;
  const toolNames = toolCalls.map(t => t.name);
  
  // Check for slow tools
  const hasLongRunningTools = toolNames.some(name => SLOW_TOOLS.has(name));
  
  // Classify work type
  const workType = classifyWorkType(toolNames);
  
  // Estimate duration
  let estimatedDuration: TaskDuration;
  if (toolCount === 0) {
    // No tools = just text response
    estimatedDuration = 'quick';
  } else if (toolCount === 1 && !hasLongRunningTools) {
    // Single simple tool
    estimatedDuration = 'quick';
  } else if (toolCount <= 3 && !hasLongRunningTools) {
    // Few simple tools
    estimatedDuration = 'moderate';
  } else if (hasLongRunningTools || toolCount > 5) {
    // Slow tools or many tools
    estimatedDuration = 'long';
  } else {
    // Default: moderate
    estimatedDuration = 'moderate';
  }
  
  // Assess complexity
  let complexity: TaskComplexity;
  if (toolCount <= 2 && workType === 'read') {
    complexity = 'simple';
  } else if (toolCount <= 5 && !hasLongRunningTools) {
    complexity = 'moderate';
  } else {
    complexity = 'complex';
  }
  
  // Adjust based on message content
  if (params.messageText) {
    const text = params.messageText.toLowerCase();
    const complexKeywords = ['build', 'create', 'implement', 'design', 'refactor', 'analyze'];
    const hasComplexKeyword = complexKeywords.some(kw => text.includes(kw));
    
    if (hasComplexKeyword && complexity === 'simple') {
      complexity = 'moderate';
    }
    if (hasComplexKeyword && complexity === 'moderate' && toolCount > 3) {
      complexity = 'complex';
    }
  }
  
  return {
    estimatedDuration,
    complexity,
    workType,
    toolCount,
    hasLongRunningTools,
    toolNames,
  };
}

/**
 * Re-evaluate strategy if actual duration exceeds estimate
 */
export function reevaluateTaskDuration(
  original: TaskCharacteristics,
  elapsedMs: number,
): TaskCharacteristics {
  const elapsedSeconds = Math.floor(elapsedMs / 1000);
  
  let newDuration: TaskDuration = original.estimatedDuration;
  
  // Quick tasks that exceed 30s → moderate
  if (original.estimatedDuration === 'quick' && elapsedSeconds > 30) {
    newDuration = 'moderate';
  }
  
  // Moderate tasks that exceed 2min → long
  if (original.estimatedDuration === 'moderate' && elapsedSeconds > 120) {
    newDuration = 'long';
  }
  
  return {
    ...original,
    estimatedDuration: newDuration,
  };
}
