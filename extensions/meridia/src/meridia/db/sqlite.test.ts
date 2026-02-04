import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { MeridiaExperienceRecordV2 } from "../types.js";
import { searchRecords } from "../query.js";
import {
  closeMeridiaDb,
  getMeridiaDbStats,
  insertExperienceRecord,
  openMeridiaDb,
} from "./sqlite.js";

const originalStateDir = process.env.OPENCLAW_STATE_DIR;

afterEach(() => {
  closeMeridiaDb();
  if (originalStateDir === undefined) {
    delete process.env.OPENCLAW_STATE_DIR;
  } else {
    process.env.OPENCLAW_STATE_DIR = originalStateDir;
  }
});

describe("meridia sqlite v2", () => {
  it("auto-resets legacy data for default meridia dir", () => {
    const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-meridia-"));
    process.env.OPENCLAW_STATE_DIR = stateDir;

    const meridiaDir = path.join(stateDir, "meridia");
    fs.mkdirSync(meridiaDir, { recursive: true });
    fs.writeFileSync(path.join(meridiaDir, "legacy.txt"), "legacy");

    const db = openMeridiaDb({ cfg: {}, meridiaDir });
    const stats = getMeridiaDbStats(db);
    expect(stats.schemaVersion).toBe("2");
    expect(fs.existsSync(meridiaDir)).toBe(true);

    const backups = fs
      .readdirSync(stateDir)
      .filter((entry) => entry.startsWith("meridia-bak-"))
      .map((entry) => path.join(stateDir, entry));
    expect(backups.length).toBeGreaterThan(0);
  });

  it("refuses auto-reset for non-default meridia dirs", () => {
    const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-meridia-"));
    process.env.OPENCLAW_STATE_DIR = stateDir;

    const meridiaDir = path.join(stateDir, "custom-meridia");
    fs.mkdirSync(meridiaDir, { recursive: true });
    fs.writeFileSync(path.join(meridiaDir, "legacy.txt"), "legacy");

    expect(() => openMeridiaDb({ cfg: {}, meridiaDir })).toThrow(/openclaw meridia reset/);
  });

  it("inserts and searches records", () => {
    const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-meridia-"));
    process.env.OPENCLAW_STATE_DIR = stateDir;

    const meridiaDir = path.join(stateDir, "meridia");
    const db = openMeridiaDb({ cfg: {}, meridiaDir });

    const record: MeridiaExperienceRecordV2 = {
      v: 2,
      id: "rec-1",
      ts: new Date().toISOString(),
      kind: "manual",
      session: { key: "s1" },
      tool: { name: "experience_capture", callId: "t1", isError: false },
      capture: {
        score: 0.9,
        evaluation: { kind: "heuristic", score: 0.9, reason: "manual" },
      },
      content: { topic: "debugging breakthrough", tags: ["debugging"] },
      data: { args: { foo: "bar" } },
    };

    const inserted = insertExperienceRecord(db, record);
    expect(inserted).toBe(true);

    const results = searchRecords(db, "breakthrough", { limit: 10 });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.record.id).toBe("rec-1");
  });
});
