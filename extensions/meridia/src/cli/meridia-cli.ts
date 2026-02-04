import type { Command } from "commander";
import type { OpenClawConfig } from "openclaw/plugin-sdk";
import fs from "node:fs";
import path from "node:path";
import { probeModelRefAuth } from "openclaw/plugin-sdk";
import { openMeridiaDb, getMeridiaDbStats, resetMeridiaDir } from "../meridia/db/sqlite.js";
import { resolveMeridiaDir } from "../meridia/paths.js";
import { getTraceEventsByDateRange } from "../meridia/query.js";

type MeridiaStatusOptions = { json?: boolean; since?: string };
type MeridiaDoctorOptions = { json?: boolean };
type MeridiaResetOptions = { json?: boolean; dir?: string };

function parseDurationMs(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const match = trimmed.match(/^(\d+)\s*([smhd])$/i);
  if (!match) {
    return null;
  }
  const value = Number.parseInt(match[1] ?? "", 10);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  const unit = (match[2] ?? "h").toLowerCase();
  const mult = unit === "s" ? 1000 : unit === "m" ? 60_000 : unit === "h" ? 3_600_000 : 86_400_000;
  return value * mult;
}

function readHookEntry(cfg: OpenClawConfig, hookKey: string): Record<string, unknown> | undefined {
  const entry = cfg.hooks?.internal?.entries?.[hookKey] as Record<string, unknown> | undefined;
  return entry && typeof entry === "object" ? entry : undefined;
}

function readConfiguredModelRef(cfg: OpenClawConfig): string | null {
  const entry = readHookEntry(cfg, "experiential-capture");
  const raw =
    (entry?.evaluation_model as unknown) ??
    (entry?.evaluationModel as unknown) ??
    (entry?.model as unknown);
  const value = typeof raw === "string" ? raw.trim() : "";
  return value ? value : null;
}

export function registerMeridiaCli(program: Command, config: OpenClawConfig): void {
  const meridia = program.command("meridia").description("Meridia experiential continuity tools");

  meridia
    .command("status")
    .description("Show capture stats")
    .option("--since <duration>", "Lookback window (e.g. 30m, 6h, 7d)", "24h")
    .option("--json", "Machine-readable output", false)
    .action(async (opts: MeridiaStatusOptions) => {
      const sinceMs = parseDurationMs(opts.since ?? "24h");
      if (!sinceMs) {
        console.error("--since must be a duration like 30m, 6h, 7d");
        process.exitCode = 1;
        return;
      }

      const nowMs = Date.now();
      const startMs = nowMs - sinceMs;
      const fromIso = new Date(startMs).toISOString();
      const toIso = new Date(nowMs).toISOString();

      try {
        const db = openMeridiaDb({ cfg: config });
        const stats = getMeridiaDbStats(db);
        const events = getTraceEventsByDateRange(db, fromIso, toIso);

        const toolEvals = events.filter((e) => e.kind === "tool_result_eval");
        const captured = toolEvals.filter((e) => e.decision?.decision === "capture");
        const skipped = toolEvals.filter((e) => e.decision?.decision === "skip");
        const errors = toolEvals.filter((e) => e.decision?.decision === "error");
        const precompacts = events.filter((e) => e.kind === "precompact_snapshot").length;
        const compactionEnds = events.filter((e) => e.kind === "compaction_end").length;
        const sessionEnds = events.filter((e) => e.kind === "session_end_snapshot").length;
        const bootstraps = events.filter((e) => e.kind === "bootstrap_inject").length;

        const byTool = new Map<string, { seen: number; captured: number; errors: number }>();
        for (const evt of toolEvals) {
          const key = evt.tool?.name ?? "unknown";
          const entry = byTool.get(key) ?? { seen: 0, captured: 0, errors: 0 };
          entry.seen += 1;
          if (evt.decision?.decision === "capture") {
            entry.captured += 1;
          }
          if (evt.decision?.decision === "error") {
            entry.errors += 1;
          }
          byTool.set(key, entry);
        }

        const lastCapture = captured
          .map((e) => ({ ts: e.ts, tsMs: Date.parse(e.ts) }))
          .filter((e) => Number.isFinite(e.tsMs))
          .sort((a, b) => b.tsMs - a.tsMs)[0]?.ts;

        const summary = {
          since: fromIso,
          now: toIso,
          meridiaDir: resolveMeridiaDir(config),
          db: {
            schemaVersion: stats.schemaVersion,
            recordCount: stats.recordCount,
            traceCount: stats.traceCount,
            oldestRecord: stats.oldestRecord,
            newestRecord: stats.newestRecord,
          },
          toolResults: toolEvals.length,
          captured: captured.length,
          skipped: skipped.length,
          errors: errors.length,
          captureRate: toolEvals.length > 0 ? captured.length / toolEvals.length : 0,
          precompacts,
          compactionEnds,
          sessionEnds,
          bootstraps,
          lastCaptureAt: lastCapture ?? null,
          topTools: Array.from(byTool.entries())
            .map(([tool, s]) => ({ tool, ...s }))
            .sort((a, b) => b.captured - a.captured || b.seen - a.seen)
            .slice(0, 8),
        };

        if (opts.json) {
          console.log(JSON.stringify(summary, null, 2));
          return;
        }

        console.log("Meridia Status");
        console.log(`Dir: ${summary.meridiaDir}`);
        console.log(
          `Since: ${summary.since} · tool=${summary.toolResults} captured=${summary.captured} skipped=${summary.skipped} err=${summary.errors}`,
        );
        console.log(
          `Compaction: pre=${precompacts} end=${compactionEnds} · Sessions: end=${sessionEnds} · Bootstrap: ${bootstraps}`,
        );
        if (summary.lastCaptureAt) {
          console.log(`Last capture: ${summary.lastCaptureAt}`);
        }
        if (summary.topTools.length > 0) {
          console.log("Top tools:");
          for (const t of summary.topTools) {
            console.log(
              `- ${t.tool}: captured=${t.captured} seen=${t.seen}${t.errors ? ` err=${t.errors}` : ""}`,
            );
          }
        }
      } catch (err) {
        console.error(`Meridia status failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exitCode = 1;
      }
    });

  meridia
    .command("doctor")
    .description("Check hook + auth configuration")
    .option("--json", "Machine-readable output", false)
    .action(async (opts: MeridiaDoctorOptions) => {
      const meridiaDir = resolveMeridiaDir(config);
      const internalEnabled = config.hooks?.internal?.enabled === true;
      const experiential = readHookEntry(config, "experiential-capture");
      const compaction = readHookEntry(config, "compaction");
      const sessionEnd = readHookEntry(config, "session-end");
      const recon = readHookEntry(config, "meridia-reconstitution");

      const modelRef = readConfiguredModelRef(config);
      const probe = modelRef ? await probeModelRefAuth({ cfg: config, modelRef }) : null;

      const report = {
        meridiaDir,
        hooks: {
          internalEnabled,
          experientialCapture: {
            enabled: experiential?.enabled === true,
            evaluationModel: modelRef,
          },
          compaction: { enabled: compaction?.enabled === true },
          sessionEnd: { enabled: sessionEnd?.enabled === true },
          reconstitution: { enabled: recon?.enabled !== false },
        },
        evaluationModel: modelRef
          ? {
              modelRef,
              ok: probe?.ok ?? false,
              provider: probe?.provider ?? "",
              hasKey: probe?.hasKey ?? false,
              source: probe?.source ?? null,
              error: probe?.error ?? null,
            }
          : null,
        fix: {
          enableInternalHooks: "openclaw config set hooks.internal.enabled true --json",
          enableExperientialCapture:
            'openclaw config set hooks.internal.entries[\"experiential-capture\"].enabled true --json',
          enableCompaction:
            "openclaw config set hooks.internal.entries.compaction.enabled true --json",
          enableSessionEnd:
            'openclaw config set hooks.internal.entries[\"session-end\"].enabled true --json',
          enableReconstitution:
            'openclaw config set hooks.internal.entries[\"meridia-reconstitution\"].enabled true --json',
        },
      };

      if (opts.json) {
        console.log(JSON.stringify(report, null, 2));
        return;
      }

      console.log("Meridia Doctor");
      console.log(`Dir: ${meridiaDir}`);
      console.log(`Hooks internal: ${internalEnabled ? "enabled" : "disabled"}`);
      console.log(
        `experiential-capture: ${experiential?.enabled === true ? "enabled" : "disabled"}${modelRef ? ` model=${modelRef}` : ""}`,
      );
      console.log(`compaction: ${compaction?.enabled === true ? "enabled" : "disabled"}`);
      console.log(`session-end: ${sessionEnd?.enabled === true ? "enabled" : "disabled"}`);
      console.log(`meridia-reconstitution: ${recon?.enabled === false ? "disabled" : "enabled"}`);
      if (modelRef) {
        const ok = probe?.hasKey ? "ok" : "missing";
        console.log(
          `evaluation_model auth: ${ok}${probe?.source ? ` (${probe.source})` : ""}${probe?.error ? ` (${probe.error})` : ""}`,
        );
      }

      const fixes: string[] = [];
      if (!internalEnabled) fixes.push(`- ${report.fix.enableInternalHooks}`);
      if (experiential?.enabled !== true) fixes.push(`- ${report.fix.enableExperientialCapture}`);
      if (compaction?.enabled !== true) fixes.push(`- ${report.fix.enableCompaction}`);
      if (sessionEnd?.enabled !== true) fixes.push(`- ${report.fix.enableSessionEnd}`);
      if (recon?.enabled === false) fixes.push(`- ${report.fix.enableReconstitution}`);

      if (fixes.length > 0) {
        console.log("\nFix commands:");
        console.log(fixes.join("\n"));
        console.log("\nRestart the gateway after config changes.");
      }
    });

  meridia
    .command("reset")
    .description("Backup + wipe Meridia directory, then reinitialize v2 schema")
    .option("--dir <path>", "Meridia dir to reset (defaults to resolved Meridia dir)")
    .option("--json", "Machine-readable output", false)
    .action(async (opts: MeridiaResetOptions) => {
      const targetDir = opts.dir?.trim()
        ? path.resolve(opts.dir.trim())
        : resolveMeridiaDir(config);

      try {
        const exists = fs.existsSync(targetDir);
        const { backupDir } = resetMeridiaDir({ meridiaDir: targetDir });
        const db = openMeridiaDb({ meridiaDir: targetDir, allowAutoReset: false });
        const stats = getMeridiaDbStats(db);

        const out = {
          ok: true,
          meridiaDir: targetDir,
          existed: exists,
          backupDir,
          schemaVersion: stats.schemaVersion,
        };

        if (opts.json) {
          console.log(JSON.stringify(out, null, 2));
          return;
        }
        console.log(`Reset Meridia dir: ${targetDir}`);
        if (backupDir) {
          console.log(`Backup: ${backupDir}`);
        }
        console.log(`Schema: v${stats.schemaVersion ?? "unknown"}`);
      } catch (err) {
        console.error(`Meridia reset failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exitCode = 1;
      }
    });
}
