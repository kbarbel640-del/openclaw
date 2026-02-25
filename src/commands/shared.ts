/**
 * Shared Resources Management
 *
 * Manages shared infrastructure across agents:
 * - Skills registry
 * - Shared tools and credentials
 * - Cross-agent coordination
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { resolveDefaultAgentWorkspaceDir } from "../agents/workspace.js";
import type { RuntimeEnv } from "../runtime.js";
import { defaultRuntime } from "../runtime.js";
import { requireValidConfig } from "./agents.command-shared.js";

type SharedListOptions = {
  json?: boolean;
  skills?: boolean;
  tools?: boolean;
};

type SkillInfo = {
  name: string;
  path: string;
  description?: string;
  hasSkillMd: boolean;
};

type SharedResourcesSummary = {
  skills: SkillInfo[];
  sharedFiles: string[];
  agentCount: number;
};

/**
 * Discover skills in a workspace
 */
function discoverSkills(workspacePath: string): SkillInfo[] {
  const skillsDir = path.join(workspacePath, "skills");
  const skills: SkillInfo[] = [];

  if (!fs.existsSync(skillsDir)) {
    return skills;
  }

  const entries = fs.readdirSync(skillsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const skillPath = path.join(skillsDir, entry.name);
      const skillMdPath = path.join(skillPath, "SKILL.md");
      const hasSkillMd = fs.existsSync(skillMdPath);

      let description: string | undefined;
      if (hasSkillMd) {
        try {
          const content = fs.readFileSync(skillMdPath, "utf-8");
          // Extract first paragraph or heading as description
          const lines = content.split("\n").filter((l) => l.trim());
          const descLine = lines.find((l) => !l.startsWith("#") && l.trim().length > 0);
          if (descLine) {
            description = descLine.trim().slice(0, 100);
          }
        } catch {
          // Ignore read errors
        }
      }

      skills.push({
        name: entry.name,
        path: skillPath,
        description,
        hasSkillMd,
      });
    } else if (entry.name.endsWith(".skill")) {
      // Handle .skill files (skill manifests)
      skills.push({
        name: entry.name.replace(".skill", ""),
        path: path.join(skillsDir, entry.name),
        hasSkillMd: false,
      });
    }
  }

  return skills.toSorted((a, b) => a.name.localeCompare(b.name));
}

/**
 * Find shared files in workspace root
 */
function findSharedFiles(workspacePath: string): string[] {
  const sharedFileNames = ["SHARED.md", "TOOLS.md", "CONTACTS.md", "USER.md", "AGENTS-REGISTRY.md"];

  return sharedFileNames.filter((name) => fs.existsSync(path.join(workspacePath, name)));
}

/**
 * Count agents in workspace
 */
function countAgents(workspacePath: string): number {
  const agentsDir = path.join(workspacePath, "agents");
  if (!fs.existsSync(agentsDir)) {
    return 0;
  }

  const entries = fs.readdirSync(agentsDir, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).length;
}

/**
 * Build summary of shared resources
 */
function buildSharedSummary(workspacePath: string): SharedResourcesSummary {
  return {
    skills: discoverSkills(workspacePath),
    sharedFiles: findSharedFiles(workspacePath),
    agentCount: countAgents(workspacePath),
  };
}

function formatSkillsList(skills: SkillInfo[]): string {
  if (skills.length === 0) {
    return "No skills found in workspace/skills/";
  }

  const lines = ["Skills:", ""];
  for (const skill of skills) {
    const status = skill.hasSkillMd ? "✓" : "○";
    const desc = skill.description ? ` — ${skill.description}` : "";
    lines.push(`  ${status} ${skill.name}${desc}`);
  }
  lines.push("");
  lines.push("Legend: ✓ has SKILL.md, ○ missing docs");

  return lines.join("\n");
}

function formatSharedSummary(summary: SharedResourcesSummary, workspacePath: string): string {
  const lines = [
    "Shared Resources",
    "================",
    "",
    `Workspace: ${workspacePath}`,
    `Agents: ${summary.agentCount}`,
    `Skills: ${summary.skills.length}`,
    "",
  ];

  if (summary.sharedFiles.length > 0) {
    lines.push("Shared Files:");
    for (const file of summary.sharedFiles) {
      lines.push(`  - ${file}`);
    }
    lines.push("");
  }

  lines.push("Top Skills:");
  const topSkills = summary.skills.slice(0, 10);
  for (const skill of topSkills) {
    const status = skill.hasSkillMd ? "✓" : "○";
    lines.push(`  ${status} ${skill.name}`);
  }
  if (summary.skills.length > 10) {
    lines.push(`  ... and ${summary.skills.length - 10} more`);
  }

  lines.push("");
  lines.push("Commands:");
  lines.push("  openclaw shared skills     — List all skills");
  lines.push("  openclaw shared sync       — Sync SHARED.md to all agents");

  return lines.join("\n");
}

export async function sharedListCommand(
  opts: SharedListOptions,
  runtime: RuntimeEnv = defaultRuntime,
) {
  const cfg = await requireValidConfig(runtime);
  if (!cfg) {
    return;
  }

  const workspacePath = resolveDefaultAgentWorkspaceDir(process.env) ?? process.cwd();
  const summary = buildSharedSummary(workspacePath);

  if (opts.json) {
    runtime.log(JSON.stringify(summary, null, 2));
    return;
  }

  if (opts.skills) {
    runtime.log(formatSkillsList(summary.skills));
    return;
  }

  runtime.log(formatSharedSummary(summary, workspacePath));
}

/**
 * Sync SHARED.md reference to all agent AGENTS.md files
 */
export async function sharedSyncCommand(runtime: RuntimeEnv = defaultRuntime) {
  const cfg = await requireValidConfig(runtime);
  if (!cfg) {
    return;
  }

  const workspacePath = resolveDefaultAgentWorkspaceDir(process.env) ?? process.cwd();
  const agentsDir = path.join(workspacePath, "agents");

  if (!fs.existsSync(agentsDir)) {
    runtime.log("No agents directory found.");
    return;
  }

  const sharedMdPath = path.join(workspacePath, "SHARED.md");
  if (!fs.existsSync(sharedMdPath)) {
    runtime.log("No SHARED.md found in workspace root. Create one first.");
    return;
  }

  const sharedBlock = `## 🌐 Shared Infrastructure

**READ FIRST:** \`${sharedMdPath}\` contains shared tools all agents can use.

Check SHARED.md before building something that might already exist.
`;

  const entries = fs.readdirSync(agentsDir, { withFileTypes: true });
  let updated = 0;
  let skipped = 0;

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const agentsMdPath = path.join(agentsDir, entry.name, "AGENTS.md");
    if (!fs.existsSync(agentsMdPath)) {
      continue;
    }

    const content = fs.readFileSync(agentsMdPath, "utf-8");
    if (content.includes("Shared Infrastructure")) {
      skipped++;
      continue;
    }

    // Insert after first heading
    const lines = content.split("\n");
    const firstHeadingIndex = lines.findIndex((l) => l.startsWith("# "));
    if (firstHeadingIndex >= 0) {
      lines.splice(firstHeadingIndex + 1, 0, "", sharedBlock);
      fs.writeFileSync(agentsMdPath, lines.join("\n"));
      updated++;
      runtime.log(`Updated: ${entry.name}`);
    }
  }

  runtime.log(`\nSync complete: ${updated} updated, ${skipped} already had reference.`);
}

// Export for CLI registration
export const sharedCommands = {
  list: sharedListCommand,
  skills: (opts: SharedListOptions, runtime?: RuntimeEnv) =>
    sharedListCommand({ ...opts, skills: true }, runtime),
  sync: sharedSyncCommand,
};
