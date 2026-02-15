# OpenClawDevCode Plugin System Analysis

**Research Date:** 2026-02-14
**Repository:** https://github.com/jcafeitosa/openclawdevcode
**Purpose:** Identify adaptable patterns for OpenClaw gateway project

---

## Executive Summary

The OpenClawDevCode repository implements a sophisticated plugin architecture for Claude Code that extends functionality through:

- **Commands** (slash commands like `/commit`, `/feature-dev`)
- **Agents** (specialized AI agents with specific tools and models)
- **Skills** (reusable knowledge modules)
- **Hooks** (event handlers for SessionStart, PreToolUse, PostToolUse, Stop, UserPromptSubmit)

**Key Insight:** The plugin system is declarative and markdown-driven, allowing non-technical users to extend functionality without writing code.

---

## Plugin Architecture Pattern

### Directory Structure

```
plugins/
├── plugin-name/
│   ├── .claude-plugin/
│   │   └── plugin.json          # Plugin metadata (name, version, author, description)
│   ├── commands/                # Slash commands (optional)
│   │   └── command-name.md      # Command definition with YAML frontmatter
│   ├── agents/                  # Specialized agents (optional)
│   │   └── agent-name.md        # Agent definition with YAML frontmatter
│   ├── skills/                  # Reusable knowledge (optional)
│   │   └── skill-name.md        # Skill definition
│   ├── hooks/                   # Event handlers (optional)
│   │   ├── hooks.json           # Hook configuration
│   │   └── *.py                 # Python hook implementations
│   ├── .mcp.json                # External tool configuration (optional)
│   └── README.md                # Plugin documentation
```

### Marketplace Manifest

`.claude-plugin/marketplace.json` at repo root:

```json
{
  "$schema": "https://anthropic.com/claude-code/marketplace.schema.json",
  "name": "claude-code-plugins",
  "version": "1.0.0",
  "description": "Plugin collection description",
  "owner": {
    "name": "Anthropic",
    "email": "support@anthropic.com"
  },
  "plugins": [
    {
      "name": "plugin-name",
      "description": "Plugin description",
      "version": "1.0.0",
      "author": { "name": "...", "email": "..." },
      "source": "./plugins/plugin-name",
      "category": "development|productivity|security|learning"
    }
  ]
}
```

---

## Plugin Capabilities Breakdown

### 1. Commands (Slash Commands)

Commands are markdown files with YAML frontmatter that define executable workflows.

**Structure:**

```markdown
---
description: Command description shown in /help
argument-hint: Optional hint text for arguments
allowed-tools: ["Bash", "Read", "Write", "Grep", "TodoWrite"]
---

# Command Instructions

Context gathering with dynamic commands:

- Current status: !`git status`
- Recent commits: !`git log --oneline -10`

Your task: ...
Follow these steps: ...
```

**Key Features:**

- `allowed-tools`: Restricts which tools the command can use (security boundary)
- Dynamic context injection: `!`git status`` syntax executes and injects output
- Argument passing via `$ARGUMENTS` variable
- Multi-phase workflows with TodoWrite integration

**Examples:**

- `/commit` - Analyzes git status/diff, creates appropriate commit message
- `/feature-dev` - 7-phase feature development workflow (discovery → exploration → architecture → implementation → review)
- `/hookify` - Creates custom hook rules from conversation analysis

---

### 2. Agents (Specialized AI Agents)

Agents are scoped AI workers with specific tools, models, and roles.

**Structure:**

```markdown
---
name: agent-name
description: What this agent does
tools: Glob, Grep, Read, WebFetch, TodoWrite
model: sonnet|opus|haiku
color: yellow|blue|green|red
---

You are an expert [role] specializing in [domain].

## Core Mission

[Primary objective]

## Analysis Approach

[Methodology]

## Output Guidance

[Expected deliverables]
```

**Key Features:**

- **Tool restriction**: Each agent only has access to specified tools (principle of least privilege)
- **Model selection**: Choose appropriate model (haiku for simple tasks, opus for complex reasoning)
- **Parallel execution**: Launch multiple agents simultaneously for different perspectives
- **Structured output**: Agents return specific deliverables (file lists, architecture diagrams, issue reports)

**Examples:**

- `code-explorer` (sonnet): Traces execution paths, maps architecture layers
- `code-architect` (sonnet): Designs implementation approaches with trade-off analysis
- `code-reviewer` (sonnet): Reviews for simplicity, bugs, and convention compliance
- `silent-failure-hunter` (opus): Detects error handling gaps in PRs
- `comment-analyzer` (sonnet): Evaluates code comment quality
- `conversation-analyzer` (haiku): Scans chat history for unwanted behaviors

---

### 3. Skills (Reusable Knowledge Modules)

Skills are markdown documents loaded on-demand to provide specialized knowledge.

**Structure:**

```markdown
# Skill Title

## When to Use This Skill

[Trigger conditions]

## Core Concepts

[Domain knowledge]

## Best Practices

[Guidelines and patterns]

## Examples

[Code samples, workflows]
```

**Key Features:**

- Loaded via `Skill` tool call: `{skill: "frontend-design"}`
- Auto-invoked for specific contexts (e.g., frontend-design skill triggers on UI work)
- No execution logic - pure knowledge/guidance
- Can reference other skills for composition

**Examples:**

- `frontend-design` - Bold UI design principles, avoids generic AI aesthetics
- `hookify:writing-rules` - Syntax and examples for writing hook rules
- `plugin-structure` - How to organize plugin files and manifests
- `mcp-integration` - Integrating external MCP servers into plugins

---

### 4. Hooks (Event Handlers)

Hooks intercept specific lifecycle events to inject behavior.

**Hook Types:**

1. **SessionStart** - Executes when conversation begins
2. **PreToolUse** - Intercepts before tool execution (can block/warn)
3. **PostToolUse** - Executes after tool completes
4. **Stop** - Intercepts when agent tries to end session
5. **UserPromptSubmit** - Intercepts user input before processing

**Configuration Pattern (hookify):**

Rules stored as markdown files in `.claude/hookify.*.local.md`:

```markdown
---
name: rule-name
enabled: true
event: bash|file|stop|prompt|all
pattern: regex_pattern
action: warn|block
---

⚠️ Message shown to Claude when rule triggers
```

**Advanced Conditions:**

```markdown
---
name: sensitive-files
enabled: true
event: file
conditions:
  - field: file_path
    operator: regex_match
    pattern: \.env$
  - field: new_text
    operator: contains
    pattern: API_KEY
action: block
---

🚫 Cannot write API keys to .env files
```

**Implementation (Python):**

```python
# hooks/pretooluse.py
def pretooluse(event_data: dict) -> dict:
    tool_name = event_data.get('tool_name')
    tool_input = event_data.get('tool_input')

    # Load rules from .claude/hookify.*.local.md
    rules = load_rules()

    for rule in rules:
        if matches_pattern(rule, tool_name, tool_input):
            if rule['action'] == 'block':
                return {'blocked': True, 'message': rule['message']}
            elif rule['action'] == 'warn':
                return {'warning': rule['message']}

    return {}
```

**Examples:**

- `security-guidance` - Warns about command injection, XSS, eval usage (9 patterns)
- `hookify` - User-defined rules loaded from markdown files
- `explanatory-output-style` - Injects educational context at SessionStart
- `ralph-wiggum` - Intercepts Stop events to continue iteration loops

---

## Complete Plugin Inventory

### Development Tools

#### 1. **feature-dev** (Comprehensive Feature Development)

- **Category:** Development
- **Command:** `/feature-dev`
- **Agents:** code-explorer, code-architect, code-reviewer
- **Workflow:** 7 phases
  1. Discovery - Clarify requirements
  2. Codebase Exploration - Launch parallel code-explorer agents
  3. Clarifying Questions - Resolve ambiguities BEFORE design
  4. Architecture Design - Multiple approaches with trade-offs
  5. Implementation - User-approved approach
  6. Quality Review - Parallel reviewers (simplicity, bugs, conventions)
  7. Summary - Document decisions and next steps
- **Relevance to OpenClaw:** ⭐⭐⭐⭐⭐ HIGH
  - Perfect template for feature implementation workflow
  - Multi-agent parallel analysis pattern
  - Explicit approval gates prevent over-engineering

#### 2. **plugin-dev** (Plugin Development Toolkit)

- **Category:** Development
- **Command:** `/plugin-dev:create-plugin`
- **Agents:** agent-creator, plugin-validator, skill-reviewer
- **Skills:** 7 skills covering hooks, MCP, structure, settings, commands, agents, skills
- **Workflow:** 8-phase guided plugin creation
- **Relevance to OpenClaw:** ⭐⭐⭐⭐ MEDIUM-HIGH
  - Meta-plugin for creating plugins
  - Demonstrates best practices for plugin architecture
  - Validation patterns worth adopting

#### 3. **agent-sdk-dev** (Agent SDK Development)

- **Category:** Development
- **Command:** `/new-sdk-app`
- **Agents:** agent-sdk-verifier-py, agent-sdk-verifier-ts
- **Purpose:** Setup and validate Agent SDK projects
- **Relevance to OpenClaw:** ⭐⭐ LOW
  - Specific to Claude Agent SDK
  - Not directly applicable to our gateway architecture

---

### Code Quality & Review

#### 4. **code-review** (Automated PR Review)

- **Category:** Productivity
- **Command:** `/code-review [--comment]`
- **Agents:** 5 parallel sonnet agents
  1. CLAUDE.md compliance (2 agents in parallel)
  2. Opus bug detection (diff-only)
  3. Opus bug detection (introduced code)
  4. Validation agents (confirm findings)
- **Confidence Scoring:** Filters false positives via validation subagents
- **Relevance to OpenClaw:** ⭐⭐⭐⭐⭐ HIGH
  - Multi-agent parallel review pattern
  - Confidence-based filtering (validate findings before reporting)
  - GitHub integration (`gh` CLI + inline comments)
  - Adaptable to our codebase standards

#### 5. **pr-review-toolkit** (Specialized PR Reviewers)

- **Category:** Productivity
- **Command:** `/pr-review-toolkit:review-pr [comments|tests|errors|types|code|simplify|all]`
- **Agents:** 6 specialized agents
  - `comment-analyzer` - Comment quality and clarity
  - `pr-test-analyzer` - Test coverage and quality
  - `silent-failure-hunter` - Error handling gaps
  - `type-design-analyzer` - Type system design
  - `code-reviewer` - Code quality and patterns
  - `code-simplifier` - Complexity reduction
- **Relevance to OpenClaw:** ⭐⭐⭐⭐ MEDIUM-HIGH
  - Demonstrates agent specialization
  - Selective aspect review (user chooses focus areas)
  - Each agent has narrow, deep expertise

---

### Git Workflow

#### 6. **commit-commands** (Git Workflow Automation)

- **Category:** Productivity
- **Commands:** `/commit`, `/commit-push-pr`, `/clean_gone`
- **Features:**
  - `/commit` - Analyzes git status/diff, generates conventional commit message
  - `/commit-push-pr` - Full workflow: commit → push → create PR
  - `/clean_gone` - Cleanup merged branches
- **Tool Restrictions:** Only allows `git` commands (security boundary)
- **Relevance to OpenClaw:** ⭐⭐⭐⭐ MEDIUM-HIGH
  - Already have similar functionality in OpenClaw
  - Good reference for tool restriction patterns
  - Dynamic context injection (`!`git status``)

---

### Behavioral Controls

#### 7. **hookify** (Custom Hook Creator)

- **Category:** Productivity
- **Commands:** `/hookify`, `/hookify:list`, `/hookify:configure`, `/hookify:help`
- **Agents:** conversation-analyzer
- **Skills:** writing-rules
- **Hooks:** LoadRules (loads markdown rules), PreToolUse/PostToolUse/Stop matchers
- **Core Innovation:** User-defined rules via markdown files
- **Relevance to OpenClaw:** ⭐⭐⭐⭐⭐ HIGH
  - **Game-changer for customization**
  - Non-technical users can define behaviors
  - Regex pattern matching + action (warn/block)
  - Multi-condition rules for complex scenarios
  - No restart needed (rules loaded on-demand)
  - **MUST ADAPT:** This pattern enables user-defined guardrails without code

**Adaptation Ideas for OpenClaw:**

```markdown
# .openclaw/hooks/rate-limit-warning.md

---

name: rate-limit-warning
enabled: true
event: model-call
conditions:

- field: model
  operator: equals
  pattern: claude-opus-4-6
- field: input_tokens
  operator: greater_than
  value: 50000
  action: warn

---

⚠️ High token usage detected (>50k) for Opus model.
Consider using Sonnet for this task to reduce costs.
```

#### 8. **security-guidance** (Security Warning Hook)

- **Category:** Security
- **Hooks:** PreToolUse
- **Patterns:** 9 security checks
  1. Command injection (`os.system`, `exec`, `eval`)
  2. XSS vulnerabilities (`innerHTML`, `dangerouslySetInnerHTML`)
  3. SQL injection (raw queries without parameterization)
  4. Unsafe deserialization (`pickle.loads`)
  5. Path traversal (unvalidated file paths)
  6. Hardcoded secrets (API keys, passwords in code)
  7. Insecure random (`random.random` for crypto)
  8. Unsafe HTTP (`http://` in API calls)
  9. Disabled CSRF protection
- **Relevance to OpenClaw:** ⭐⭐⭐⭐ MEDIUM-HIGH
  - Security-first development culture
  - Pattern matching for common vulnerabilities
  - Educational warnings (teaches secure coding)

---

### Learning & Output Styles

#### 9. **explanatory-output-style** (Educational Context)

- **Category:** Learning
- **Hooks:** SessionStart
- **Purpose:** Mimics deprecated "Explanatory" output style
- **Behavior:** Injects context about implementation choices and patterns
- **Relevance to OpenClaw:** ⭐⭐⭐ MEDIUM
  - Useful for onboarding new developers
  - Explains "why" behind architectural decisions
  - Can be adapted for OpenClaw contribution guide

#### 10. **learning-output-style** (Interactive Learning)

- **Category:** Learning
- **Hooks:** SessionStart
- **Purpose:** Mimics unshipped "Learning" mode
- **Behavior:** Requests user to write meaningful code (5-10 lines) at decision points
- **Relevance to OpenClaw:** ⭐⭐ LOW
  - Educational tool, not productivity tool
  - Could be useful for OpenClaw plugin tutorials

#### 11. **ralph-wiggum** (Autonomous Iteration Loops)

- **Category:** Development
- **Commands:** `/ralph-loop`, `/cancel-ralph`
- **Hooks:** Stop (intercepts exit to continue iteration)
- **Purpose:** Claude works on same task repeatedly until completion
- **Relevance to OpenClaw:** ⭐⭐⭐ MEDIUM
  - Interesting pattern for autonomous agents
  - Risk of runaway execution (needs safety limits)
  - Could be useful for long-running gateway tasks

---

### Migration & Specialized

#### 12. **claude-opus-4-5-migration** (Model Migration)

- **Category:** Development
- **Skills:** claude-opus-4-5-migration
- **Purpose:** Automated migration of model strings and beta headers
- **Relevance to OpenClaw:** ⭐ LOW
  - One-time migration tool
  - Not applicable to our gateway

#### 13. **frontend-design** (UI Design Guidance)

- **Category:** Development
- **Skills:** frontend-design
- **Auto-invoked:** Triggers on frontend work
- **Principles:**
  - Bold design choices (avoid generic AI aesthetics)
  - Typography hierarchy
  - Animation and micro-interactions
  - Visual details (shadows, gradients, spacing)
- **Relevance to OpenClaw:** ⭐⭐⭐ MEDIUM
  - Could enhance Control UI design
  - Principles applicable to gateway admin interface
  - Auto-invocation pattern worth studying

---

## Key Patterns Worth Adopting

### 1. **Multi-Agent Parallel Analysis** (feature-dev, code-review)

**Pattern:**

```markdown
Launch 3 agents in parallel, each with different focus:

1. Agent A: Analyze similar existing features
2. Agent B: Map high-level architecture
3. Agent C: Identify UI/UX patterns

Each agent returns:

- Key findings
- 5-10 files to read for deeper context

After agents complete: Read all recommended files before proceeding
```

**Benefits:**

- Faster analysis (parallel > sequential)
- Multiple perspectives reduce blind spots
- Structured output (file lists) prevents information overload

**OpenClaw Adaptation:**

```markdown
# Gateway Feature Development

Phase 1: Parallel Analysis

- Agent A: Analyze existing routing/middleware patterns in src/gateway/
- Agent B: Map plugin integration points in src/infra/
- Agent C: Review similar features in upstream openclaw

Phase 2: Read Recommended Files

- Consolidate file lists from all agents
- Read key files to build mental model

Phase 3: Design & Implement
```

---

### 2. **Confidence-Based Filtering** (code-review)

**Pattern:**

```markdown
Step 1: Launch 4 bug-detection agents in parallel
Step 2: For each issue found, launch validation subagent
Step 3: Filter out issues that fail validation
Step 4: Only report high-confidence findings
```

**Benefits:**

- Reduces false positives (builds trust with users)
- Educational for the AI (learns from validation failures)
- Scalable (can add more detection agents without noise)

**OpenClaw Adaptation:**

```markdown
# Gateway Security Audit

Detection Agents:

- CSRF vulnerability scanner
- Auth bypass detector
- Rate limit gap finder
- Input validation checker

Validation Agents:

- Confirm CSRF: Check if endpoint is state-changing + lacks token
- Confirm auth bypass: Verify missing auth middleware
- Confirm rate limit: Check if public endpoint lacks rate limiting
- Confirm input validation: Verify missing schema validation

Only report issues with >90% confidence
```

---

### 3. **Markdown-Driven Hook Rules** (hookify)

**Pattern:**

```markdown
# .openclaw/hooks/custom-rule.md

---

name: rule-name
enabled: true
event: bash|file|stop|prompt
pattern: regex_pattern
action: warn|block

---

Message to show when rule triggers
```

**Benefits:**

- Non-technical users can define behaviors
- No code changes required (hot-reload)
- Version-controllable (committed to repo)
- Self-documenting (message explains why)

**OpenClaw Adaptation:**

```markdown
# .openclaw/hooks/model-cost-warning.md

---

name: model-cost-warning
enabled: true
event: model-call
conditions:

- field: model
  operator: equals
  pattern: claude-opus-4-6
- field: estimated_cost
  operator: greater_than
  value: 5.0
  action: warn

---

⚠️ High-cost model call detected (>$5 estimated)
Consider using Sonnet 4.5 or Haiku for this task
```

---

### 4. **Tool Restriction for Security** (commit-commands, agents)

**Pattern:**

```markdown
---
allowed-tools: ["Bash(git add:*)", "Bash(git status:*)", "Bash(git commit:*)"]
---

Your task: Create a git commit
You can ONLY use git commands. No other tools.
```

**Benefits:**

- Principle of least privilege
- Prevents accidental file modifications
- Clear security boundary
- Wildcard patterns for command filtering

**OpenClaw Adaptation:**

```markdown
# Gateway Diagnostic Command

---

## allowed-tools: ["Bash(systemctl status:*)", "Bash(journalctl:*)", "Read"]

Diagnose gateway issues. You can:

- Check service status
- Read log files
- View journal entries

You CANNOT:

- Restart services
- Modify config files
- Execute arbitrary commands
```

---

### 5. **Dynamic Context Injection** (commit-commands)

**Pattern:**

```markdown
## Context

- Current git status: !`git status`
- Current git diff: !`git diff HEAD`
- Recent commits: !`git log --oneline -10`

## Your Task

Based on the above changes, create a commit.
```

**Benefits:**

- Fresh context every invocation
- No stale cached data
- Reduces token usage (only inject when needed)

**OpenClaw Adaptation:**

```markdown
# Gateway Health Check

## Current State

- Gateway status: !`systemctl status openclaw-gateway`
- Active connections: !`ss -tnp | grep 18789`
- Recent errors: !`journalctl -u openclaw-gateway -n 20 --no-pager`

## Your Task

Analyze the gateway health and report issues.
```

---

### 6. **Phase-Based Approval Gates** (feature-dev)

**Pattern:**

```markdown
Phase 1: Discovery
Phase 2: Exploration
Phase 3: Clarifying Questions → WAIT FOR USER APPROVAL
Phase 4: Architecture Design → PRESENT OPTIONS, WAIT FOR CHOICE
Phase 5: Implementation → WAIT FOR EXPLICIT GO-AHEAD
Phase 6: Review
Phase 7: Summary
```

**Benefits:**

- Prevents over-engineering
- User stays in control
- Clear decision points
- Can abort early if direction is wrong

**OpenClaw Adaptation:**

```markdown
# Gateway Plugin Installation

Phase 1: Analyze plugin manifest and dependencies
Phase 2: Check compatibility with current gateway version
Phase 3: → USER APPROVAL: "Install plugin X from Y?"
Phase 4: Download and verify plugin signature
Phase 5: → USER APPROVAL: "Grant plugin these permissions?"
Phase 6: Install and configure plugin
Phase 7: Verify installation and report status
```

---

### 7. **Agent Specialization with Model Selection** (pr-review-toolkit)

**Pattern:**

```markdown
# comment-analyzer.md

---

model: sonnet
tools: Read, Grep

---

You analyze code comment quality (narrow, deep focus)

# silent-failure-hunter.md

---

model: opus
tools: Read, Bash(gh pr diff:\*)

---

You detect error handling gaps (complex reasoning)
```

**Benefits:**

- Right model for right task (cost optimization)
- Haiku for simple/fast, Sonnet for balanced, Opus for complex
- Tool restrictions prevent scope creep
- Each agent is expert in one domain

**OpenClaw Adaptation:**

```markdown
# Gateway Agent Roles

quick-diagnostics.md (Haiku):

- Check service status
- Parse recent errors
- Return structured findings

route-analyzer.md (Sonnet):

- Analyze routing config
- Trace request flow
- Identify bottlenecks

security-auditor.md (Opus):

- Deep security analysis
- Threat modeling
- Attack surface mapping
```

---

## Recommended Adaptations for OpenClaw

### Priority 1: MUST IMPLEMENT

#### 1.1 Hookify-Style Rule System

**File:** `src/gateway/hooks/rule-engine.ts`

```typescript
interface HookRule {
  name: string;
  enabled: boolean;
  event: "model-call" | "request" | "response" | "error" | "all";
  conditions: Array<{
    field: string;
    operator: "equals" | "contains" | "regex_match" | "greater_than" | "less_than";
    pattern?: string;
    value?: any;
  }>;
  action: "warn" | "block" | "log" | "notify";
  message: string;
}

// Load rules from .openclaw/hooks/*.md
async function loadRules(): Promise<HookRule[]> {
  const rulesDir = path.join(process.cwd(), ".openclaw", "hooks");
  const files = await glob("*.md", { cwd: rulesDir });
  return Promise.all(files.map(parseRuleFile));
}

// Match rule against event data
function matchesRule(rule: HookRule, eventData: any): boolean {
  return rule.conditions.every((cond) => {
    const fieldValue = get(eventData, cond.field);
    switch (cond.operator) {
      case "equals":
        return fieldValue === cond.value;
      case "contains":
        return String(fieldValue).includes(cond.pattern);
      case "regex_match":
        return new RegExp(cond.pattern).test(fieldValue);
      case "greater_than":
        return fieldValue > cond.value;
      case "less_than":
        return fieldValue < cond.value;
    }
  });
}
```

**Example Rules:**

`.openclaw/hooks/rate-limit-protection.md`:

```markdown
---
name: rate-limit-protection
enabled: true
event: model-call
conditions:
  - field: user_id
    operator: equals
    pattern: anonymous
  - field: tokens_this_hour
    operator: greater_than
    value: 10000
action: block
---

🚫 Rate limit exceeded for anonymous users.
Please authenticate to continue.
```

`.openclaw/hooks/cost-warning.md`:

```markdown
---
name: high-cost-warning
enabled: true
event: model-call
conditions:
  - field: model
    operator: regex_match
    pattern: opus|o1
  - field: estimated_cost_usd
    operator: greater_than
    value: 2.0
action: warn
---

⚠️ High-cost model call detected (>${estimated_cost_usd}).
Consider using a cheaper model for this task.
```

---

#### 1.2 Multi-Agent Parallel Analysis Pattern

**File:** `src/agents/workflows/feature-dev.ts`

```typescript
interface AgentTask {
  name: string;
  model: "haiku" | "sonnet" | "opus";
  tools: string[];
  prompt: string;
}

async function parallelAnalysis(tasks: AgentTask[]): Promise<any[]> {
  const agents = tasks.map((task) =>
    launchAgent({
      name: task.name,
      model: resolveModelId(task.model),
      tools: task.tools,
      prompt: task.prompt,
    }),
  );

  const results = await Promise.all(agents);

  // Consolidate findings
  const allFiles = new Set<string>();
  results.forEach((r) => r.files_to_read?.forEach((f) => allFiles.add(f)));

  return {
    findings: results,
    recommended_files: Array.from(allFiles),
    summary: consolidateFindings(results),
  };
}

// Usage
const analysis = await parallelAnalysis([
  {
    name: "routing-patterns",
    model: "sonnet",
    tools: ["Read", "Grep", "Glob"],
    prompt: "Analyze existing routing patterns in src/gateway/routing/",
  },
  {
    name: "plugin-integration",
    model: "sonnet",
    tools: ["Read", "Grep"],
    prompt: "Map plugin integration points in src/infra/",
  },
  {
    name: "security-boundaries",
    model: "opus",
    tools: ["Read", "Grep"],
    prompt: "Identify security boundaries and auth flows",
  },
]);

// Read all recommended files before proceeding
for (const file of analysis.recommended_files) {
  await readFile(file);
}
```

---

#### 1.3 Confidence-Based Issue Filtering

**File:** `src/agents/workflows/code-review.ts`

```typescript
interface Issue {
  type: "bug" | "security" | "style" | "performance";
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  file: string;
  line: number;
  confidence?: number; // 0-100
}

async function reviewWithConfidence(prNumber: number): Promise<Issue[]> {
  // Step 1: Launch detection agents in parallel
  const detectionAgents = await Promise.all([
    detectBugs(prNumber),
    detectSecurityIssues(prNumber),
    detectPerformanceIssues(prNumber),
  ]);

  const allIssues = detectionAgents.flat();

  // Step 2: Validate each issue
  const validatedIssues = await Promise.all(
    allIssues.map(async (issue) => {
      const validation = await validateIssue(issue);
      return { ...issue, confidence: validation.confidence };
    }),
  );

  // Step 3: Filter by confidence threshold
  const highConfidenceIssues = validatedIssues.filter((i) => i.confidence >= 85);

  return highConfidenceIssues;
}

async function validateIssue(issue: Issue): Promise<{ confidence: number; reasoning: string }> {
  const agent = await launchAgent({
    name: "issue-validator",
    model: issue.severity === "critical" ? "opus" : "sonnet",
    tools: ["Read", "Grep"],
    prompt: `Validate this issue: ${JSON.stringify(issue)}

    Return confidence score (0-100) and reasoning.
    - 100: Definitely a real issue
    - 50: Uncertain, needs human review
    - 0: False positive
    `,
  });

  return agent.result;
}
```

---

### Priority 2: SHOULD IMPLEMENT

#### 2.1 Tool Restriction Pattern

**File:** `src/gateway/commands/command-executor.ts`

```typescript
interface CommandConfig {
  name: string;
  allowedTools: string[]; // ["Bash(git add:*)", "Read", "Write(.claude/*:*)"]
  prompt: string;
}

function validateToolCall(config: CommandConfig, toolName: string, toolInput: any): boolean {
  return config.allowedTools.some((pattern) => {
    if (pattern === toolName) return true; // Exact match

    // Wildcard pattern: "Bash(git add:*)"
    const match = pattern.match(/^(\w+)\(([^:]+):(.+)\)$/);
    if (match) {
      const [, tool, command, args] = match;
      if (tool !== toolName) return false;

      const actualCommand = toolInput.command || "";
      if (!actualCommand.startsWith(command)) return false;

      if (args === "*") return true; // Any args
      return actualCommand.match(new RegExp(args));
    }

    return false;
  });
}
```

---

#### 2.2 Dynamic Context Injection

**File:** `src/gateway/commands/context-injector.ts`

```typescript
async function injectDynamicContext(template: string): Promise<string> {
  // Replace !`command` with command output
  const regex = /!\`([^`]+)\`/g;
  let result = template;

  for (const match of template.matchAll(regex)) {
    const command = match[1];
    const output = await execCommand(command);
    result = result.replace(match[0], output.trim());
  }

  return result;
}

// Usage
const commandTemplate = `
## Context
- Gateway status: !\`systemctl status openclaw-gateway\`
- Active connections: !\`ss -tnp | grep 18789\`

## Your Task
Analyze gateway health
`;

const processedPrompt = await injectDynamicContext(commandTemplate);
```

---

### Priority 3: NICE TO HAVE

#### 3.1 Agent Marketplace

**File:** `.openclaw/marketplace.json`

```json
{
  "$schema": "https://openclaw.ai/schemas/marketplace.json",
  "name": "openclaw-gateway-agents",
  "version": "1.0.0",
  "agents": [
    {
      "name": "gateway-diagnostics",
      "description": "Diagnose gateway health and performance issues",
      "model": "sonnet",
      "tools": ["Bash(systemctl:*)", "Read", "Grep"],
      "source": "./agents/gateway-diagnostics.md"
    },
    {
      "name": "security-auditor",
      "description": "Audit gateway security configuration",
      "model": "opus",
      "tools": ["Read", "Grep"],
      "source": "./agents/security-auditor.md"
    }
  ]
}
```

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1-2)

- [ ] Implement hook rule engine (markdown-driven)
- [ ] Add rule loading from `.openclaw/hooks/*.md`
- [ ] Support `warn` and `block` actions
- [ ] Test with sample rules (rate limiting, cost warnings)

### Phase 2: Multi-Agent (Week 3-4)

- [ ] Parallel agent launcher utility
- [ ] Result consolidation logic
- [ ] File recommendation system
- [ ] Test with feature development workflow

### Phase 3: Code Review (Week 5-6)

- [ ] Detection agent templates
- [ ] Validation agent framework
- [ ] Confidence scoring system
- [ ] GitHub integration (if applicable)

### Phase 4: Command System (Week 7-8)

- [ ] Tool restriction validator
- [ ] Dynamic context injection
- [ ] Command registry
- [ ] Test with diagnostic commands

---

## Files to Deep-Dive

If pursuing hookify pattern:

1. `/plugins/hookify/core/rule_engine.py` - Core matching logic
2. `/plugins/hookify/matchers/__init__.py` - Pattern matchers
3. `/plugins/hookify/hooks/pretooluse.py` - PreToolUse implementation
4. `/plugins/hookify/commands/hookify.md` - User-facing command

If pursuing multi-agent pattern:

1. `/plugins/feature-dev/commands/feature-dev.md` - Full workflow
2. `/plugins/feature-dev/agents/code-explorer.md` - Agent template
3. `/plugins/code-review/commands/code-review.md` - Parallel launch + validation

If pursuing tool restriction:

1. `/plugins/commit-commands/commands/commit.md` - allowed-tools example
2. Look for tool validation logic in core Claude Code (not in this repo)

---

## Conclusion

The OpenClawDevCode plugin system demonstrates a **declarative, markdown-driven architecture** that empowers users to extend functionality without writing code. The key innovations adaptable to OpenClaw are:

1. **Hookify pattern** - User-defined behavioral rules via markdown
2. **Multi-agent parallelism** - Launch specialized agents simultaneously
3. **Confidence-based filtering** - Validate findings before reporting
4. **Tool restriction** - Security boundaries via allowed-tools
5. **Dynamic context** - Inject fresh state into prompts

**Highest Impact for OpenClaw:**

- Hookify rule system for user-defined rate limiting, cost warnings, security policies
- Multi-agent pattern for complex gateway diagnostics and feature development
- Tool restriction for secure command execution in gateway context

**Next Steps:**

1. Prototype hookify rule engine (1-2 days)
2. Test with simple rules (rate limit warning, model cost alert)
3. Gather user feedback on rule syntax
4. Iterate on agent parallelism pattern for gateway diagnostics
