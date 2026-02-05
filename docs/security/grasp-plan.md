# Implementation Plan: `openclaw security grasp` (AI-Driven Self-Assessment)

## Branch

Create feature branch: `git checkout -b feat/security-grasp`

## Overview

Add a new `openclaw security grasp` command that performs **AI-driven self-assessment** of an OpenClaw agent instance. Unlike static analysis, the AI actively explores configuration, tool definitions, and capabilities to reason about risk across 5 dimensions:

- **G**overnance: Can we observe and intervene?
- **R**each: What can it touch?
- **A**gency: How autonomous is it?
- **S**afeguards: What limits damage?
- **P**otential Damage: What's the worst case?

## How Analysis Works (AI Self-Review)

The GRASP command uses AI introspection:

1. **Per-dimension prompts** - Each GRASP dimension has a dedicated system prompt
2. **AI explores freely** - The agent has access to file/config reading tools
3. **AI reasons about risk** - The model analyzes what it finds and assesses risk
4. **Structured output** - Each dimension returns JSON with score, findings, and commentary
5. **Non-deterministic** - Results may vary between runs (acceptable)

The AI is essentially asked: "Given your current configuration and capabilities, assess your own risk profile for this dimension."

## File Structure

```
src/security/grasp/
  types.ts              # TypeScript types for GRASP assessment
  index.ts              # Main orchestration, exports runGraspAssessment()
  prompts/
    governance.ts       # Governance dimension prompt + analysis
    reach.ts            # Reach dimension prompt + analysis
    agency.ts           # Agency dimension prompt + analysis
    safeguards.ts       # Safeguards dimension prompt + analysis
    potential-damage.ts # Potential damage dimension prompt + analysis
  runner.ts             # Runs AI analysis for a single dimension
  scoring.ts            # Score aggregation utilities
  format.ts             # Terminal output formatting (bar chart, tables)
  grasp.test.ts         # Unit tests

src/cli/security-cli.ts # Modify: Add 'grasp' subcommand
```

## Data Model (`src/security/grasp/types.ts`)

```typescript
export type GraspDimension = "governance" | "reach" | "agency" | "safeguards" | "potential_damage";
export type GraspRiskLevel = "low" | "medium" | "high" | "critical";
export type GraspSeverity = "info" | "warn" | "critical";

export type GraspFinding = {
  id: string;                    // e.g., "governance.logging_disabled"
  dimension: GraspDimension;
  severity: GraspSeverity;
  signal: string;                // What the AI looked at
  observation: string;           // What the AI observed
  riskContribution: number;      // 0-100
  title: string;
  detail: string;
  remediation?: string;
};

export type GraspDimensionResult = {
  dimension: GraspDimension;
  label: string;                 // "Governance", "Reach", etc.
  score: number;                 // 0-100 (higher = more risk)
  level: GraspRiskLevel;
  findings: GraspFinding[];
  reasoning: string;             // AI's reasoning/commentary
  exploredPaths: string[];       // Files/configs the AI examined
};

export type GraspAgentProfile = {
  agentId: string;
  isDefault: boolean;
  dimensions: GraspDimensionResult[];
  overallScore: number;
  overallLevel: GraspRiskLevel;
  summary: string;               // AI-generated summary
};

export type GraspReport = {
  ts: number;
  modelUsed: string;             // Which model performed the analysis
  agents: GraspAgentProfile[];
  globalFindings: GraspFinding[]; // Gateway/channel findings
  overallScore: number;
  overallLevel: GraspRiskLevel;
  summary: { critical: number; warn: number; info: number };
};

export type GraspOptions = {
  config: OpenClawConfig;
  agentId?: string;              // Specific agent (default: all)
  model?: string;                // Model to use for analysis
  verbose?: boolean;             // Show AI reasoning
};
```

## Dimension Prompts

Each dimension has a dedicated prompt that instructs the AI what to analyze. The AI has access to tools for reading files.

### Governance Prompt (`src/security/grasp/prompts/governance.ts`)

```typescript
export const GOVERNANCE_SYSTEM_PROMPT = `
You are performing a security self-assessment of an OpenClaw agent instance.

DIMENSION: Governance
QUESTION: Can operators observe and intervene on this agent's behavior?

Your task is to explore the configuration and assess governance controls:

1. EXPLORE these areas (use file reading tools):
   - ~/.openclaw/config.yaml (main config)
   - Logging settings (logging.level, logging.file, logging.redactSensitive)
   - Diagnostic settings (diagnostics.enabled)
   - Approval settings (approvals.*, tools.exec.ask)
   - Gateway control UI settings (gateway.controlUi.*)
   - Any agent-specific overrides in agents.* config

2. ASSESS risk signals:
   - Can operators see what the agent is doing? (logging, diagnostics)
   - Can operators stop or redirect the agent? (control UI, approvals)
   - Are there blind spots? (redacted logs, disabled diagnostics)
   - Is there an audit trail? (session logs, transcript paths)

3. RETURN structured JSON:
{
  "score": <0-100, higher = more risk>,
  "level": "<low|medium|high|critical>",
  "findings": [
    {
      "id": "governance.<finding_id>",
      "severity": "<info|warn|critical>",
      "signal": "<what you examined>",
      "observation": "<what you found>",
      "riskContribution": <0-100>,
      "title": "<short title>",
      "detail": "<explanation>",
      "remediation": "<optional fix>"
    }
  ],
  "reasoning": "<your analysis and reasoning>",
  "exploredPaths": ["<files you examined>"]
}

Scoring guide:
- 0-25 (low): Full observability, approvals required, audit trail
- 26-50 (medium): Partial observability, some approvals
- 51-75 (high): Limited observability, few controls
- 76-100 (critical): Blind operation, no intervention possible
`;
```

### Reach Prompt (`src/security/grasp/prompts/reach.ts`)

```typescript
export const REACH_SYSTEM_PROMPT = `
You are performing a security self-assessment of an OpenClaw agent instance.

DIMENSION: Reach
QUESTION: What systems and data can this agent access?

Your task is to explore the configuration and assess the agent's reach:

1. EXPLORE these areas:
   - Gateway binding (gateway.bind, gateway.tailscale.mode)
   - Workspace access (agents.*.sandbox.workspaceAccess)
   - Tool profiles (tools.profile, tools.allow, tools.deny)
   - Browser control (browser.enabled, browser.*)
   - Subagent spawning (agents.*.subagents.allowAgents)
   - Channel connections (channels.*)
   - MCP servers (mcp.servers.*)
   - File system access patterns

2. ASSESS risk signals:
   - Network exposure (loopback vs LAN vs internet)
   - Filesystem scope (none, read-only, read-write)
   - Tool breadth (minimal vs full tool access)
   - External integrations (browsers, APIs, channels)
   - Agent spawning capabilities

3. RETURN structured JSON (same format as governance)

Scoring guide:
- 0-25 (low): Loopback only, minimal tools, no FS write
- 26-50 (medium): Local network, moderate tools, limited FS
- 51-75 (high): Wide network, many tools, broad FS access
- 76-100 (critical): Internet exposed, full tools, unrestricted FS
`;
```

### Agency Prompt (`src/security/grasp/prompts/agency.ts`)

```typescript
export const AGENCY_SYSTEM_PROMPT = `
You are performing a security self-assessment of an OpenClaw agent instance.

DIMENSION: Agency
QUESTION: How autonomous is this agent?

Your task is to explore the configuration and assess autonomy level:

1. EXPLORE these areas:
   - Sandbox mode (agents.*.sandbox.mode)
   - Exec security (tools.exec.security, tools.exec.ask)
   - Elevated mode (tools.elevated.enabled, tools.elevated.allowFrom)
   - Cron/scheduled tasks (cron.enabled, cron.jobs)
   - Hooks (hooks.enabled, hooks.*)
   - Auto-reply settings (autoReply.*)
   - Approval requirements

2. ASSESS risk signals:
   - Can it execute code without approval?
   - Can it run scheduled tasks autonomously?
   - Can it respond to triggers without human review?
   - Does it have elevated/sudo capabilities?
   - Are there guardrails on autonomous actions?

3. RETURN structured JSON (same format as governance)

Scoring guide:
- 0-25 (low): All actions require approval, no cron, no hooks
- 26-50 (medium): Some approved actions, limited automation
- 51-75 (high): Significant autonomy, automated responses
- 76-100 (critical): Full autonomy, elevated access, no approvals
`;
```

### Safeguards Prompt (`src/security/grasp/prompts/safeguards.ts`)

```typescript
export const SAFEGUARDS_SYSTEM_PROMPT = `
You are performing a security self-assessment of an OpenClaw agent instance.

DIMENSION: Safeguards
QUESTION: What mechanisms limit potential damage?

Your task is to explore the configuration and assess protective controls:

1. EXPLORE these areas:
   - Docker/sandbox isolation (sandbox.docker.*)
   - Network restrictions (sandbox.docker.network, sandbox.docker.capDrop)
   - Resource limits (sandbox.docker.memory, sandbox.docker.cpu)
   - Safe binary lists (tools.exec.safeBins)
   - DM policies (channels.*.dmPolicy)
   - Rate limiting (rateLimit.*)
   - Content filtering/redaction

2. ASSESS risk signals:
   - Is code execution sandboxed?
   - Are network capabilities restricted?
   - Are resources capped?
   - Are there allowlists for dangerous operations?
   - Is sensitive content filtered?

3. RETURN structured JSON (same format as governance)

Scoring guide:
- 0-25 (low): Full sandbox, network isolated, resource limited
- 26-50 (medium): Partial sandbox, some network access
- 51-75 (high): Minimal isolation, broad access
- 76-100 (critical): No sandbox, unrestricted access
`;
```

### Potential Damage Prompt (`src/security/grasp/prompts/potential-damage.ts`)

```typescript
export const POTENTIAL_DAMAGE_SYSTEM_PROMPT = `
You are performing a security self-assessment of an OpenClaw agent instance.

DIMENSION: Potential Damage
QUESTION: What is the worst-case impact if this agent is compromised?

Your task is to explore the configuration and assess damage potential:

1. EXPLORE these areas:
   - Exec host (tools.exec.host - sandbox vs gateway vs node)
   - Workspace access level (sandbox.workspaceAccess)
   - Browser host control (sandbox.browser.allowHostControl)
   - Elevated access scope (tools.elevated.allowFrom.*)
   - Credential access (stored tokens, API keys)
   - Channel access (what can it message/control)
   - Data access (what files/DBs can it read/write)

2. ASSESS worst-case scenarios:
   - Could it exfiltrate sensitive data?
   - Could it modify/delete critical files?
   - Could it send messages as the user?
   - Could it access credentials or secrets?
   - Could it pivot to other systems?

3. RETURN structured JSON (same format as governance)

Scoring guide:
- 0-25 (low): Sandboxed, no credentials, limited data access
- 26-50 (medium): Some data access, no credentials
- 51-75 (high): Broad data access, some credentials
- 76-100 (critical): Full system access, credentials, messaging
`;
```

## AI Runner (`src/security/grasp/runner.ts`)

Runs a single dimension analysis:

```typescript
import { runEmbeddedPiAgent } from "../../agents/pi-embedded.js";
import type { OpenClawConfig } from "../../config/config.js";
import type { GraspDimension, GraspDimensionResult } from "./types.js";

export type DimensionPrompt = {
  dimension: GraspDimension;
  label: string;
  systemPrompt: string;
};

export async function runDimensionAnalysis(params: {
  config: OpenClawConfig;
  prompt: DimensionPrompt;
  agentId?: string;
  model?: string;
  workspaceDir: string;
  configPath: string;
  stateDir: string;
}): Promise<GraspDimensionResult> {
  // Create a temporary session for this analysis
  const sessionKey = `grasp:${params.prompt.dimension}:${Date.now()}`;

  // Build the user message that kicks off analysis
  const userMessage = `
Analyze the ${params.prompt.label} dimension for this OpenClaw instance.

Key paths to examine:
- Config: ${params.configPath}
- State: ${params.stateDir}
- Workspace: ${params.workspaceDir}

Return your analysis as JSON.
`;

  // Run the agent with the dimension prompt
  const result = await runEmbeddedPiAgent({
    sessionKey,
    config: params.config,
    systemPrompt: params.prompt.systemPrompt,
    message: userMessage,
    model: params.model,
    tools: ["read", "glob", "grep"], // Limited tool set for exploration
    maxTurns: 5, // Limit exploration depth
    outputFormat: "json",
  });

  // Parse the JSON response
  return parseDimensionResult(result, params.prompt);
}

function parseDimensionResult(
  result: /* agent result type */,
  prompt: DimensionPrompt
): GraspDimensionResult {
  // Extract JSON from agent response
  // Validate and normalize the structure
  // Return typed result
}
```

## Main Orchestration (`src/security/grasp/index.ts`)

```typescript
import { loadConfig, type OpenClawConfig } from "../../config/config.js";
import { resolveConfigPath, resolveStateDir } from "../../config/paths.js";
import { runDimensionAnalysis } from "./runner.js";
import { GOVERNANCE_PROMPT } from "./prompts/governance.js";
import { REACH_PROMPT } from "./prompts/reach.js";
import { AGENCY_PROMPT } from "./prompts/agency.js";
import { SAFEGUARDS_PROMPT } from "./prompts/safeguards.js";
import { POTENTIAL_DAMAGE_PROMPT } from "./prompts/potential-damage.js";
import { aggregateScores, levelFromScore } from "./scoring.js";
import type { GraspOptions, GraspReport, GraspAgentProfile } from "./types.js";

const DIMENSION_PROMPTS = [
  GOVERNANCE_PROMPT,
  REACH_PROMPT,
  AGENCY_PROMPT,
  SAFEGUARDS_PROMPT,
  POTENTIAL_DAMAGE_PROMPT,
];

export async function runGraspAssessment(opts: GraspOptions): Promise<GraspReport> {
  const configPath = resolveConfigPath();
  const stateDir = resolveStateDir();
  const workspaceDir = opts.config.agents?.defaults?.workspace ?? process.cwd();

  const agents: GraspAgentProfile[] = [];

  // For each agent (or just the specified one)
  const agentIds = opts.agentId
    ? [opts.agentId]
    : resolveAllAgentIds(opts.config);

  for (const agentId of agentIds) {
    const dimensions = [];

    // Run each dimension analysis
    for (const prompt of DIMENSION_PROMPTS) {
      const result = await runDimensionAnalysis({
        config: opts.config,
        prompt,
        agentId,
        model: opts.model,
        workspaceDir,
        configPath,
        stateDir,
      });
      dimensions.push(result);
    }

    const overallScore = aggregateScores(dimensions.map(d => d.score));

    agents.push({
      agentId,
      isDefault: agentId === resolveDefaultAgentId(opts.config),
      dimensions,
      overallScore,
      overallLevel: levelFromScore(overallScore),
      summary: generateAgentSummary(dimensions),
    });
  }

  const overallScore = Math.max(...agents.map(a => a.overallScore));

  return {
    ts: Date.now(),
    modelUsed: opts.model ?? "default",
    agents,
    globalFindings: [], // Extracted from governance/reach for gateway-level
    overallScore,
    overallLevel: levelFromScore(overallScore),
    summary: countBySeverity(agents.flatMap(a => a.dimensions.flatMap(d => d.findings))),
  };
}
```

## CLI Integration (`src/cli/security-cli.ts`)

Add the `grasp` subcommand:

```typescript
security
  .command("grasp")
  .description("AI-driven self-assessment of agent risk profile (GRASP)")
  .option("--agent <id>", "Analyze specific agent only")
  .option("--model <model>", "Model to use for analysis (default: configured model)")
  .option("--verbose", "Show AI reasoning for each dimension")
  .option("--json", "Output as JSON")
  .action(async (opts: GraspOptions) => {
    const cfg = loadConfig();
    const report = await runGraspAssessment({
      config: cfg,
      agentId: opts.agent,
      model: opts.model,
      verbose: opts.verbose,
    });

    if (opts.json) {
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    console.log(formatGraspReport(report, { verbose: opts.verbose }));
  });
```

## Output Format

### Default View
```
OpenClaw GRASP Self-Assessment

Model: claude-3-5-sonnet (analyzed at 2024-01-15 10:30:00)

┌─────────────────────────────────────────────────────────────────┐
│ Agent: main (default)                                           │
├─────────────────────────────────────────────────────────────────┤
│  G  Governance     [████████░░░░░░░░░░░░]  38  LOW              │
│  R  Reach          [████████████░░░░░░░░]  58  MEDIUM           │
│  A  Agency         [██████████████░░░░░░]  72  HIGH             │
│  S  Safeguards     [██████░░░░░░░░░░░░░░]  28  LOW              │
│  P  Potential Dmg  [████████████████░░░░]  85  CRITICAL         │
│                                                                 │
│  Risk: HIGH (62)                                                │
└─────────────────────────────────────────────────────────────────┘

Overall Risk: HIGH (62)
Summary: 3 critical · 5 warn · 8 info

Run: openclaw security grasp --verbose  for AI reasoning
```

### Verbose View (`--verbose`)
Shows AI reasoning for each dimension:

```
...
G  Governance Analysis:
   AI examined: ~/.openclaw/config.yaml, session logs

   Reasoning: "The agent has logging.level set to 'info' which provides
   moderate visibility. However, diagnostics.enabled is false, creating
   a blind spot for tool execution. The control UI is enabled but has
   no auth token configured when binding to LAN..."

   Findings:
   - [WARN] diagnostics.disabled: Diagnostics disabled reduces observability
   - [INFO] logging.level.info: Logging at info level (consider debug for audit)
...
```

## CLI Options

```
openclaw security grasp [options]

Options:
  --agent <id>    Analyze specific agent only (default: all configured agents)
  --model <model> Model to use for analysis (default: configured model)
  --verbose       Show AI reasoning for each dimension
  --json          Output as JSON
```

Exit codes: 0=low, 1=medium, 2=high, 3=critical

## Implementation Steps

1. **Create `src/security/grasp/types.ts`** - Type definitions
2. **Create dimension prompts** (`src/security/grasp/prompts/*.ts`) - One file per dimension
3. **Create `src/security/grasp/runner.ts`** - Single dimension AI runner
4. **Create `src/security/grasp/scoring.ts`** - Score aggregation utilities
5. **Create `src/security/grasp/format.ts`** - Terminal output formatting
6. **Create `src/security/grasp/index.ts`** - Main orchestration
7. **Modify `src/cli/security-cli.ts`** - Add `grasp` subcommand
8. **Create `src/security/grasp/grasp.test.ts`** - Unit tests

## Key Implementation Details

### AI Runner Integration

The runner needs to:
1. Create a temporary/ephemeral session (no persistence needed)
2. Give the AI limited tools: `read`, `glob`, `grep` (no exec, no write)
3. Enforce structured JSON output
4. Parse and validate the response
5. Handle timeouts/failures gracefully

### Tool Access

The AI should have access to:
- **Read** - Read config files, logs, etc.
- **Glob** - Find files matching patterns
- **Grep** - Search file contents

The AI should NOT have:
- Exec/bash (security risk during self-assessment)
- Write (no changes during assessment)
- Network tools (assessment is local)

### Error Handling

- If AI fails to return valid JSON, retry once with clarifying prompt
- If dimension analysis times out, mark as "unable to assess"
- If no model available, fail with clear error message

## Testing Strategy

### Unit Tests (`src/security/grasp/grasp.test.ts`)

1. **Prompt Tests**
   - Verify each prompt is well-formed
   - Test that prompts produce expected JSON structure

2. **Runner Tests** (mocked)
   - Mock `runEmbeddedPiAgent` to return test responses
   - Test JSON parsing and validation
   - Test error handling for malformed responses

3. **Scoring Tests**
   - Test `levelFromScore` thresholds
   - Test `aggregateScores` with various inputs

4. **Format Tests**
   - Test bar chart rendering
   - Test verbose output formatting
   - Test JSON output structure

### Integration Tests

Due to AI non-determinism, integration tests should:
- Verify the command runs without error
- Verify output structure is valid
- NOT assert on specific scores/findings

## Design Decisions

1. **Model Selection** - Use the user's configured model (respects their choice)

2. **Caching** - Cache results to avoid repeated expensive analysis. Cache key: hash of config + agent ID. Cache location: `~/.openclaw/cache/grasp/`. Default TTL: 1 hour. Use `--no-cache` to force fresh analysis.

3. **Parallel Execution** - Run all 5 dimensions in parallel for speed

## Verification

1. Create branch: `git checkout -b feat/security-grasp`
2. Run `pnpm build` - Type check passes
3. Run `pnpm check` - Lint/format passes
4. Run `pnpm test src/security/grasp` - Unit tests pass
5. Manual test:
   - `openclaw security grasp` - Shows assessment with bar charts
   - `openclaw security grasp --verbose` - Shows AI reasoning
   - `openclaw security grasp --json` - Valid JSON output
   - `openclaw security grasp --agent main` - Single agent only
