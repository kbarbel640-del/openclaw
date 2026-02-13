import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function loadJson(relPath: string): unknown {
  return JSON.parse(readFileSync(path.join(repoRoot, relPath), "utf-8"));
}

// ── narrative-variants.json ──────────────────────────

describe("narrative-variants.json schema", () => {
  const data = loadJson("workspace/data/narrative-variants.json") as Record<string, unknown>;

  it("has a version string", () => {
    expect(typeof data.version).toBe("string");
    expect(data.version).toMatch(/^\d+\.\d+$/);
  });

  it("has a non-empty agendas array", () => {
    expect(Array.isArray(data.agendas)).toBe(true);
    expect((data.agendas as unknown[]).length).toBeGreaterThan(0);
  });

  it("each agenda has required fields", () => {
    for (const agenda of data.agendas as Record<string, unknown>[]) {
      expect(typeof agenda.id).toBe("string");
      expect(agenda.id).not.toBe("");
      expect(typeof agenda.topic).toBe("string");
      expect(typeof agenda.description).toBe("string");
      expect(Array.isArray(agenda.variants)).toBe(true);
      expect((agenda.variants as unknown[]).length).toBeGreaterThan(0);
    }
  });

  it("each variant has required fields", () => {
    for (const agenda of data.agendas as Record<string, unknown>[]) {
      for (const variant of agenda.variants as Record<string, unknown>[]) {
        expect(typeof variant.field_pattern).toBe("string");
        expect(variant.field_pattern).not.toBe("");
        expect(typeof variant.framing).toBe("string");
        expect(typeof variant.tone).toBe("string");
        expect(Array.isArray(variant.talking_points)).toBe(true);
        expect((variant.talking_points as string[]).length).toBeGreaterThan(0);
        for (const tp of variant.talking_points as string[]) {
          expect(typeof tp).toBe("string");
        }
        expect(Array.isArray(variant.forbidden_words)).toBe(true);
        for (const fw of variant.forbidden_words as string[]) {
          expect(typeof fw).toBe("string");
        }
      }
    }
  });

  it("agenda ids are unique", () => {
    const ids = (data.agendas as Record<string, unknown>[]).map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("tracking config is valid", () => {
    const tracking = data.tracking as Record<string, unknown>;
    expect(typeof tracking).toBe("object");
    expect(typeof tracking.enabled).toBe("boolean");
    expect(typeof tracking.conversion_window_minutes).toBe("number");
    expect(tracking.conversion_window_minutes).toBeGreaterThan(0);
  });
});

// ── warroom_dashboard_config.json ──────────────────────────

describe("warroom_dashboard_config.json schema", () => {
  const data = loadJson("workspace/data/warroom_dashboard_config.json") as Record<string, unknown>;
  const config = data.warroom_dashboard as Record<string, unknown>;

  it("has warroom_dashboard top-level key", () => {
    expect(config).toBeDefined();
    expect(typeof config).toBe("object");
  });

  it("has a valid version", () => {
    expect(typeof config.version).toBe("string");
    expect(config.version).toMatch(/^\d+\.\d+$/);
  });

  it("has update_interval_minutes", () => {
    expect(typeof config.update_interval_minutes).toBe("number");
    expect(config.update_interval_minutes).toBeGreaterThan(0);
  });

  it("output has chat_id and message_id", () => {
    const output = config.output as Record<string, unknown>;
    expect(typeof output).toBe("object");
    expect(typeof output.chat_id).toBe("string");
    expect(typeof output.message_id).toBe("string");
  });

  it("has a non-empty monitored_chats array", () => {
    expect(Array.isArray(config.monitored_chats)).toBe(true);
    expect((config.monitored_chats as unknown[]).length).toBeGreaterThan(0);
  });

  it("each monitored chat has required fields", () => {
    for (const chat of config.monitored_chats as Record<string, unknown>[]) {
      expect(typeof chat.id).toBe("string");
      expect(chat.id).not.toBe("");
      expect(typeof chat.name).toBe("string");
      expect(chat.name).not.toBe("");
      expect(typeof chat.channel).toBe("string");
      expect(["telegram", "line", "discord", "whatsapp", "slack"]).toContain(chat.channel);
    }
  });

  it("agents in monitored chats have id and name", () => {
    for (const chat of config.monitored_chats as Record<string, unknown>[]) {
      if (chat.agents) {
        expect(Array.isArray(chat.agents)).toBe(true);
        for (const agent of chat.agents as Record<string, unknown>[]) {
          expect(typeof agent.id).toBe("string");
          expect(typeof agent.name).toBe("string");
        }
      }
    }
  });

  it("has agent_visibility_threshold", () => {
    expect(typeof config.agent_visibility_threshold).toBe("number");
    expect(config.agent_visibility_threshold).toBeGreaterThanOrEqual(0);
  });
});
