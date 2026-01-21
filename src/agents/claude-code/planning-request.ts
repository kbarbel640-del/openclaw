/**
 * Planning Request Builder for Claude Code
 *
 * Builds the message that gets injected into DyDo's conversation
 * when user runs /claude command. DyDo then:
 * 1. Loads project context
 * 2. Analyzes the task
 * 3. Asks clarifying questions if needed
 * 4. Spawns Claude Code with enriched prompt
 */

export interface PlanningRequestParams {
  /** Action type */
  action: "start" | "resume";
  /** Project name or identifier */
  project: string;
  /** User's task description */
  task?: string;
  /** Resume token (for resume action) */
  resumeToken?: string;
  /** Worktree/branch if specified */
  worktree?: string;
  /** Skip planning (--quick mode) */
  quick?: boolean;
  /** Chat context for bubble updates */
  chatContext?: {
    chatId: string;
    threadId?: number;
    accountId?: string;
  };
}

/**
 * Build a planning request message for DyDo
 */
export function buildPlanningRequest(params: PlanningRequestParams): string {
  const { action, project, task, resumeToken, worktree, quick } = params;

  if (quick) {
    // Quick mode - minimal planning, just start
    return buildQuickStartRequest(params);
  }

  if (action === "resume") {
    return buildResumeRequest(params);
  }

  return buildFullPlanningRequest(params);
}

/**
 * Build quick-start request (minimal planning)
 */
function buildQuickStartRequest(params: PlanningRequestParams): string {
  const { project, task, worktree } = params;
  const projectSpec = worktree ? `${project} @${worktree}` : project;

  const lines = [
    `[Claude Code Quick Start]`,
    ``,
    `Project: ${projectSpec}`,
    `Task: ${task || "Continue working"}`,
    ``,
    `Start a Claude Code session immediately with this task.`,
    `Use the claude_code_start tool with the task as the prompt.`,
  ];

  return lines.join("\n");
}

/**
 * Build resume request
 */
function buildResumeRequest(params: PlanningRequestParams): string {
  const { project, task, resumeToken } = params;

  const lines = [
    `[Claude Code Resume Request]`,
    ``,
    `Resume Token: ${resumeToken}`,
    `Project: ${project || "(from token)"}`,
    `New Task: ${task || "continue"}`,
    ``,
    `Resume the Claude Code session with this token.`,
    ``,
    `Steps:`,
    `1. Use claude_code_start with resumeToken="${resumeToken}"`,
    `2. If a new task is provided, use it as the prompt`,
    `3. Otherwise, use "continue" as the prompt`,
  ];

  return lines.join("\n");
}

/**
 * Build full planning request
 */
function buildFullPlanningRequest(params: PlanningRequestParams): string {
  const { project, task, worktree, chatContext } = params;
  const projectSpec = worktree ? `${project} @${worktree}` : project;

  // If no task specified, ask what to do
  if (!task) {
    return [
      `[Claude Code Request]`,
      `Project: ${projectSpec}`,
      ``,
      `User wants to start a Claude Code session but didn't specify a task.`,
      `Ask them what they want to work on.`,
    ].join("\n");
  }

  // Task specified - be direct and action-oriented
  const lines = [
    `[Claude Code Request]`,
    ``,
    `**Project:** ${projectSpec}`,
    `**Task:** ${task}`,
    ``,
    `Start a Claude Code session for this task NOW.`,
    ``,
    `Use \`claude_code_start\` with:`,
  ];

  // Build the tool call example
  lines.push(`\`\`\``);
  lines.push(`claude_code_start({`);
  lines.push(`  project: "${project}",`);
  if (worktree) lines.push(`  worktree: "${worktree}",`);
  lines.push(`  prompt: "${task.replace(/"/g, '\\"')}",`);
  if (chatContext) {
    lines.push(`  chatId: "${chatContext.chatId}",`);
    if (chatContext.threadId) lines.push(`  threadId: ${chatContext.threadId},`);
    if (chatContext.accountId) lines.push(`  accountId: "${chatContext.accountId}",`);
  }
  lines.push(`})`);
  lines.push(`\`\`\``);

  lines.push(
    ``,
    `If the task is ambiguous, you may ask ONE clarifying question first.`,
    `Otherwise, just start the session with the task above.`,
  );

  return lines.join("\n");
}

/**
 * Check if a message looks like it's responding to a Claude Code question
 * (Used to detect when DyDo should forward response to Claude Code)
 */
export function isClaudeCodeResponse(message: string): boolean {
  const lowerMsg = message.toLowerCase();

  // Check for explicit directives
  if (lowerMsg.includes("[to claude code]")) return true;
  if (lowerMsg.includes("tell claude code")) return true;
  if (lowerMsg.includes("claude code:")) return true;

  return false;
}

/**
 * Extract the response content from a Claude Code response message
 */
export function extractClaudeCodeResponse(message: string): string {
  // Remove directive markers
  let response = message
    .replace(/\[to claude code\]/gi, "")
    .replace(/tell claude code:?/gi, "")
    .replace(/claude code:/gi, "")
    .trim();

  return response;
}
