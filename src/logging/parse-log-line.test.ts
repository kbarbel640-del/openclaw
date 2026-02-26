import { describe, expect, it } from "vitest";
import { parseLogLine } from "./parse-log-line.js";

describe("parseLogLine", () => {
  it("parses structured JSON log lines", () => {
    const line = JSON.stringify({
      time: "2026-01-09T01:38:41.523Z",
      0: '{"subsystem":"gateway/channels/whatsapp"}',
      1: "connected",
      _meta: {
        name: '{"subsystem":"gateway/channels/whatsapp"}',
        logLevelName: "INFO",
      },
    });

    const parsed = parseLogLine(line);

    expect(parsed).not.toBeNull();
    expect(parsed?.time).toBe("2026-01-09T01:38:41.523Z");
    expect(parsed?.level).toBe("info");
    expect(parsed?.subsystem).toBe("gateway/channels/whatsapp");
    expect(parsed?.message).toBe('{"subsystem":"gateway/channels/whatsapp"} connected');
    expect(parsed?.raw).toBe(line);
  });

  it("falls back to meta timestamp when top-level time is missing", () => {
    const line = JSON.stringify({
      0: "hello",
      _meta: {
        name: '{"subsystem":"gateway"}',
        logLevelName: "WARN",
        date: "2026-01-09T02:10:00.000Z",
      },
    });

    const parsed = parseLogLine(line);

    expect(parsed?.time).toBe("2026-01-09T02:10:00.000Z");
    expect(parsed?.level).toBe("warn");
  });

  it("returns null for invalid JSON", () => {
    expect(parseLogLine("not-json")).toBeNull();
  });

  it("parses structured format [date time] [pid] [subsystem] level: message", () => {
    const line = "[2026-02-23 15:42:38.123] [12345] [config] info: Config reloaded successfully";
    const parsed = parseLogLine(line);

    expect(parsed).not.toBeNull();
    expect(parsed?.time).toBe("2026-02-23 15:42:38.123");
    expect(parsed?.level).toBe("info");
    expect(parsed?.subsystem).toBe("config");
    expect(parsed?.message).toBe("Config reloaded successfully");
    expect(parsed?.raw).toBe(line);
  });

  it("parses structured format with gateway subsystem", () => {
    const line = "[2026-02-23 16:00:00.000] [9999] [gateway/channels/whatsapp] info: connected";
    const parsed = parseLogLine(line);

    expect(parsed).not.toBeNull();
    expect(parsed?.time).toBe("2026-02-23 16:00:00.000");
    expect(parsed?.level).toBe("info");
    expect(parsed?.subsystem).toBe("gateway/channels/whatsapp");
    expect(parsed?.message).toBe("connected");
  });
});
