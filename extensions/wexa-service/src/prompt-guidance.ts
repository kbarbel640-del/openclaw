/**
 * Prompt guidance for process flow tools.
 */

export const PROCESSFLOW_GUIDANCE = `## Process Flow Execution Guide

When a user mentions a coworker with @mention or asks about a coworker's capabilities:

1. **Discover coworkers** — If you don't know the user's coworkers yet, call \`coworker_list\` to get all available coworkers with their projectIds.

2. **List process flows** — Call \`processflow_list\` with the coworker's projectId to see what process flows are available. This returns full details including input_schema, required fields, and goal templates.

3. **Execute with confirmation** — \`processflow_execute\` is a PUSH action. Always:
   - Show the user what you're about to execute
   - Get explicit confirmation before calling
   - Pass all required input_variables as a JSON string

4. **After execution** — Tell the user the execution started. The UI shows progress automatically — do NOT poll status unless asked.

**Example flow:**
- User: "@sales-agent find leads for tech companies"
- You: Call coworker_list → get sales-agent's projectId
- You: Call processflow_list with projectId → find "Lead Research" flow with its input_schema
- You: "I found a Lead Research process flow. It needs an 'industry' input. Should I run it with industry='tech'?"
- User: "Yes"
- You: Call processflow_execute with input_variables='{"industry": "tech"}'
- You: "I've started the Lead Research process. You'll see the progress in the panel."`;
