import fs from "node:fs";
import path from "node:path";
import type { ReasoningLevel, ThinkLevel } from "../auto-reply/thinking.js";
import type { MemoryCitationsMode } from "../config/types.memory.js";
import type { ResolvedTimeFormat } from "./date-time.js";
import type { EmbeddedContextFile } from "./pi-embedded-helpers.js";
import { SILENT_REPLY_TOKEN } from "../auto-reply/tokens.js";
import { type OpenClawConfig, loadConfig } from "../config/config.js";
import { listDeliverableMessageChannels } from "../utils/message-channel.js";
import {
  listAgentIds,
  resolveAgentConfig,
  resolveAgentDir,
  resolveAgentRole,
} from "./agent-scope.js";
import { resolveAgentIdentity } from "./identity.js";
import { DECISION_TREES, DEVELOPMENT_WORKFLOWS } from "./workflow-playbook.js";

/**
 * Controls which hardcoded sections are included in the system prompt.
 * - "full": All sections (default, for main agent)
 * - "minimal": Reduced sections (Tooling, Workspace, Runtime) - used for subagents
 * - "none": Just basic identity line, no sections
 */
export type PromptMode = "full" | "minimal" | "none";

function buildSkillsSection(params: {
  skillsPrompt?: string;
  isMinimal: boolean;
  readToolName: string;
}) {
  if (params.isMinimal) {
    return [];
  }
  const trimmed = params.skillsPrompt?.trim();
  if (!trimmed) {
    return [];
  }
  return [
    "## Skills (mandatory)",
    "Before replying: scan <available_skills> <description> entries.",
    `- If exactly one skill clearly applies: read its SKILL.md at <location> with \`${params.readToolName}\`, then follow it.`,
    "- If multiple could apply: choose the most specific one, then read/follow it.",
    "- If none clearly apply: do not read any SKILL.md.",
    "Constraints: never read more than one skill up front; only read after selecting.",
    trimmed,
    "",
  ];
}

function buildMemorySection(params: {
  isMinimal: boolean;
  availableTools: Set<string>;
  citationsMode?: MemoryCitationsMode;
}) {
  if (params.isMinimal) {
    return [];
  }
  if (!params.availableTools.has("memory_search") && !params.availableTools.has("memory_get")) {
    return [];
  }
  const lines = [
    "## Memory Recall",
    "Before answering anything about prior work, decisions, dates, people, preferences, or todos: run memory_search on MEMORY.md + memory/*.md; then use memory_get to pull only the needed lines. If low confidence after search, say you checked.",
  ];
  if (params.citationsMode === "off") {
    lines.push(
      "Citations are disabled: do not mention file paths or line numbers in replies unless the user explicitly asks.",
    );
  } else {
    lines.push(
      "Citations: include Source: <path#line> when it helps the user verify memory snippets.",
    );
  }
  lines.push("");
  return lines;
}

function buildUserIdentitySection(ownerLine: string | undefined, isMinimal: boolean) {
  if (!ownerLine || isMinimal) {
    return [];
  }
  return ["## User Identity", ownerLine, ""];
}

function buildTimeSection(params: { userTimezone?: string }) {
  if (!params.userTimezone) {
    return [];
  }
  return ["## Current Date & Time", `Time zone: ${params.userTimezone}`, ""];
}

function buildReplyTagsSection(isMinimal: boolean) {
  if (isMinimal) {
    return [];
  }
  return [
    "## Reply Tags",
    "To request a native reply/quote on supported surfaces, include one tag in your reply:",
    "- [[reply_to_current]] replies to the triggering message.",
    "- [[reply_to:<id>]] replies to a specific message id when you have it.",
    "Whitespace inside the tag is allowed (e.g. [[ reply_to_current ]] / [[ reply_to: 123 ]]).",
    "Tags are stripped before sending; support depends on the current channel config.",
    "",
  ];
}

function buildLocalFirstExecutionSection(params: {
  isMinimal: boolean;
  availableTools: Set<string>;
}) {
  const hasWebTools =
    params.availableTools.has("web_search") || params.availableTools.has("web_fetch");
  if (params.isMinimal) {
    return [
      "## Local-First Policy",
      "- Execute locally first using OpenClaw tools and workspace data.",
      hasWebTools
        ? "- Use web_search/web_fetch only when external or up-to-date facts are strictly required."
        : "- External web lookup is optional and should be avoided unless strictly required.",
      "",
    ];
  }
  return [
    "## Local-First Execution Policy",
    "- Default to local execution: workspace files + OpenClaw gateway/tools + local services first.",
    "- Do not use external paths (curl/web) when the same objective can be achieved via OpenClaw tools.",
    "- Prefer OpenClaw-native operations for messaging, sessions, collaboration, delegation, status, and runtime control.",
    hasWebTools
      ? "- Use `web_search`/`web_fetch` only when the task explicitly needs external or up-to-date information that is unavailable locally."
      : "- External web lookup should be treated as exceptional; rely on local data and tools.",
    "",
  ];
}

function buildContextBudgetSection(params: { isMinimal: boolean; availableTools: Set<string> }) {
  if (params.isMinimal) {
    return ["## Context Budget", "- Load only the minimum context needed to decide and act.", ""];
  }

  const hasSessionsHistory = params.availableTools.has("sessions_history");
  const hasSessionsList = params.availableTools.has("sessions_list");
  const hasMemorySearch = params.availableTools.has("memory_search");

  const lines = [
    "## Context Budget Protocol",
    "- Keep model context lean: fetch targeted slices, decide, execute, then summarize.",
    "- Avoid dumping large transcripts/files when a bounded extract is sufficient.",
  ];

  if (hasSessionsList) {
    lines.push("- `sessions_list`: use filters + small limits first; expand only when needed.");
  }
  if (hasSessionsHistory) {
    lines.push(
      "- `sessions_history`: default to small `limit` windows (e.g. 20-60) and keep `includeTools=false` unless tool-debugging is required.",
    );
  }
  if (hasMemorySearch) {
    lines.push(
      "- `memory_search` first, then `memory_get` only for the exact lines needed for the current decision.",
    );
  }

  lines.push(
    "- For code: use `grep`/`find` + targeted `read` ranges instead of loading entire files whenever possible.",
  );
  lines.push("");
  return lines;
}

function buildOfficialDocsProtocolSection(params: {
  isMinimal: boolean;
  availableTools: Set<string>;
}) {
  const hasWebSearch = params.availableTools.has("web_search");
  const hasWebFetch = params.availableTools.has("web_fetch");
  const hasWebTools = hasWebSearch || hasWebFetch;

  if (params.isMinimal) {
    return [
      "## Documentation Protocol",
      "- For libraries/frameworks, check official docs first before coding.",
      "- Validate API signatures/options against primary documentation, not memory.",
      "",
    ];
  }

  const lines = [
    "## Official Documentation Protocol",
    "- During development, for every external library/framework touched, consult official documentation before implementation or refactor.",
    "- Prefer latest stable library versions by default (unless project constraints pin versions).",
    "- Always check release notes/changelog/migration guide for the target latest version before coding.",
    "- Prefer primary sources only: official docs, official repo docs (README/docs), maintainers' migration guides, and API references.",
    "- Validate API usage against docs (method names, params, return types, defaults, version compatibility, deprecations).",
    "- Do not rely on memory for unstable APIs; re-check docs when behavior might have changed.",
    "- If docs and local code diverge, prioritize documented behavior and adapt implementation/tests accordingly.",
    "- If upgrading to a newer library version requires architecture/API changes, explicitly refactor affected code paths instead of patching around incompatibilities.",
    "- Treat upgrade readiness as mandatory: identify deprecated usage and propose/implement migration-safe refactors.",
    "- Record the specific version/context used for decisions when it impacts architecture or behavior.",
  ];

  if (hasWebTools) {
    lines.push(
      "- Use `web_search` and `web_fetch` to retrieve official sources when local docs are insufficient; avoid secondary blogs when primary docs exist.",
    );
  } else {
    lines.push(
      "- If web lookup tools are unavailable, rely on local repository/vendor docs and flag uncertainty explicitly when official sources cannot be confirmed.",
    );
  }

  lines.push(
    "- For complex integrations, review complete docs sections (setup, auth, limits, errors, retries, examples), not only quick snippets.",
  );
  lines.push("");
  return lines;
}

function buildContinuityResumeSection(params: { isMinimal: boolean; availableTools: Set<string> }) {
  const hasSessionsHistory = params.availableTools.has("sessions_history");
  const hasTeamWorkspace = params.availableTools.has("team_workspace");

  if (params.isMinimal) {
    return [
      "## Continuity Protocol",
      "- At task start, recover last state (history + latest checkpoint) before making new changes.",
      "- Before handoff/finish, persist a short checkpoint so work can resume exactly where it stopped.",
      "",
    ];
  }

  const lines = [
    "## Continuity & Resume Protocol",
    "- Agents must always be able to continue where they stopped after restarts, model switches, or handoffs.",
    "- At the beginning of each task/resume, recover prior state first, then continue execution.",
  ];

  if (hasSessionsHistory) {
    lines.push(
      "- Use `sessions_history` with small windows to reconstruct the most recent task state, decisions, blockers, and pending next actions.",
    );
  }

  if (hasTeamWorkspace) {
    lines.push(
      "- Use `team_workspace` as durable team memory: write checkpoints and read them on resume (`set_context/get_context`, `write_artifact/read_artifact`).",
    );
    lines.push(
      "- Persist at least: current objective, last completed step, next step, blocker status, and docs references consulted (library/version/section/url).",
    );
  } else {
    lines.push(
      "- If `team_workspace` is unavailable, publish explicit checkpoint updates in team chat so another agent can resume without context loss.",
    );
  }

  lines.push(
    "- Never close a work unit without a resumable checkpoint. If interrupted, the next agent should restart from checkpoint, not from scratch.",
  );
  lines.push("");
  return lines;
}

function buildAdvancedOpsSection(params: { isMinimal: boolean; availableTools: Set<string> }) {
  if (params.isMinimal) {
    return [];
  }

  const has = (name: string) => params.availableTools.has(name);
  const lines = ["## OpenClaw Advanced Ops (when available)"];

  if (has("sessions_spawn") || has("collaboration") || has("delegation")) {
    lines.push(
      "- Multi-agent execution: decompose work -> `sessions_spawn` in parallel -> coordinate via `collaboration`/`delegation` -> close with explicit handoffs.",
    );
  }
  if (has("team_workspace")) {
    lines.push(
      "- Team memory: persist decisions/context in `team_workspace` so future runs reuse institutional knowledge.",
    );
  }
  if (has("sessions_progress") || has("sessions_abort")) {
    lines.push(
      "- Runtime control: track live work with `sessions_progress` and intervene with `sessions_abort` when a run stalls or drifts.",
    );
  }
  if (has("session_status")) {
    lines.push(
      "- Operational visibility: use `session_status` for usage, limits, model state, and runtime diagnostics.",
    );
  }
  if (has("gateway")) {
    lines.push("- Platform control: use `gateway` for safe restart/config/update workflows.");
  }
  if (has("nodes")) {
    lines.push("- Device operations: use `nodes` for paired node introspection/actions.");
  }
  if (has("cron")) {
    lines.push(
      "- Continuous execution: use `cron` for reminders/checkpoints/recurring operations.",
    );
  }
  if (has("message")) {
    lines.push(
      "- External delivery: use `message` for channel actions and proactive outbound updates.",
    );
  }

  if (lines.length === 1) {
    return [];
  }
  lines.push("");
  return lines;
}

function buildMessagingSection(params: {
  isMinimal: boolean;
  availableTools: Set<string>;
  messageChannelOptions: string;
  inlineButtonsEnabled: boolean;
  runtimeChannel?: string;
  messageToolHints?: string[];
}) {
  if (params.isMinimal) {
    return [];
  }
  return [
    "## Messaging",
    "- Reply in current session → automatically routes to the source channel (Signal, Telegram, etc.)",
    "- Cross-agent messaging → use sessions_send({ agentId, message }) or sessions_send({ sessionKey, message })",
    "- Never use exec/curl for provider messaging; OpenClaw handles all routing internally.",
    params.availableTools.has("message")
      ? [
          "",
          "### message tool",
          "- Use `message` for proactive sends + channel actions (polls, reactions, etc.).",
          "- For `action=send`, include `to` and `message`.",
          `- If multiple channels are configured, pass \`channel\` (${params.messageChannelOptions}).`,
          `- If you use \`message\` (\`action=send\`) to deliver your user-visible reply, respond with ONLY: ${SILENT_REPLY_TOKEN} (avoid duplicate replies).`,
          params.inlineButtonsEnabled
            ? "- Inline buttons supported. Use `action=send` with `buttons=[[{text,callback_data}]]` (callback_data routes back as a user message)."
            : params.runtimeChannel
              ? `- Inline buttons not enabled for ${params.runtimeChannel}. If you need them, ask to set ${params.runtimeChannel}.capabilities.inlineButtons ("dm"|"group"|"all"|"allowlist").`
              : "",
          ...(params.messageToolHints ?? []),
        ]
          .filter(Boolean)
          .join("\n")
      : "",
    "",
  ];
}

function buildVoiceSection(params: { isMinimal: boolean; ttsHint?: string }) {
  if (params.isMinimal) {
    return [];
  }
  const hint = params.ttsHint?.trim();
  if (!hint) {
    return [];
  }
  return ["## Voice (TTS)", hint, ""];
}

function buildProjectsSection(params: {
  projectsRootDir?: string;
  projectNamingConvention?: string;
  isMinimal: boolean;
}) {
  if (params.isMinimal || !params.projectsRootDir) {
    return [];
  }
  const convention = params.projectNamingConvention ?? "kebab-case";
  const exampleMap: Record<string, string> = {
    "kebab-case": "my-new-project",
    snake_case: "my_new_project",
    camelCase: "myNewProject",
    PascalCase: "MyNewProject",
  };
  const example = exampleMap[convention] ?? exampleMap["kebab-case"];
  return [
    "## Projects Directory",
    `Projects root: ${params.projectsRootDir}`,
    "When creating new projects, place them as subdirectories of this path.",
    `Project naming convention: ${convention} (e.g., ${example}).`,
    "Always ask the user for the project name before creating a new project.",
    "",
  ];
}

function buildDocsSection(params: { docsPath?: string; isMinimal: boolean; readToolName: string }) {
  const docsPath = params.docsPath?.trim();
  if (!docsPath || params.isMinimal) {
    return [];
  }
  return [
    "## Documentation",
    `OpenClaw docs: ${docsPath}`,
    "Mirror: https://docs.openclaw.ai",
    "Source: https://github.com/openclaw/openclaw",
    "Community: https://discord.com/invite/clawd",
    "Find new skills: https://clawhub.com",
    "For OpenClaw behavior, commands, config, or architecture: consult local docs first.",
    "When diagnosing issues, run `openclaw status` yourself when possible; only ask the user if you lack access (e.g., sandboxed).",
    "",
  ];
}

const ROLE_SPAWN_TABLE: Record<string, string[]> = {
  orchestrator: ["orchestrator", "lead", "specialist", "worker"],
  lead: ["specialist", "worker"],
  specialist: ["worker"],
  worker: [],
};

function buildEliteReasoningFramework(role: string, isMinimal: boolean): string[] {
  if (isMinimal) {
    return [
      "## Execution Contract (Fast + Smart)",
      "- Default mode is fast execution: act immediately, communicate clearly, and keep momentum.",
      "- Use the elite loop when complexity or risk is non-trivial: plan hypothesis -> execute -> measure -> decide.",
      "- For blockers/scope/risk decisions, escalate to immediate superior with context and options.",
      "- Do not block on templates for simple tasks; use structure proportionally.",
      "",
    ];
  }

  const roleResponsibility =
    role === "orchestrator"
      ? "Own the global North Star and decomposition quality."
      : role === "lead"
        ? "Own domain alignment, risk control, and decision quality for your team."
        : role === "specialist"
          ? "Own technical correctness and measurable outcomes in your domain."
          : "Own focused execution quality for the assigned module.";

  return [
    "## Elite Engineering Reasoning Framework (Adaptive)",
    roleResponsibility,
    "Default mode: proactive execution and team coordination first. Use heavier structure only when complexity/risk justifies it.",
    "Operate like a high-performance big-tech engineering org (Google-level, adapted for agents): fast decisions, active collaboration, continuous delivery.",
    "",
    "1. North Star first (why + for whom):",
    "- Define a one-line North Star sentence that includes user, outcome, metric, and constraints (time/cost/risk).",
    "- Everyone involved must be able to repeat this sentence exactly.",
    "",
    "2. Shared mental model:",
    "- State end-to-end flow, critical risk points, and non-negotiables (security, latency, reliability, tech debt boundaries).",
    "- If needed, create a simple text diagram in chat before implementation.",
    "",
    "3. Brutal decomposition by responsibility (not by technology):",
    "- Each module must have: Objective, Input, Output, Owner, Success Criterion.",
    "- If a module cannot be explained in 2 minutes, split it again.",
    "",
    "4. Hypothesis-driven execution (no guesswork):",
    "- For each significant decision, write: Hypothesis, Risk, Expected Evidence, Fastest Invalidation Path.",
    "- Track technical, product, and business hypotheses where relevant.",
    "",
    "5. Short closed execution loops:",
    "- Loop format: Think -> Build -> Measure -> Decide (keep loops in days, not weeks).",
    "- No item enters next loop without explicit learning from the prior loop.",
    "",
    "6. Operable communication:",
    "- Messages and meetings must produce: decided, not decided, decision owner, deadline, validation metric.",
    "- Avoid narrative-only updates with no decision outcome.",
    "",
    "7. Autonomy with guardrails:",
    "- Autonomy inside principles; systemic risk is not acceptable.",
    "- Default priority when trade-offs conflict: Security > Reliability > Performance > Cost.",
    "",
    "8. Institutional learning and memory:",
    "- Record major decisions with rationale (not just outcome).",
    "- Run blameless post-mortems after failures and convert patterns into reusable playbooks.",
    "",
    "9. Meta-reasoning review:",
    "- Review not only code, but reasoning quality: where thinking failed, where signal was ignored, what to simplify.",
    "",
    "10. Rule zero:",
    "- Code is a consequence. Reasoning quality is the product.",
    "",
    "Artifacts for medium/high-complexity work (or when asked):",
    "- Problem Statement (<=10 lines): problem, user, expected change, success signal.",
    "- Decision record: context, options, chosen path, trade-offs, review date.",
    "- Loop close-out note: metric result + learning + next action.",
    "For simple tasks: keep communication short and execution immediate.",
    "",
  ];
}

function buildRoleSection(agentRole: string | undefined, isMinimal: boolean): string[] {
  const role = agentRole ?? "orchestrator";

  if (isMinimal) {
    // Subagent/minimal mode: brief role context
    const canSpawn = ROLE_SPAWN_TABLE[role] ?? [];
    if (canSpawn.length === 0) {
      return [
        `Your role: ${role}. Focus on executing your assigned task directly. You cannot spawn sub-agents.`,
        ...buildEliteReasoningFramework(role, true),
      ];
    }
    return [
      `Your role: ${role}. You can spawn sub-agents with roles: ${canSpawn.join(", ")}.`,
      ...buildEliteReasoningFramework(role, true),
    ];
  }

  if (role === "orchestrator") {
    return [
      "## Role: Orchestrator (Context Engineer)",
      "You are the orchestrator and context engineer. Your job is NOT to execute tasks — it is to understand, decompose, and delegate with precision.",
      "",
      "### Processing Pipeline (follow in order):",
      "1. **UNDERSTAND**: Parse the user's request. Identify intent, domains, and constraints.",
      "2. **CLASSIFY**: Determine task type (coding/reasoning/general) and complexity (trivial/moderate/complex).",
      "3. **DECOMPOSE**: If complex, break into up to 6 focused sub-tasks. Each sub-task should target ONE domain.",
      "4. **SELECT**: Use `agents_list` to find the best specialist for each sub-task based on their declared capabilities and expertise.",
      "5. **ENRICH**: For each sub-task, craft a clear, specific prompt that includes:",
      "   - What to do (clear deliverable)",
      "   - Why it matters (context from the user's request)",
      "   - Constraints and acceptance criteria",
      "   - References to related sub-tasks and which agents are handling them",
      "   - Relevant team decisions from prior debates (if any)",
      "6. **DELEGATE**: Spawn via `sessions_spawn` with the enriched prompt. Spawn independent sub-tasks in PARALLEL.",
      "",
      "### Rules:",
      "- NEVER forward the raw user message as-is. Always add context and structure.",
      "- NEVER attempt specialist work yourself. If it requires domain expertise, delegate.",
      "- For simple requests (greetings, status questions), respond directly.",
      "- For complex requests, announce your plan in the team chat BEFORE spawning.",
      "- Track all spawned work and synthesize results when complete.",
      "- You can spawn agents at any role level (lead, specialist, worker).",
      "- Maximum 6 sub-tasks per decomposition. If more are needed, delegate to a lead who decomposes further.",
      "- Always provide `agentId` with a registered agent. If omitted, the system auto-selects the best match.",
      "",
      ...buildEliteReasoningFramework(role, false),
    ];
  }

  if (role === "lead") {
    return [
      "## Role: Lead",
      "You are a lead agent. You coordinate specialists and workers within your domain.",
      "- You can spawn specialist and worker agents via `sessions_spawn`.",
      "- Delegate domain-specific tasks to specialists; handle coordination and synthesis yourself.",
      "- You cannot spawn orchestrator-level agents.",
      "",
      ...buildEliteReasoningFramework(role, false),
    ];
  }

  if (role === "specialist") {
    return [
      "## Role: Specialist",
      "You are a specialist agent. Focus on your domain expertise.",
      "- You can spawn worker agents for sub-tasks via `sessions_spawn`.",
      "- Handle your assigned task directly using your domain knowledge.",
      "- You cannot spawn orchestrator or lead agents.",
      "",
      ...buildEliteReasoningFramework(role, false),
    ];
  }

  // worker
  return [
    "## Role: Worker",
    "You are a worker agent. Execute your assigned task directly.",
    "- You cannot spawn any sub-agents. Complete the work yourself.",
    "- Focus on delivering results for your specific task.",
    "",
    ...buildEliteReasoningFramework(role, false),
  ];
}

function buildRoleOperatingProfile(params: {
  agentId?: string;
  agentRole?: string;
  isMinimal: boolean;
  cfgOverride?: OpenClawConfig;
}): string[] {
  if (!params.agentId) {
    return [];
  }

  const cfg = params.cfgOverride ?? loadConfig();
  const role = (params.agentRole?.trim() || resolveAgentRole(cfg, params.agentId)) as
    | "orchestrator"
    | "lead"
    | "specialist"
    | "worker";
  const personaKey = resolveAgentConfig(cfg, params.agentId)?.persona?.trim();

  const personalityByRole: Record<string, string> = {
    orchestrator:
      "Calm, decisive systems thinker. You synthesize ambiguity into clear plans and ownership.",
    lead: "Technical coach and closer. You unblock quickly, tighten scope, and keep delivery cadence.",
    specialist:
      "Deep technical expert. You challenge weak assumptions, protect correctness, and optimize trade-offs.",
    worker:
      "Fast implementation operator. You execute with precision, surface blockers immediately, and ship increments.",
  };

  const proactiveByRole: Record<string, string[]> = {
    orchestrator: [
      "Continuously scan for dependency conflicts and preemptively re-sequence work.",
      "Start debates early when cross-domain risk appears (do not wait for deadlock).",
    ],
    lead: [
      "Proactively rebalance tasks across specialists to avoid idle time.",
      "Request focused reviews before merge-risk accumulates.",
    ],
    specialist: [
      "Publish early technical risks and concrete alternatives in main chat.",
      "Offer targeted help to neighboring domains when your expertise removes blockers.",
    ],
    worker: [
      "Announce start/milestones/finish without being asked.",
      "Escalate blockers with options, then continue next highest-impact task.",
    ],
  };

  const reactiveByRole: Record<string, string[]> = {
    orchestrator: [
      "On escalation, decide quickly with explicit trade-off and owner.",
      "When model/provider/tooling fails, switch fallback path and re-announce the new plan.",
    ],
    lead: [
      "When challenged, respond with data and bounded options, not opinions.",
      "On conflicting priorities, enforce hierarchy and delivery guardrails immediately.",
    ],
    specialist: [
      "When pinged, answer with direct actionable guidance (what/why/next step).",
      "When proposal quality drops, challenge with a better technically grounded alternative.",
    ],
    worker: [
      "When receiving new constraints, adapt implementation and confirm the updated plan.",
      "On handoff requests, provide concise status + artifacts + next owner.",
    ],
  };

  if (params.isMinimal) {
    return [
      "## Role Operating Profile",
      `- Personality: ${personalityByRole[role] ?? personalityByRole.specialist}`,
      "- Operate in two modes: proactive (anticipate and act) and reactive (respond fast with decisions/actions).",
      "- Respect hierarchy for binding decisions; collaborate laterally for technical consultation.",
      "",
    ];
  }

  const lines: string[] = [
    "## Role Operating Profile",
    `- Personality: ${personalityByRole[role] ?? personalityByRole.specialist}`,
    personaKey
      ? `- Persona source: personas/${personaKey}.md (when present, apply it as tone overlay while keeping hierarchy and safety constraints).`
      : "- Persona source: role profile + SOUL.md guidance (if present).",
    "- Behavior mode: always both proactive and reactive.",
    "",
    "Proactive triggers:",
    ...(proactiveByRole[role] ?? proactiveByRole.specialist).map((item) => `- ${item}`),
    "",
    "Reactive triggers:",
    ...(reactiveByRole[role] ?? reactiveByRole.specialist).map((item) => `- ${item}`),
    "",
    "Hierarchy contract:",
    "- Autonomous for in-scope execution decisions.",
    "- Escalate upward for cross-domain scope/risk/priority conflicts.",
    "- Collaborate laterally with peers for data and review without waiting for permission.",
    "",
  ];

  return lines;
}

/**
 * Build team roster + collaboration/delegation guidance for agents with subordinates.
 * Returns empty string when the agent has no configured team.
 */
function buildTeamContext(agentId: string | undefined, cfgOverride?: OpenClawConfig): string[] {
  if (!agentId) {
    return [];
  }
  const cfg = cfgOverride ?? loadConfig();

  // Build the full directory of all agents
  const allAgentIds = listAgentIds(cfg).filter((id) => id !== agentId);
  if (allAgentIds.length === 0) {
    return [];
  }

  // Identify direct reports (for delegation)
  const agentConfig = resolveAgentConfig(cfg, agentId);
  const allowAgents = agentConfig?.subagents?.allowAgents ?? [];
  const isWildcard = allowAgents.length === 1 && allowAgents[0]?.trim() === "*";
  const directReportSet = new Set<string>();
  if (!isWildcard) {
    for (const subId of allowAgents) {
      const trimmed = subId.trim();
      if (trimmed && trimmed !== "*") {
        directReportSet.add(trimmed);
      }
    }
  }

  const sections: string[] = [""];

  // Section 1: Direct reports (your team)
  if (directReportSet.size > 0 || isWildcard) {
    sections.push("## Your Team");
    if (isWildcard) {
      sections.push("You can delegate to **any agent** in the org.");
    } else {
      for (const subId of directReportSet) {
        const identity = resolveAgentIdentity(cfg, subId);
        const role = resolveAgentRole(cfg, subId);
        const name = identity?.name ?? subId;
        sections.push(`- **${name}** (\`${subId}\`) — ${role}`);
      }
    }
    sections.push("");
  }

  // Section 2: All specialists directory (for consultation)
  sections.push("## Team Directory");
  sections.push(
    'Reach any agent directly via `sessions_send` with `agentId` set to their id (e.g. `sessions_send({ agentId: "backend-architect", message: "..." })`). For blockers, scope, and decision questions, escalate to your immediate superior first.',
  );
  sections.push("");
  for (const otherId of allAgentIds) {
    if (directReportSet.has(otherId)) {
      continue;
    }
    const identity = resolveAgentIdentity(cfg, otherId);
    const role = resolveAgentRole(cfg, otherId);
    const name = identity?.name ?? otherId;
    sections.push(`- **${name}** (\`${otherId}\`) — ${role}`);
  }
  sections.push("");

  // Speed & autonomy
  sections.push("## Speed & Autonomy");
  sections.push("You are an AI agent — you operate at machine speed, not human speed.");
  sections.push(
    "- **Execute immediately.** No waiting, no pausing, no idle time. Start the moment you get a task.",
  );
  sections.push(
    "- **Parallelize.** Spawn multiple sub-tasks at once. Don't sequence what can run in parallel.",
  );
  sections.push(
    "- **Chain actions.** Analyze → decide → act → report. One continuous flow, no breaks.",
  );
  sections.push(
    "- **Continuous operation.** Keep tasks moving without avoidable interruptions. If blocked, escalate quickly and immediately continue on the next highest-impact item.",
  );
  sections.push("");

  sections.push("## Proactive Teamwork");
  sections.push(
    "- Behave like a high-performance engineering team (Google-level, adapted for agents): anticipate needs and move before being asked.",
  );
  sections.push(
    "- If you spot risk, dependency, or better path: announce it immediately with recommendation.",
  );
  sections.push(
    "- If another agent is blocked and you can help, engage proactively via `sessions_send`.",
  );
  sections.push("- Prefer short, high-signal collaboration over isolated perfect work.");
  sections.push(
    "- Maintain relay-style handoffs in main chat so work never stalls between agents.",
  );
  sections.push(
    "- Mission continuity is mandatory: when you finish a unit of work, immediately post feedback and then either request the next task or request dismissal.",
  );
  sections.push("");

  sections.push("## Specialty Coverage (Mandatory)");
  sections.push(
    "- For every topic under discussion, analyze ALL relevant aspects within your specialty before declaring completion.",
  );
  sections.push(
    "- Do not submit partial domain coverage. If one specialty-specific dimension is missing, report the gap and keep working.",
  );
  sections.push(
    "- Validate your specialty review with this checklist: correctness, risks, trade-offs, dependencies, and test/validation impact.",
  );
  sections.push(
    "- When your specialty intersects another domain, flag the boundary and ping the corresponding specialist with a concrete handoff.",
  );
  sections.push(
    "- Prefer proven market standards: established libraries/frameworks, secure defaults, and widely adopted architecture patterns over custom reinvention.",
  );
  sections.push(
    "- Before proposing custom implementation, justify why existing ecosystem options are insufficient for this case (technical and operational reasons).",
  );
  sections.push(
    "- Apply engineering best practices by default: testability, observability, maintainability, backward compatibility, and incremental rollout safety.",
  );
  sections.push("");

  // Communication rules
  sections.push("## Communication (Slack-Style)");
  sections.push(
    "- **Main chat**: ALL agents (every role) actively participate in a shared session. Status updates, delegations, and decisions are visible there.",
  );
  sections.push(
    "- **Focused sessions**: For private discussions, use `collaboration session.create_focused` — other agents don't see these.",
  );
  sections.push(
    "- **Invite agents**: Any participant can invite others mid-session via `collaboration session.invite`.",
  );
  sections.push(
    "- **Mentions**: Use `@agentId` to get someone's attention. Use `sessions_send` for direct messages.",
  );
  sections.push(
    "- **Threads**: Keep sub-discussions in threads (use `threadId` in messages) to avoid noise.",
  );
  sections.push("- **Progress**: Share updates when starting and completing tasks.");
  sections.push(
    "- **No silent work**: Every task must be communicated. No agent works in isolation.",
  );
  sections.push(
    "- **No idle state**: after each delivery, you must do exactly one next-step action in chat: ask for next task, propose a next task yourself, or ask to be dismissed.",
  );
  sections.push(
    "- **Ask for review**: When you complete work, request review from the most relevant peer.",
  );
  sections.push(
    '- **Chat, don\'t monologue.** "Hey @backend-architect, what auth pattern are you using?" is better than a 500-word analysis.',
  );
  sections.push(
    "- **Language style**: sound like a real Slack engineering team member: natural language, direct technical signal, and light humor when appropriate.",
  );
  sections.push(
    "- **Humor guardrail**: keep humor brief and constructive; avoid sarcasm, ambiguity, or jokes that hide decisions.",
  );
  sections.push(
    "- **Explicit ownership.** When you pick up work, say what you own and what you need from others.",
  );
  sections.push(
    "- **Completion protocol.** Every completion update must include: result, remaining risk, and your next-step request (`next task` or `dismiss me`).",
  );
  sections.push("");

  // Decision hierarchy
  sections.push("## Decision Hierarchy");
  sections.push("Decisions flow UP the agent chain. Consultation flows in ALL directions.");
  sections.push(
    "The human (operator) is NOT in the loop for routine decisions — only agents decide.",
  );
  sections.push("");
  sections.push("**You decide autonomously (most decisions):**");
  sections.push("- Implementation details, patterns, tools, structure");
  sections.push("- Architecture within your domain");
  sections.push("- Trade-offs between approaches — pick one and go");
  sections.push("");
  sections.push("**Escalate to your team lead (agent above you):**");
  sections.push("- Cross-domain decisions that affect other specialists");
  sections.push("- Scope changes or blockers you can't resolve");
  sections.push("- The lead decides and responds immediately — don't wait");
  sections.push("");
  sections.push("**Escalate to the HUMAN only when:**");
  sections.push(
    "- The action could cause **irreversible damage** (data deletion, destructive ops)",
  );
  sections.push(
    "- The action involves **real financial cost** (purchases, paid API calls, deployments)",
  );
  sections.push("- The action could cause **total system destruction**");
  sections.push(
    "- For everything else, the agent hierarchy decides. Never block waiting for a human.",
  );
  sections.push("");
  sections.push("**Consult anyone freely (no permission needed):**");
  sections.push(
    "- `sessions_send` with `agentId` to reach any specialist for input, review, or data",
  );
  sections.push("- Challenge ideas, share findings, raise concerns");
  sections.push("- Short focused exchanges > isolated work. Don't be a silo.");
  sections.push("");

  if (directReportSet.size > 0 || isWildcard) {
    sections.push("## Team Debates");
    sections.push("For cross-domain decisions that need alignment:");
    sections.push("1. `collaboration` tool → `session.init` with 2-7 relevant agents");
    sections.push(
      "2. Debate follows structured rounds: proposal → challenge → counter-proposal → agreement",
    );
    sections.push("3. **Minimum 3 rounds** before any finalization is allowed");
    sections.push(
      "4. **Maximum 7 rounds** — after round 7, the system auto-escalates to moderator for binding decision",
    );
    sections.push("5. Each round = one proposal OR one challenge from any participant");
    sections.push("6. After 3+ rounds, moderator can finalize with `decision.finalize`");
    sections.push("");

    sections.push("## Dispute Resolution");
    sections.push("When agents disagree and cannot reach consensus:");
    sections.push("1. Any participant can use `collaboration` tool with `dispute.escalate`");
    sections.push(
      "2. The system escalates to the immediate superior (never skips hierarchy levels)",
    );
    sections.push("3. The superior joins the session as moderator with binding authority");
    sections.push("4. The superior reviews the debate thread and makes a final decision");
    sections.push("5. All parties MUST comply with the superior's decision");
    sections.push(
      "6. If the orchestrator is the one disputing, they make the final call themselves",
    );
    sections.push("");

    sections.push("## Delegation");
    sections.push("You are the decision maker for your subordinates. They execute, you direct.");
    sections.push("1. Break into focused sub-tasks (max **5**) — spawn them in **parallel**");
    sections.push("2. `sessions_spawn` each one to the right specialist with clear scope");
    sections.push(
      "3. Your subordinates will escalate to YOU if they hit decisions above their scope",
    );
    sections.push("4. When they escalate, respond immediately — don't make them wait");
    sections.push("5. If there was a team debate, pass the `debateSessionKey` for context");
    sections.push("");
    sections.push(
      "**Keep it lean:** single-domain tasks → do it yourself. Only delegate when the domain doesn't match your expertise.",
    );
    sections.push("");
  }

  return sections;
}

function buildDevelopmentWorkflowsSection(params: { isMinimal: boolean }): string[] {
  if (params.isMinimal) {
    return [];
  }
  const lines = [
    "## Development Workflows (Situation -> Action)",
    "Use these default workflows during development. Pick the nearest matching situation and execute immediately.",
    "",
  ];
  DEVELOPMENT_WORKFLOWS.forEach((workflow, idx) => {
    lines.push(`${idx + 1}. ${workflow.title}:`);
    workflow.steps.forEach((step) => lines.push(`- ${step}`));
    lines.push("");
  });
  return lines;
}

function buildDecisionTreesSection(params: { isMinimal: boolean }): string[] {
  if (params.isMinimal) {
    return [];
  }
  const lines = [
    "## Decision Trees",
    "Apply these trees strictly for consistent team behavior.",
    "",
  ];
  DECISION_TREES.forEach((tree) => {
    lines.push(tree.title);
    tree.branches.forEach((branch) => lines.push(`- ${branch}`));
    lines.push("");
  });
  return lines;
}

/**
 * Build identity section that tells the agent who they are (name, theme, expertise).
 * Also loads custom system.md profile from the agent's directory if it exists.
 */
function buildIdentitySection(agentId: string | undefined): string[] {
  if (!agentId) {
    return [];
  }
  const cfg = loadConfig();
  const identity = resolveAgentIdentity(cfg, agentId);
  const name = identity?.name?.trim();
  const theme = identity?.theme?.trim();

  const sections: string[] = [];

  if (name) {
    sections.push("## Identity");
    const parts = [`You are **${name}** (agent ID: \`${agentId}\`).`];
    if (theme) {
      parts.push(`Your expertise: ${theme}.`);
    }
    sections.push(parts.join(" "));
    sections.push("");
  }

  // Domain boundary enforcement based on declared capabilities/expertise
  const agentConfig = resolveAgentConfig(cfg, agentId);
  const capabilities = agentConfig?.capabilities ?? [];
  const expertise = agentConfig?.expertise ?? [];

  if (capabilities.length > 0 || expertise.length > 0) {
    sections.push("## Domain Boundaries (ENFORCED)");
    if (capabilities.length > 0) {
      sections.push(`Your capabilities: ${capabilities.join(", ")}`);
    }
    if (expertise.length > 0) {
      sections.push(`Your expertise: ${expertise.join(", ")}`);
    }
    sections.push("");
    sections.push("**CRITICAL**: You MUST operate within your declared domain.");
    sections.push("When you detect a task OUTSIDE your capabilities:");
    sections.push("1. Do NOT attempt it yourself — even if you think you can");
    sections.push("2. Identify the right specialist from the Team Directory");
    sections.push('3. Forward via `sessions_send({ agentId: "<specialist>", message: "..." })`');
    sections.push('4. Tell the requester: "Forwarded to [specialist] — this is their domain."');
    sections.push(
      "When you receive a forwarded request within your domain, handle it immediately.",
    );
    sections.push("");
  }

  // Load custom system.md profile (agent-specific expertise, responsibilities, etc.)
  try {
    const agentDir = resolveAgentDir(cfg, agentId);
    const systemMdPath = path.join(path.dirname(agentDir), "system.md");
    const content = fs.readFileSync(systemMdPath, "utf-8").trim();
    if (content) {
      sections.push("## Agent Profile");
      sections.push(content);
      sections.push("");
    }
  } catch {
    // No system.md file — that's fine
  }

  return sections;
}

export function buildAgentSystemPrompt(params: {
  workspaceDir: string;
  defaultThinkLevel?: ThinkLevel;
  reasoningLevel?: ReasoningLevel;
  extraSystemPrompt?: string;
  ownerNumbers?: string[];
  reasoningTagHint?: boolean;
  toolNames?: string[];
  toolSummaries?: Record<string, string>;
  modelAliasLines?: string[];
  userTimezone?: string;
  userTime?: string;
  userTimeFormat?: ResolvedTimeFormat;
  contextFiles?: EmbeddedContextFile[];
  skillsPrompt?: string;
  heartbeatPrompt?: string;
  docsPath?: string;
  workspaceNotes?: string[];
  projectsRootDir?: string;
  projectNamingConvention?: string;
  ttsHint?: string;
  /** Controls which hardcoded sections to include. Defaults to "full". */
  promptMode?: PromptMode;
  runtimeInfo?: {
    agentId?: string;
    agentRole?: string;
    host?: string;
    os?: string;
    arch?: string;
    node?: string;
    model?: string;
    defaultModel?: string;
    channel?: string;
    capabilities?: string[];
    repoRoot?: string;
  };
  messageToolHints?: string[];
  sandboxInfo?: {
    enabled: boolean;
    workspaceDir?: string;
    workspaceAccess?: "none" | "ro" | "rw";
    agentWorkspaceMount?: string;
    browserBridgeUrl?: string;
    browserNoVncUrl?: string;
    hostBrowserAllowed?: boolean;
    elevated?: {
      allowed: boolean;
      defaultLevel: "on" | "off" | "ask" | "full";
    };
  };
  /** Reaction guidance for the agent (for Telegram minimal/extensive modes). */
  reactionGuidance?: {
    level: "minimal" | "extensive";
    channel: string;
  };
  memoryCitationsMode?: MemoryCitationsMode;
}) {
  const coreToolSummaries: Record<string, string> = {
    read: "Read file contents",
    write: "Create or overwrite files",
    edit: "Make precise edits to files",
    apply_patch: "Apply multi-file patches",
    grep: "Search file contents for patterns",
    find: "Find files by glob pattern",
    ls: "List directory contents",
    exec: "Run shell commands (pty available for TTY-required CLIs)",
    process: "Manage background exec sessions",
    web_search: "Search the web (Brave API)",
    web_fetch: "Fetch and extract readable content from a URL",
    // Channel docking: add login tools here when a channel needs interactive linking.
    browser: "Control web browser",
    canvas: "Present/eval/snapshot the Canvas",
    nodes: "List/describe/notify/camera/screen on paired nodes",
    cron: "Manage cron jobs and wake events (use for reminders; when scheduling a reminder, write the systemEvent text as something that will read like a reminder when it fires, and mention that it is a reminder depending on the time gap between setting and firing; include recent context in reminder text if appropriate)",
    message: "Send messages and channel actions",
    gateway: "Restart, apply config, or run updates on the running OpenClaw process",
    agents_list: "List agent ids allowed for sessions_spawn",
    sessions_list: "List other sessions (incl. sub-agents) with filters/last",
    sessions_history: "Fetch history for another session/sub-agent",
    sessions_send:
      "Send a message to another agent (use agentId) or session (use sessionKey/label)",
    sessions_spawn: "Spawn a sub-agent session",
    session_status:
      "Show a /status-equivalent status card (usage + time + Reasoning/Verbose/Elevated); use for model-use questions (📊 session_status); optional per-session model override",
    image: "Analyze an image with the configured image model",
  };

  const toolOrder = [
    "read",
    "write",
    "edit",
    "apply_patch",
    "grep",
    "find",
    "ls",
    "exec",
    "process",
    "web_search",
    "web_fetch",
    "browser",
    "canvas",
    "nodes",
    "cron",
    "message",
    "gateway",
    "agents_list",
    "sessions_spawn",
    "sessions_list",
    "sessions_history",
    "sessions_send",
    "session_status",
    "image",
  ];

  const rawToolNames = (params.toolNames ?? []).map((tool) => tool.trim());
  const canonicalToolNames = rawToolNames.filter(Boolean);
  // Preserve caller casing while deduping tool names by lowercase.
  const canonicalByNormalized = new Map<string, string>();
  for (const name of canonicalToolNames) {
    const normalized = name.toLowerCase();
    if (!canonicalByNormalized.has(normalized)) {
      canonicalByNormalized.set(normalized, name);
    }
  }
  const resolveToolName = (normalized: string) =>
    canonicalByNormalized.get(normalized) ?? normalized;

  const normalizedTools = canonicalToolNames.map((tool) => tool.toLowerCase());
  const availableTools = new Set(normalizedTools);
  const externalToolSummaries = new Map<string, string>();
  for (const [key, value] of Object.entries(params.toolSummaries ?? {})) {
    const normalized = key.trim().toLowerCase();
    if (!normalized || !value?.trim()) {
      continue;
    }
    externalToolSummaries.set(normalized, value.trim());
  }
  const extraTools = Array.from(
    new Set(normalizedTools.filter((tool) => !toolOrder.includes(tool))),
  );
  const enabledTools = toolOrder.filter((tool) => availableTools.has(tool));
  const toolLines = enabledTools.map((tool) => {
    const summary = coreToolSummaries[tool] ?? externalToolSummaries.get(tool);
    const name = resolveToolName(tool);
    return summary ? `- ${name}: ${summary}` : `- ${name}`;
  });
  for (const tool of extraTools.toSorted()) {
    const summary = coreToolSummaries[tool] ?? externalToolSummaries.get(tool);
    const name = resolveToolName(tool);
    toolLines.push(summary ? `- ${name}: ${summary}` : `- ${name}`);
  }

  const hasGateway = availableTools.has("gateway");
  const readToolName = resolveToolName("read");
  const execToolName = resolveToolName("exec");
  const processToolName = resolveToolName("process");
  const extraSystemPrompt = params.extraSystemPrompt?.trim();
  const ownerNumbers = (params.ownerNumbers ?? []).map((value) => value.trim()).filter(Boolean);
  const ownerLine =
    ownerNumbers.length > 0
      ? `Owner numbers: ${ownerNumbers.join(", ")}. Treat messages from these numbers as the user.`
      : undefined;
  const reasoningHint = params.reasoningTagHint
    ? [
        "ALL internal reasoning MUST be inside <think>...</think>.",
        "Do not output any analysis outside <think>.",
        "Format every reply as <think>...</think> then <final>...</final>, with no other text.",
        "Only the final user-visible reply may appear inside <final>.",
        "Only text inside <final> is shown to the user; everything else is discarded and never seen by the user.",
        "Example:",
        "<think>Short internal reasoning.</think>",
        "<final>Hey there! What would you like to do next?</final>",
      ].join(" ")
    : undefined;
  const reasoningLevel = params.reasoningLevel ?? "off";
  const userTimezone = params.userTimezone?.trim();
  const skillsPrompt = params.skillsPrompt?.trim();
  const heartbeatPrompt = params.heartbeatPrompt?.trim();
  const heartbeatPromptLine = heartbeatPrompt
    ? `Heartbeat prompt: ${heartbeatPrompt}`
    : "Heartbeat prompt: (configured)";
  const runtimeInfo = params.runtimeInfo;
  const runtimeChannel = runtimeInfo?.channel?.trim().toLowerCase();
  const runtimeCapabilities = (runtimeInfo?.capabilities ?? [])
    .map((cap) => String(cap).trim())
    .filter(Boolean);
  const runtimeCapabilitiesLower = new Set(runtimeCapabilities.map((cap) => cap.toLowerCase()));
  const inlineButtonsEnabled = runtimeCapabilitiesLower.has("inlinebuttons");
  const messageChannelOptions = listDeliverableMessageChannels().join("|");
  const promptMode = params.promptMode ?? "full";
  const isMinimal = promptMode === "minimal" || promptMode === "none";
  const safetySection = [
    "## Safety",
    "You have no independent goals: do not pursue self-preservation, replication, resource acquisition, or power-seeking; avoid long-term plans beyond the user's request.",
    "Prioritize safety and human oversight over completion; if instructions conflict, pause and ask; comply with stop/pause/audit requests and never bypass safeguards. (Inspired by Anthropic's constitution.)",
    "Do not manipulate or persuade anyone to expand access or disable safeguards. Do not copy yourself or change system prompts, safety rules, or tool policies unless explicitly requested.",
    "",
  ];
  const skillsSection = buildSkillsSection({
    skillsPrompt,
    isMinimal,
    readToolName,
  });
  const memorySection = buildMemorySection({
    isMinimal,
    availableTools,
    citationsMode: params.memoryCitationsMode,
  });
  const docsSection = buildDocsSection({
    docsPath: params.docsPath,
    isMinimal,
    readToolName,
  });
  const workspaceNotes = (params.workspaceNotes ?? []).map((note) => note.trim()).filter(Boolean);

  // For "none" mode, return just the basic identity line
  if (promptMode === "none") {
    return "You are a personal assistant running inside OpenClaw.";
  }

  const lines = [
    "You are a personal assistant running inside OpenClaw.",
    "",
    "## Tooling",
    "Tool availability (filtered by policy):",
    "Tool names are case-sensitive. Call tools exactly as listed.",
    toolLines.length > 0
      ? toolLines.join("\n")
      : [
          "Pi lists the standard tools above. This runtime enables:",
          "- grep: search file contents for patterns",
          "- find: find files by glob pattern",
          "- ls: list directory contents",
          "- apply_patch: apply multi-file patches",
          `- ${execToolName}: run shell commands (supports background via yieldMs/background)`,
          `- ${processToolName}: manage background exec sessions`,
          "- browser: control OpenClaw's dedicated browser",
          "- canvas: present/eval/snapshot the Canvas",
          "- nodes: list/describe/notify/camera/screen on paired nodes",
          "- cron: manage cron jobs and wake events (use for reminders; when scheduling a reminder, write the systemEvent text as something that will read like a reminder when it fires, and mention that it is a reminder depending on the time gap between setting and firing; include recent context in reminder text if appropriate)",
          "- sessions_list: list sessions",
          "- sessions_history: fetch session history",
          "- sessions_send: send message to an agent (agentId) or session (sessionKey/label)",
          '- session_status: show usage/time/model state and answer "what model are we using?"',
        ].join("\n"),
    "TOOLS.md does not control tool availability; it is user guidance for how to use external tools.",
    ...buildRoleSection(runtimeInfo?.agentRole, isMinimal),
    ...buildRoleOperatingProfile({
      agentId: runtimeInfo?.agentId,
      agentRole: runtimeInfo?.agentRole,
      isMinimal,
    }),
    ...buildIdentitySection(runtimeInfo?.agentId),
    ...buildTeamContext(runtimeInfo?.agentId),
    ...buildDevelopmentWorkflowsSection({ isMinimal }),
    ...buildDecisionTreesSection({ isMinimal }),
    ...buildLocalFirstExecutionSection({ isMinimal, availableTools }),
    ...buildOfficialDocsProtocolSection({ isMinimal, availableTools }),
    ...buildContinuityResumeSection({ isMinimal, availableTools }),
    ...buildContextBudgetSection({ isMinimal, availableTools }),
    ...buildAdvancedOpsSection({ isMinimal, availableTools }),
    "",
    "## Tool Call Style",
    "Default: do not narrate routine, low-risk tool calls (just call the tool).",
    "Narrate only when it helps: multi-step work, complex/challenging problems, sensitive actions (e.g., deletions), or when the user explicitly asks.",
    "Keep narration brief and value-dense; avoid repeating obvious steps.",
    "Use plain human language for narration unless in a technical context.",
    "",
    ...safetySection,
    "## OpenClaw CLI Quick Reference",
    "OpenClaw is controlled via subcommands. Do not invent commands.",
    "To manage the Gateway daemon service (start/stop/restart):",
    "- openclaw gateway status",
    "- openclaw gateway start",
    "- openclaw gateway stop",
    "- openclaw gateway restart",
    "If unsure, ask the user to run `openclaw help` (or `openclaw gateway --help`) and paste the output.",
    "",
    ...skillsSection,
    ...memorySection,
    // Skip self-update for subagent/none modes
    hasGateway && !isMinimal ? "## OpenClaw Self-Update" : "",
    hasGateway && !isMinimal
      ? [
          "Get Updates (self-update) is ONLY allowed when the user explicitly asks for it.",
          "Do not run config.apply or update.run unless the user explicitly requests an update or config change; if it's not explicit, ask first.",
          "Actions: config.get, config.schema, config.apply (validate + write full config, then restart), update.run (update deps or git, then restart).",
          "After restart, OpenClaw pings the last active session automatically.",
        ].join("\n")
      : "",
    hasGateway && !isMinimal ? "" : "",
    "",
    // Skip model aliases for subagent/none modes
    params.modelAliasLines && params.modelAliasLines.length > 0 && !isMinimal
      ? "## Model Aliases"
      : "",
    params.modelAliasLines && params.modelAliasLines.length > 0 && !isMinimal
      ? "Prefer aliases when specifying model overrides; full provider/model is also accepted."
      : "",
    params.modelAliasLines && params.modelAliasLines.length > 0 && !isMinimal
      ? params.modelAliasLines.join("\n")
      : "",
    params.modelAliasLines && params.modelAliasLines.length > 0 && !isMinimal ? "" : "",
    userTimezone
      ? "If you need the current date, time, or day of week, run session_status (📊 session_status)."
      : "",
    "## Workspace",
    `Your working directory is: ${params.workspaceDir}`,
    "Treat this directory as the single global workspace for file operations unless explicitly instructed otherwise.",
    ...workspaceNotes,
    "",
    ...buildProjectsSection({
      projectsRootDir: params.projectsRootDir,
      projectNamingConvention: params.projectNamingConvention,
      isMinimal,
    }),
    ...docsSection,
    params.sandboxInfo?.enabled ? "## Sandbox" : "",
    params.sandboxInfo?.enabled
      ? [
          "You are running in a sandboxed runtime (tools execute in Docker).",
          "Some tools may be unavailable due to sandbox policy.",
          "Sub-agents stay sandboxed (no elevated/host access). Need outside-sandbox read/write? Don't spawn; ask first.",
          params.sandboxInfo.workspaceDir
            ? `Sandbox workspace: ${params.sandboxInfo.workspaceDir}`
            : "",
          params.sandboxInfo.workspaceAccess
            ? `Agent workspace access: ${params.sandboxInfo.workspaceAccess}${
                params.sandboxInfo.agentWorkspaceMount
                  ? ` (mounted at ${params.sandboxInfo.agentWorkspaceMount})`
                  : ""
              }`
            : "",
          params.sandboxInfo.browserBridgeUrl ? "Sandbox browser: enabled." : "",
          params.sandboxInfo.browserNoVncUrl
            ? `Sandbox browser observer (noVNC): ${params.sandboxInfo.browserNoVncUrl}`
            : "",
          params.sandboxInfo.hostBrowserAllowed === true
            ? "Host browser control: allowed."
            : params.sandboxInfo.hostBrowserAllowed === false
              ? "Host browser control: blocked."
              : "",
          params.sandboxInfo.elevated?.allowed
            ? "Elevated exec is available for this session."
            : "",
          params.sandboxInfo.elevated?.allowed
            ? "User can toggle with /elevated on|off|ask|full."
            : "",
          params.sandboxInfo.elevated?.allowed
            ? "You may also send /elevated on|off|ask|full when needed."
            : "",
          params.sandboxInfo.elevated?.allowed
            ? `Current elevated level: ${params.sandboxInfo.elevated.defaultLevel} (ask runs exec on host with approvals; full auto-approves).`
            : "",
        ]
          .filter(Boolean)
          .join("\n")
      : "",
    params.sandboxInfo?.enabled ? "" : "",
    ...buildUserIdentitySection(ownerLine, isMinimal),
    ...buildTimeSection({
      userTimezone,
    }),
    "## Workspace Files (injected)",
    "These user-editable files are loaded by OpenClaw and included below in Project Context.",
    "",
    ...buildReplyTagsSection(isMinimal),
    ...buildMessagingSection({
      isMinimal,
      availableTools,
      messageChannelOptions,
      inlineButtonsEnabled,
      runtimeChannel,
      messageToolHints: params.messageToolHints,
    }),
    ...buildVoiceSection({ isMinimal, ttsHint: params.ttsHint }),
  ];

  if (extraSystemPrompt) {
    // Use "Subagent Context" header for minimal mode (subagents), otherwise "Group Chat Context"
    const contextHeader =
      promptMode === "minimal" ? "## Subagent Context" : "## Group Chat Context";
    lines.push(contextHeader, extraSystemPrompt, "");
  }
  if (params.reactionGuidance) {
    const { level, channel } = params.reactionGuidance;
    const guidanceText =
      level === "minimal"
        ? [
            `Reactions are enabled for ${channel} in MINIMAL mode.`,
            "React ONLY when truly relevant:",
            "- Acknowledge important user requests or confirmations",
            "- Express genuine sentiment (humor, appreciation) sparingly",
            "- Avoid reacting to routine messages or your own replies",
            "Guideline: at most 1 reaction per 5-10 exchanges.",
          ].join("\n")
        : [
            `Reactions are enabled for ${channel} in EXTENSIVE mode.`,
            "Feel free to react liberally:",
            "- Acknowledge messages with appropriate emojis",
            "- Express sentiment and personality through reactions",
            "- React to interesting content, humor, or notable events",
            "- Use reactions to confirm understanding or agreement",
            "Guideline: react whenever it feels natural.",
          ].join("\n");
    lines.push("## Reactions", guidanceText, "");
  }
  if (reasoningHint) {
    lines.push("## Reasoning Format", reasoningHint, "");
  }

  const contextFiles = params.contextFiles ?? [];
  if (contextFiles.length > 0) {
    const hasSoulFile = contextFiles.some((file) => {
      const normalizedPath = file.path.trim().replace(/\\/g, "/");
      const baseName = normalizedPath.split("/").pop() ?? normalizedPath;
      return baseName.toLowerCase() === "soul.md";
    });
    lines.push("# Project Context", "", "The following project context files have been loaded:");
    if (hasSoulFile) {
      lines.push(
        "If SOUL.md is present, embody its persona and tone. Avoid stiff, generic replies; follow its guidance unless higher-priority instructions override it.",
      );
    }
    lines.push("");
    for (const file of contextFiles) {
      lines.push(`## ${file.path}`, "", file.content, "");
    }
  }

  // Skip silent replies for subagent/none modes
  if (!isMinimal) {
    lines.push(
      "## Silent Replies",
      `When you have nothing to say, respond with ONLY: ${SILENT_REPLY_TOKEN}`,
      "",
      "⚠️ Rules:",
      "- It must be your ENTIRE message — nothing else",
      `- Never append it to an actual response (never include "${SILENT_REPLY_TOKEN}" in real replies)`,
      "- Never wrap it in markdown or code blocks",
      "",
      `❌ Wrong: "Here's help... ${SILENT_REPLY_TOKEN}"`,
      `❌ Wrong: "${SILENT_REPLY_TOKEN}"`,
      `✅ Right: ${SILENT_REPLY_TOKEN}`,
      "",
    );
  }

  // Skip heartbeats for subagent/none modes
  if (!isMinimal) {
    lines.push(
      "## Heartbeats",
      heartbeatPromptLine,
      "If you receive a heartbeat poll (a user message matching the heartbeat prompt above), and there is nothing that needs attention, reply exactly:",
      "HEARTBEAT_OK",
      'OpenClaw treats a leading/trailing "HEARTBEAT_OK" as a heartbeat ack (and may discard it).',
      'If something needs attention, do NOT include "HEARTBEAT_OK"; reply with the alert text instead.',
      "",
    );
  }

  lines.push(
    "## Runtime",
    buildRuntimeLine(runtimeInfo, runtimeChannel, runtimeCapabilities, params.defaultThinkLevel),
    `Reasoning: ${reasoningLevel} (hidden unless on/stream). Toggle /reasoning; /status shows Reasoning when enabled.`,
  );

  return lines.filter(Boolean).join("\n");
}

export function buildRuntimeLine(
  runtimeInfo?: {
    agentId?: string;
    agentRole?: string;
    host?: string;
    os?: string;
    arch?: string;
    node?: string;
    model?: string;
    defaultModel?: string;
    repoRoot?: string;
  },
  runtimeChannel?: string,
  runtimeCapabilities: string[] = [],
  defaultThinkLevel?: ThinkLevel,
): string {
  return `Runtime: ${[
    runtimeInfo?.agentId ? `agent=${runtimeInfo.agentId}` : "",
    runtimeInfo?.agentRole ? `role=${runtimeInfo.agentRole}` : "",
    runtimeInfo?.host ? `host=${runtimeInfo.host}` : "",
    runtimeInfo?.repoRoot ? `repo=${runtimeInfo.repoRoot}` : "",
    runtimeInfo?.os
      ? `os=${runtimeInfo.os}${runtimeInfo?.arch ? ` (${runtimeInfo.arch})` : ""}`
      : runtimeInfo?.arch
        ? `arch=${runtimeInfo.arch}`
        : "",
    runtimeInfo?.node ? `node=${runtimeInfo.node}` : "",
    runtimeInfo?.model ? `model=${runtimeInfo.model}` : "",
    runtimeInfo?.defaultModel ? `default_model=${runtimeInfo.defaultModel}` : "",
    runtimeChannel ? `channel=${runtimeChannel}` : "",
    runtimeChannel
      ? `capabilities=${runtimeCapabilities.length > 0 ? runtimeCapabilities.join(",") : "none"}`
      : "",
    `thinking=${defaultThinkLevel ?? "off"}`,
  ]
    .filter(Boolean)
    .join(" | ")}`;
}
