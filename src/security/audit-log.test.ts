import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  initAuditLog,
  stopAuditLog,
  emitAuditEvent,
  auditAuthLogin,
  auditAuthFailure,
  auditPairingApprove,
  auditExecRequest,
  auditRbacDenied,
  readRecentAuditEntries,
  queryAuditEntries,
  rotateAuditLogs,
} from "./audit-log.js";

describe("audit-log", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "audit-test-"));
    initAuditLog({ enabled: true, baseDir: tempDir });
  });

  afterEach(async () => {
    stopAuditLog();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("emitAuditEvent", () => {
    it("writes an event to the audit log", async () => {
      emitAuditEvent({
        type: "auth.login",
        actor: { type: "user", id: "test-user" },
        outcome: "success",
      });

      // Wait for async write
      await new Promise((resolve) => setTimeout(resolve, 50));

      const entries = await readRecentAuditEntries(10, { baseDir: tempDir });
      expect(entries.length).toBe(1);
      expect(entries[0].type).toBe("auth.login");
      expect(entries[0].actor.id).toBe("test-user");
      expect(entries[0].outcome).toBe("success");
      expect(entries[0].eventId).toBeDefined();
      expect(entries[0].ts).toBeDefined();
    });

    it("writes multiple events sequentially", async () => {
      for (let i = 0; i < 5; i++) {
        emitAuditEvent({
          type: "auth.login",
          actor: { type: "user", id: `user-${i}` },
          outcome: "success",
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      const entries = await readRecentAuditEntries(10, { baseDir: tempDir });
      expect(entries.length).toBe(5);
      // Most recent first
      expect(entries[0].actor.id).toBe("user-4");
    });

    it("includes metadata when provided", async () => {
      emitAuditEvent({
        type: "config.change",
        actor: { type: "user", id: "admin" },
        outcome: "success",
        metadata: { key: "gateway.port", oldValue: 18789, newValue: 8080 },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const entries = await readRecentAuditEntries(10, { baseDir: tempDir });
      expect(entries[0].metadata).toEqual({
        key: "gateway.port",
        oldValue: 18789,
        newValue: 8080,
      });
    });
  });

  describe("convenience functions", () => {
    it("auditAuthLogin writes correct event", async () => {
      auditAuthLogin({
        actor: { type: "user", id: "user-1", remoteIp: "192.168.1.1" },
        method: "token",
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const entries = await readRecentAuditEntries(10, { baseDir: tempDir });
      expect(entries[0].type).toBe("auth.login");
      expect(entries[0].metadata?.method).toBe("token");
    });

    it("auditAuthFailure writes correct event", async () => {
      auditAuthFailure({
        actor: { type: "user", id: "unknown", remoteIp: "10.0.0.1" },
        reason: "invalid_token",
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const entries = await readRecentAuditEntries(10, { baseDir: tempDir });
      expect(entries[0].type).toBe("auth.failure");
      expect(entries[0].outcome).toBe("failure");
      expect(entries[0].metadata?.reason).toBe("invalid_token");
    });

    it("auditPairingApprove writes correct event", async () => {
      auditPairingApprove({
        actor: { type: "user", id: "admin" },
        target: { type: "device", id: "device-123" },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const entries = await readRecentAuditEntries(10, { baseDir: tempDir });
      expect(entries[0].type).toBe("pairing.approve");
      expect(entries[0].target?.id).toBe("device-123");
    });

    it("auditExecRequest writes correct event", async () => {
      auditExecRequest({
        actor: { type: "agent", id: "pi" },
        target: { type: "session", id: "session-abc" },
        command: "ls -la",
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const entries = await readRecentAuditEntries(10, { baseDir: tempDir });
      expect(entries[0].type).toBe("exec.request");
      expect(entries[0].metadata?.command).toBe("ls -la");
    });

    it("auditRbacDenied writes correct event", async () => {
      auditRbacDenied({
        actor: { type: "user", id: "user-1" },
        action: "exec.elevated",
        resource: "/bin/bash",
        reason: "role does not have elevated permission",
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const entries = await readRecentAuditEntries(10, { baseDir: tempDir });
      expect(entries[0].type).toBe("rbac.denied");
      expect(entries[0].outcome).toBe("denied");
      expect(entries[0].metadata?.action).toBe("exec.elevated");
    });
  });

  describe("queryAuditEntries", () => {
    beforeEach(async () => {
      // Write some test events
      emitAuditEvent({
        type: "auth.login",
        actor: { type: "user", id: "user-1" },
        outcome: "success",
      });
      emitAuditEvent({
        type: "auth.failure",
        actor: { type: "user", id: "user-2" },
        outcome: "failure",
      });
      emitAuditEvent({
        type: "auth.login",
        actor: { type: "user", id: "user-3" },
        outcome: "success",
      });

      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    it("filters by type", async () => {
      const entries = await queryAuditEntries({ type: "auth.login" }, 10, { baseDir: tempDir });
      expect(entries.length).toBe(2);
      expect(entries.every((e) => e.type === "auth.login")).toBe(true);
    });

    it("filters by outcome", async () => {
      const entries = await queryAuditEntries({ outcome: "failure" }, 10, { baseDir: tempDir });
      expect(entries.length).toBe(1);
      expect(entries[0].actor.id).toBe("user-2");
    });

    it("filters by actor", async () => {
      const entries = await queryAuditEntries({ actor: "user-1" }, 10, { baseDir: tempDir });
      expect(entries.length).toBe(1);
      expect(entries[0].actor.id).toBe("user-1");
    });
  });

  describe("disabled state", () => {
    it("does not write when disabled", async () => {
      stopAuditLog();
      initAuditLog({ enabled: false, baseDir: tempDir });

      emitAuditEvent({
        type: "auth.login",
        actor: { type: "user", id: "test" },
        outcome: "success",
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const entries = await readRecentAuditEntries(10, { baseDir: tempDir });
      // Should only have entries from previous tests, not the new one
      expect(entries.filter((e) => e.actor.id === "test").length).toBe(0);
    });
  });

  describe("rotateAuditLogs", () => {
    it("removes files older than retention period", async () => {
      // Create old audit files
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10);
      const oldDateStr = oldDate.toISOString().slice(0, 10);
      const oldFilePath = path.join(tempDir, `audit.${oldDateStr}.jsonl`);
      await fs.writeFile(oldFilePath, '{"test": true}\n');

      // Run rotation with 7-day retention
      await rotateAuditLogs({ enabled: true, baseDir: tempDir, retentionDays: 7 });

      // Old file should be deleted
      const exists = await fs
        .stat(oldFilePath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(false);
    });

    it("keeps files within retention period", async () => {
      // Create recent audit file
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 3);
      const recentDateStr = recentDate.toISOString().slice(0, 10);
      const recentFilePath = path.join(tempDir, `audit.${recentDateStr}.jsonl`);
      await fs.writeFile(recentFilePath, '{"test": true}\n');

      // Run rotation with 7-day retention
      await rotateAuditLogs({ enabled: true, baseDir: tempDir, retentionDays: 7 });

      // Recent file should still exist
      const exists = await fs
        .stat(recentFilePath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });
  });
});
