import { describe, it, expect } from "vitest";
import { formatAlertMessage, type SystemAlert } from "./format.js";

describe("formatAlertMessage", () => {
  it("formats critical alert correctly", () => {
    const alert: SystemAlert = {
      level: "critical",
      title: "Test Failure",
      source: "cron:123",
      details: "Something went wrong",
      timestamp: 1700000000000,
    };

    const msg = formatAlertMessage(alert);

    expect(msg).toContain("🚨 **System Alert: Test Failure**");
    expect(msg).toContain("🛑 **Error**: `Something went wrong`");
    expect(msg).toContain("🤖 **Source**: `cron:123`");
  });

  it("includes job name if provided in meta", () => {
    const alert: SystemAlert = {
      level: "error",
      title: "Job Failed",
      source: "cron:456",
      details: "Error",
      meta: { jobName: "Finance Radar" },
    };

    const msg = formatAlertMessage(alert);
    expect(msg).toContain("📦 **Job**: `Finance Radar`");
    expect(msg).toContain("❌ **System Alert: Job Failed**");
  });

  it("truncates long error messages", () => {
    const longError = "A".repeat(300);
    const alert: SystemAlert = {
      level: "warning",
      title: "Long Error",
      source: "test",
      details: longError,
    };

    const msg = formatAlertMessage(alert);
    expect(msg).toContain("`" + "A".repeat(197) + "...");
    expect(msg.length).toBeLessThan(500);
  });
});
