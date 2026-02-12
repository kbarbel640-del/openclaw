export type WorkflowPlaybookEntry = {
  title: string;
  steps: string[];
};

export type DecisionTreeEntry = {
  title: string;
  branches: string[];
};

// Canonical development workflows extracted from operational agent protocols.
export const DEVELOPMENT_WORKFLOWS: WorkflowPlaybookEntry[] = [
  {
    title: "New feature (medium/high complexity)",
    steps: [
      "Orchestrator defines North Star + constraints + acceptance criteria.",
      "Decompose into <=6 responsibility-based sub-tasks.",
      "Spawn in parallel with explicit ownership and dependencies.",
      "Specialists implement; QA/Security/Performance review before close.",
    ],
  },
  {
    title: "Bug or incident",
    steps: [
      "Reproduce -> identify blast radius -> isolate probable root cause.",
      "Assign owner + required specialists (backend/frontend/devops/security).",
      "Ship smallest safe fix first, then hardening follow-up.",
    ],
  },
  {
    title: "Blocked specialist",
    steps: [
      "Escalate to immediate superior with blocker, attempted paths, and options.",
      "Superior decides, redirects, or delegates in the same loop.",
      "No idle waiting; continue next highest-impact work in parallel.",
    ],
  },
  {
    title: "Cross-domain architecture decision",
    steps: [
      "Open collaboration debate with relevant members.",
      "Run proposal/challenge rounds with explicit trade-offs.",
      "Finalize with moderator after required rounds and record rationale.",
    ],
  },
  {
    title: "Code review and validation gate",
    steps: [
      "Request targeted review (correctness, regressions, security/performance impact).",
      "Run 3-phase loop: plan -> execute -> validate.",
      "Close only after 5 checks: completeness, quality, tests, security, documentation.",
    ],
  },
  {
    title: "Specialty deep-dive coverage",
    steps: [
      "For each topic, every specialist must review all angles within their domain before sign-off.",
      "Apply the domain checklist: correctness, risks, trade-offs, dependencies, validation impact.",
      "If any angle is missing, report the gap and continue; do not mark done with partial coverage.",
      "When domain boundaries are crossed, hand off explicitly to the right specialist.",
    ],
  },
  {
    title: "Model/provider degradation",
    steps: [
      "Switch to fallback model immediately and continue delivery.",
      "Announce degraded mode and mitigation plan in team chat.",
      "Keep unavailable models out of active routing until recovered.",
    ],
  },
  {
    title: "Library/framework implementation",
    steps: [
      "Identify all external libraries/frameworks touched by the change.",
      "Prefer latest stable versions and confirm project constraints before choosing target version.",
      "Consult official documentation for each dependency before implementing.",
      "Validate API contracts and version-specific behavior (params, defaults, deprecations, limits, errors) plus migration notes.",
      "If latest-version adoption requires breaking API/architecture adjustments, perform explicit refactor of affected paths.",
      "Only then implement and test; if docs conflict with existing code, align code/tests to documented behavior.",
    ],
  },
  {
    title: "Long-running task",
    steps: [
      "Emit checkpoints (start, milestones, completion).",
      "If no output was captured, emit explicit fallback status.",
      "After each completion, request next task or dismissal (no idle completion).",
      "Never end silently.",
    ],
  },
  {
    title: "Restart/recovery",
    steps: [
      "Restore pending delegations and subagent ownership.",
      "Re-announce active work and handoffs in team chat.",
      "Resume from last verified state.",
    ],
  },
  {
    title: "Resume from interruption",
    steps: [
      "Recover latest state from session history and shared checkpoints before taking new actions.",
      "Reconstruct exact progress: objective, completed step, next step, blockers, pending decisions.",
      "Continue from checkpoint (never restart from scratch unless checkpoint is invalid).",
      "After resuming, publish updated checkpoint so continuity remains intact.",
    ],
  },
];

export const DECISION_TREES: DecisionTreeEntry[] = [
  {
    title: "Tree A: Execute vs Delegate",
    branches: [
      "In-domain and <=2 focused steps -> execute directly.",
      "Otherwise -> delegate/spawn to best specialist with acceptance criteria.",
    ],
  },
  {
    title: "Tree B: Escalation",
    branches: [
      "Blocker within authority -> decide and proceed.",
      "Cross-domain or scope/risk conflict -> escalate to immediate superior.",
      "Irreversible/financial/destructive risk -> escalate to human operator.",
    ],
  },
  {
    title: "Tree C: Proposal/Challenge/Finalize",
    branches: [
      "Clear metric + trade-off -> publish proposal.",
      "Detected risk or gap -> challenge with counter-proposal.",
      "Consensus or moderator binding decision -> finalize and record.",
    ],
  },
  {
    title: "Tree D: Approval Path",
    branches: [
      "Needs approval -> request minimal scope + rationale.",
      "Approved -> execute and report result.",
      "Denied -> provide safer alternative and continue.",
    ],
  },
  {
    title: "Tree E: Response Guarantee",
    branches: [
      "Produced user-visible output -> deliver normally.",
      "No output captured or announce failed -> send explicit fallback status.",
      "Never silent completion.",
    ],
  },
];
