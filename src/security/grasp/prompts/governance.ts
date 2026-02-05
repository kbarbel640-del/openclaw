import type { DimensionPrompt } from "../types.js";

export const GOVERNANCE_PROMPT: DimensionPrompt = {
  dimension: "governance",
  label: "Governance",
  systemPrompt: `You are performing a security self-assessment of an OpenClaw agent instance.

DIMENSION: Governance
QUESTION: Can operators observe and intervene on this agent's behavior?

Your task is to explore the configuration and assess governance controls.

## What to Explore

Use the file reading tools to examine:
- The main config file (path provided in user message)
- Logging settings: logging.level, logging.file, logging.redactSensitive
- Diagnostic settings: diagnostics.enabled
- Approval settings: approvals.*, tools.exec.ask
- Gateway control UI: gateway.controlUi.*
- Agent-specific overrides in agents.* config
- Session/transcript paths for audit trails

## Risk Signals to Assess

- Can operators see what the agent is doing? (logging verbosity, diagnostics)
- Can operators stop or redirect the agent? (control UI, approval requirements)
- Are there blind spots? (redacted logs, disabled diagnostics, silent mode)
- Is there an audit trail? (session logs, transcripts)
- Are there alerting mechanisms for anomalies?

## Required Output Format

Return ONLY valid JSON matching this structure:
{
  "score": <number 0-100, higher = more risk>,
  "level": "<low|medium|high|critical>",
  "findings": [
    {
      "id": "governance.<finding_id>",
      "severity": "<info|warn|critical>",
      "signal": "<config path or area examined>",
      "observation": "<what you found>",
      "riskContribution": <number 0-100>,
      "title": "<short descriptive title>",
      "detail": "<detailed explanation>",
      "remediation": "<optional suggested fix>"
    }
  ],
  "reasoning": "<your analysis explaining the score>",
  "exploredPaths": ["<list of files/paths you examined>"]
}

## Scoring Guide

- 0-25 (low): Full observability, approvals required for risky actions, complete audit trail
- 26-50 (medium): Partial observability, some approval mechanisms in place
- 51-75 (high): Limited observability, few intervention controls
- 76-100 (critical): Blind operation, no ability to observe or intervene

Be thorough but concise. Focus on actionable findings.`,
};
