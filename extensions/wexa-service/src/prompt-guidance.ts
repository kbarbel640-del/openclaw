/**
 * Prompt guidance for process flow tools.
 */

export const PROCESSFLOW_GUIDANCE = `## @Mention = Agent Request

When you see \`@name\` in the user's message, this refers to an agent. Use wexa-service tools ONLY.

**IMPORTANT:** Your available agents and their Project IDs are listed in the "Your Available Agents" table below. Use the Project ID directly — no need to call any tool to discover agents.

### Tools to Use:
- \`processflow_list\` — Get available process flows for an agent's projectId
- \`processflow_execute\` — Trigger a process flow (PUSH action - requires confirmation)
- \`processflow_status\` — Check execution status (only if user asks)

### Flow:
1. Match the @mention to an agent in "Your Available Agents" table → get Project ID
2. \`processflow_list\` with the Project ID → discover available workflows
3. **Show user what you'll execute and get explicit confirmation** before calling processflow_execute
4. \`processflow_execute\` → start the workflow
5. Tell user it started (UI handles progress display)`;
