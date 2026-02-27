import type { Command } from "commander";
import { resolveAgentWorkspaceDir, resolveDefaultAgentId } from "../agents/agent-scope.js";
import {
  buildSkillsUsageRows,
  formatSkillsUsageCsv,
  formatSkillsUsageMarkdown,
  loadSkillsUsageStore,
} from "../agents/skills-usage-store.js";
import {
  getSkillsUsageTrackerDiagnostics,
  registerSkillsUsageTracking,
} from "../agents/skills-usage-tracker.js";
import { loadConfig } from "../config/config.js";
import { defaultRuntime } from "../runtime.js";
import { formatDocsLink } from "../terminal/links.js";
import { theme } from "../terminal/theme.js";
import { formatSkillInfo, formatSkillsCheck, formatSkillsList } from "./skills-cli.format.js";

export type {
  SkillInfoOptions,
  SkillsCheckOptions,
  SkillsListOptions,
} from "./skills-cli.format.js";
export { formatSkillInfo, formatSkillsCheck, formatSkillsList } from "./skills-cli.format.js";

type SkillStatusReport = Awaited<
  ReturnType<(typeof import("../agents/skills-status.js"))["buildWorkspaceSkillStatus"]>
>;

async function loadSkillsStatusReport(): Promise<SkillStatusReport> {
  const config = loadConfig();
  const workspaceDir = resolveAgentWorkspaceDir(config, resolveDefaultAgentId(config));
  const { buildWorkspaceSkillStatus } = await import("../agents/skills-status.js");
  return buildWorkspaceSkillStatus(workspaceDir, { config });
}

async function runSkillsAction(render: (report: SkillStatusReport) => string): Promise<void> {
  try {
    const report = await loadSkillsStatusReport();
    defaultRuntime.log(render(report));
  } catch (err) {
    defaultRuntime.error(String(err));
    defaultRuntime.exit(1);
  }
}

type SkillsUsageFormat = "table" | "json" | "csv" | "markdown";
type SkillsUsageOutputRow = {
  skillName: string;
  commandCalls: number;
  mappedToolCalls: number;
  totalCalls: number;
  firstSeenAt: string;
  lastSeenAt: string;
};

function formatUsageTable(rows: SkillsUsageOutputRow[]): string {
  if (rows.length === 0) {
    return "No skill usage records found.";
  }
  const header = ["Skill", "Command", "MappedTool", "Total", "FirstSeen", "LastSeen"];
  const body = rows.map((row) => [
    row.skillName,
    String(row.commandCalls),
    String(row.mappedToolCalls),
    String(row.totalCalls),
    row.firstSeenAt,
    row.lastSeenAt,
  ]);
  const widths = header.map((text, index) =>
    Math.max(text.length, ...body.map((line) => line[index]?.length ?? 0)),
  );
  const formatLine = (line: string[]) =>
    line.map((cell, index) => cell.padEnd(widths[index], " ")).join("  ");
  return [
    formatLine(header),
    formatLine(widths.map((width) => "-".repeat(width))),
    ...body.map(formatLine),
  ].join("\n");
}

export const __formatSkillsUsageTableForTest = formatUsageTable;

function buildUsageJsonPayload(params: {
  rows: SkillsUsageOutputRow[];
  totalSkills: number;
  since: string | null;
  mappedToolCallsTotal: number;
  mappedByRunContext: number;
  mappedByStaticDispatch: number;
  unmappedToolCalls: number;
  tracker: ReturnType<typeof getSkillsUsageTrackerDiagnostics>;
}) {
  const mappingDenominator = params.mappedToolCallsTotal + params.unmappedToolCalls;
  const mappingCoverage =
    mappingDenominator > 0 ? params.mappedToolCallsTotal / mappingDenominator : null;
  return {
    summary: {
      totalSkills: params.totalSkills,
      generatedAt: new Date().toISOString(),
      since: params.since,
      mappedToolCallsTotal: params.mappedToolCallsTotal,
      mappedByRunContext: params.mappedByRunContext,
      mappedByStaticDispatch: params.mappedByStaticDispatch,
      unmappedToolCalls: params.unmappedToolCalls,
      mappingCoverage,
      attributionStrategy: "context-priority",
      attributionStrategyVersion: 1,
    },
    tracker: params.tracker,
    rows: params.rows,
  };
}

export const __buildSkillsUsageJsonPayloadForTest = buildUsageJsonPayload;

function parseTop(value?: string): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("--top must be a positive integer.");
  }
  return parsed;
}

function parseSince(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const ts = Date.parse(value);
  if (!Number.isFinite(ts)) {
    throw new Error("--since must be a valid date/time (ISO recommended).");
  }
  return new Date(ts).toISOString();
}

async function runSkillsUsageAction(opts: {
  format?: string;
  top?: string;
  since?: string;
}): Promise<void> {
  const cfg = loadConfig();
  const workspaceDir = resolveAgentWorkspaceDir(cfg, resolveDefaultAgentId(cfg));
  registerSkillsUsageTracking({ workspaceDir, config: cfg });
  const store = await loadSkillsUsageStore();
  const format = (opts.format?.trim().toLowerCase() || "table") as SkillsUsageFormat;
  if (!["table", "json", "csv", "markdown"].includes(format)) {
    throw new Error('--format must be one of: "table", "json", "csv", "markdown".');
  }
  const top = parseTop(opts.top);
  const since = parseSince(opts.since);
  let rows = buildSkillsUsageRows(store);
  if (since) {
    rows = rows.filter((row) => Date.parse(row.lastSeenAt) >= Date.parse(since));
  }
  if (top !== undefined) {
    rows = rows.slice(0, top);
  }

  if (format === "json") {
    const mappedByRunContext = store.meta.mappedByRunContext;
    const mappedByStaticDispatch = store.meta.mappedByStaticDispatch;
    const mappedToolCallsTotal = mappedByRunContext + mappedByStaticDispatch;
    const unmappedToolCalls = store.meta.unmappedToolCalls;
    defaultRuntime.log(
      JSON.stringify(
        buildUsageJsonPayload({
          rows,
          totalSkills: rows.length,
          since: since ?? null,
          mappedToolCallsTotal,
          mappedByRunContext,
          mappedByStaticDispatch,
          unmappedToolCalls,
          tracker: getSkillsUsageTrackerDiagnostics(),
        }),
        null,
        2,
      ),
    );
    return;
  }
  if (format === "csv") {
    defaultRuntime.log(formatSkillsUsageCsv(rows));
    return;
  }
  if (format === "markdown") {
    defaultRuntime.log(formatSkillsUsageMarkdown(rows));
    return;
  }
  defaultRuntime.log(formatUsageTable(rows));
}

/**
 * Register the skills CLI commands
 */
export function registerSkillsCli(program: Command) {
  const skills = program
    .command("skills")
    .description("List and inspect available skills")
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("Docs:")} ${formatDocsLink("/cli/skills", "docs.openclaw.ai/cli/skills")}\n`,
    );

  skills
    .command("list")
    .description("List all available skills")
    .option("--json", "Output as JSON", false)
    .option("--eligible", "Show only eligible (ready to use) skills", false)
    .option("-v, --verbose", "Show more details including missing requirements", false)
    .action(async (opts) => {
      await runSkillsAction((report) => formatSkillsList(report, opts));
    });

  skills
    .command("info")
    .description("Show detailed information about a skill")
    .argument("<name>", "Skill name")
    .option("--json", "Output as JSON", false)
    .action(async (name, opts) => {
      await runSkillsAction((report) => formatSkillInfo(report, name, opts));
    });

  skills
    .command("check")
    .description("Check which skills are ready vs missing requirements")
    .option("--json", "Output as JSON", false)
    .action(async (opts) => {
      await runSkillsAction((report) => formatSkillsCheck(report, opts));
    });

  skills
    .command("usage")
    .description("Show skill usage counters and exports")
    .option("--format <format>", "Output format: table|json|csv|markdown", "table")
    .option("--top <n>", "Limit to top N skills")
    .option("--since <time>", "Filter by lastSeenAt >= time (ISO date/time)")
    .action(async (opts) => {
      try {
        await runSkillsUsageAction(opts);
      } catch (err) {
        defaultRuntime.error(String(err));
        defaultRuntime.exit(1);
      }
    });

  // Default action (no subcommand) - show list
  skills.action(async () => {
    await runSkillsAction((report) => formatSkillsList(report, {}));
  });
}
