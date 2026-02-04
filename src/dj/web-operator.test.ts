/**
 * Tests for Web Operator
 */

import { existsSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BrowserInterface, PageContext } from "./web-operator.js";
import {
  createWebOperator,
  generateWorkflowId,
  requiresHardApproval,
  WebOperator,
} from "./web-operator.js";

describe("web-operator", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `openclaw-webop-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  // ===========================================================================
  // Profile Restriction Tests
  // ===========================================================================

  describe("profile restrictions", () => {
    it("should disable browser in cheap profile", () => {
      const operator = createWebOperator();
      expect(operator.isBrowserAllowedForProfile("cheap")).toBe(false);
    });

    it("should allow browser in normal profile", () => {
      const operator = createWebOperator();
      expect(operator.isBrowserAllowedForProfile("normal")).toBe(true);
    });

    it("should allow browser in deep profile", () => {
      const operator = createWebOperator();
      expect(operator.isBrowserAllowedForProfile("deep")).toBe(true);
    });

    it("should return restriction message for cheap profile", () => {
      const operator = createWebOperator();
      const message = operator.getProfileRestrictionMessage("cheap");
      expect(message).toContain("disabled");
      expect(message).toContain("normal");
    });

    it("should return null for allowed profiles", () => {
      const operator = createWebOperator();
      expect(operator.getProfileRestrictionMessage("normal")).toBeNull();
      expect(operator.getProfileRestrictionMessage("deep")).toBeNull();
    });
  });

  // ===========================================================================
  // Cron Safety Tests
  // ===========================================================================

  describe("cron safety", () => {
    it("should downgrade deep to normal for cron", () => {
      const operator = createWebOperator();
      expect(operator.getSafeProfileForCron("deep")).toBe("normal");
    });

    it("should keep normal as normal for cron", () => {
      const operator = createWebOperator();
      expect(operator.getSafeProfileForCron("normal")).toBe("normal");
    });

    it("should keep cheap as cheap for cron", () => {
      const operator = createWebOperator();
      expect(operator.getSafeProfileForCron("cheap")).toBe("cheap");
    });
  });

  // ===========================================================================
  // Plan Mode Tests (No Side Effects)
  // ===========================================================================

  describe("plan mode - no side effects", () => {
    it("should return plan without invoking browser", async () => {
      const operator = createWebOperator();

      // Browser should NOT be called during planning
      const mockBrowser: BrowserInterface = {
        navigate: vi.fn().mockRejectedValue(new Error("Should not be called")),
        click: vi.fn().mockRejectedValue(new Error("Should not be called")),
        fill: vi.fn().mockRejectedValue(new Error("Should not be called")),
        submit: vi.fn().mockRejectedValue(new Error("Should not be called")),
        snapshot: vi.fn().mockRejectedValue(new Error("Should not be called")),
        wait: vi.fn().mockRejectedValue(new Error("Should not be called")),
        close: vi.fn().mockRejectedValue(new Error("Should not be called")),
      };

      // Plan should complete without errors (browser not used)
      const plan = await operator.plan(
        "Navigate to https://example.com and click subscribe",
        "normal",
      );

      expect(plan.workflowId).toBeTruthy();
      expect(plan.steps.length).toBeGreaterThan(0);

      // Verify browser was never called
      expect(mockBrowser.navigate).not.toHaveBeenCalled();
      expect(mockBrowser.click).not.toHaveBeenCalled();
      expect(mockBrowser.submit).not.toHaveBeenCalled();
      expect(mockBrowser.snapshot).not.toHaveBeenCalled();
    });

    it("should report blockers for cheap profile", async () => {
      const operator = createWebOperator();

      const plan = await operator.plan("Navigate to https://example.com", "cheap");

      expect(plan.blockers.length).toBeGreaterThan(0);
      expect(plan.blockers[0]).toContain("disabled");
    });

    it("should generate warnings for auto-submit caps", async () => {
      const operator = createWebOperator({
        policy: {
          autoSubmitEnabled: true,
          autoSubmitDailyCap: 0, // Already at cap
          autoSubmitWorkflowCap: 1,
          requireHttps: true,
          maxFreeTextFields: 2,
          maxFreeTextChars: 500,
          sensitiveKeywords: [],
          logFieldValues: false,
          writeNotionWebOpsLog: false,
        },
        logging: {},
        approvalTimeoutMs: 5000,
      });

      const plan = await operator.plan("Submit form at https://example.com", "normal");

      // Should have warning about caps
      expect(plan.warnings.some((w) => w.includes("cap") || w.includes("blocked"))).toBe(true);
    });
  });

  // ===========================================================================
  // Execute Mode Tests
  // ===========================================================================

  describe("execute mode", () => {
    it("should fail execution for cheap profile", async () => {
      const operator = createWebOperator();
      const mockBrowser = createMockBrowser();

      const result = await operator.execute(
        "Navigate to https://example.com",
        "cheap",
        mockBrowser,
      );

      expect(result.status).toBe("failed");
      expect(result.error).toContain("disabled");
    });

    it("should execute navigation in normal profile", async () => {
      const operator = createWebOperator();
      const mockBrowser = createMockBrowser();

      const result = await operator.execute(
        "Navigate to https://example.com",
        "normal",
        mockBrowser,
      );

      expect(result.status).toBe("completed");
      expect(mockBrowser.navigate).toHaveBeenCalled();
    });

    it("should pause for approval on non-allowlisted submit", async () => {
      const operator = createWebOperator();
      const mockBrowser = createMockBrowser({
        snapshotContext: {
          url: "https://random-site.com/form",
          host: "random-site.com",
          path: "/form",
          protocol: "https:",
        },
      });

      const result = await operator.execute(
        "Navigate to https://random-site.com/form and submit",
        "normal",
        mockBrowser,
      );

      expect(result.status).toBe("paused");
      expect(result.pendingApproval).toBeTruthy();
      expect(result.pendingApproval?.actionClass).toBe("SUBMIT_LOW_RISK");
    });
  });

  // ===========================================================================
  // Approval Workflow Tests
  // ===========================================================================

  describe("approval workflow", () => {
    it("should track pending approvals", async () => {
      const operator = createWebOperator();
      const mockBrowser = createMockBrowser({
        snapshotContext: {
          url: "https://random-site.com/form",
          host: "random-site.com",
          path: "/form",
          protocol: "https:",
        },
      });

      await operator.execute(
        "Navigate to https://random-site.com/form and submit",
        "normal",
        mockBrowser,
      );

      const pending = operator.listPendingApprovals();
      expect(pending.length).toBe(1);
    });

    it("should expire approvals after timeout", async () => {
      const operator = createWebOperator({
        policy: {
          autoSubmitEnabled: true,
          autoSubmitDailyCap: 3,
          autoSubmitWorkflowCap: 1,
          requireHttps: true,
          maxFreeTextFields: 2,
          maxFreeTextChars: 500,
          sensitiveKeywords: [],
          logFieldValues: false,
          writeNotionWebOpsLog: false,
        },
        logging: {},
        approvalTimeoutMs: 1, // 1ms timeout for testing
      });
      const mockBrowser = createMockBrowser({
        snapshotContext: {
          url: "https://random-site.com/form",
          host: "random-site.com",
          path: "/form",
          protocol: "https:",
        },
      });

      const result = await operator.execute(
        "Navigate to https://random-site.com/form and submit",
        "normal",
        mockBrowser,
      );

      expect(result.pendingApproval).toBeTruthy();
      const approvalId = result.pendingApproval!.id;

      // Wait for timeout
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should be expired
      const approval = operator.getPendingApproval(approvalId);
      expect(approval).toBeNull();
    });

    it("should reject approval gracefully", async () => {
      const operator = createWebOperator();
      const mockBrowser = createMockBrowser({
        snapshotContext: {
          url: "https://random-site.com/form",
          host: "random-site.com",
          path: "/form",
          protocol: "https:",
        },
      });

      const result = await operator.execute(
        "Navigate to https://random-site.com/form and submit",
        "normal",
        mockBrowser,
      );

      const approvalId = result.pendingApproval!.id;
      const rejected = operator.reject(approvalId);

      expect(rejected).toBe(true);
      expect(operator.listPendingApprovals().length).toBe(0);
    });
  });

  // ===========================================================================
  // Allowlist Management Tests
  // ===========================================================================

  describe("allowlist management", () => {
    it("should list default allowlist", () => {
      const operator = createWebOperator();
      const list = operator.listAllowlist();

      expect(list.length).toBeGreaterThan(0);
      expect(list.some((e) => e.host === "stataipodcast.com")).toBe(true);
    });

    it("should add custom allowlist entry", () => {
      const operator = createWebOperator();
      operator.addAllowlistEntry({
        host: "custom-site.com",
        allowedPagePaths: ["/contact"],
      });

      const list = operator.listAllowlist();
      expect(list.some((e) => e.host === "custom-site.com")).toBe(true);
    });

    it("should remove allowlist entry", () => {
      const operator = createWebOperator();
      operator.addAllowlistEntry({
        host: "temp-site.com",
        allowedPagePaths: ["/"],
      });

      expect(operator.listAllowlist().some((e) => e.host === "temp-site.com")).toBe(true);

      operator.removeAllowlistEntry("temp-site.com");

      expect(operator.listAllowlist().some((e) => e.host === "temp-site.com")).toBe(false);
    });
  });

  // ===========================================================================
  // Auto-Submit Control Tests
  // ===========================================================================

  describe("auto-submit control", () => {
    it("should report auto-submit state", () => {
      const operator = createWebOperator();
      const state = operator.getAutoSubmitState();

      expect(state.enabled).toBe(true);
      expect(state.dailyCap).toBe(3);
      expect(state.dailyCount).toBe(0);
    });

    it("should toggle auto-submit", () => {
      const operator = createWebOperator();

      operator.disableAutoSubmit();
      expect(operator.isAutoSubmitEnabled()).toBe(false);

      operator.enableAutoSubmit();
      expect(operator.isAutoSubmitEnabled()).toBe(true);
    });
  });

  // ===========================================================================
  // Helper Tests
  // ===========================================================================

  describe("helpers", () => {
    it("should generate unique workflow IDs", () => {
      const id1 = generateWorkflowId();
      const id2 = generateWorkflowId();

      expect(id1).not.toBe(id2);
      expect(id1.startsWith("wf-")).toBe(true);
    });

    it("should identify hard approval actions", () => {
      expect(requiresHardApproval("PUBLISH")).toBe(true);
      expect(requiresHardApproval("PAYMENT")).toBe(true);
      expect(requiresHardApproval("SECURITY")).toBe(true);
      expect(requiresHardApproval("DESTRUCTIVE")).toBe(true);
      expect(requiresHardApproval("AUTH")).toBe(true);
      expect(requiresHardApproval("UPLOAD")).toBe(true);

      expect(requiresHardApproval("READ_ONLY")).toBe(false);
      expect(requiresHardApproval("DRAFT")).toBe(false);
      expect(requiresHardApproval("SUBMIT_LOW_RISK")).toBe(false);
    });
  });
});

// =============================================================================
// Test Helpers
// =============================================================================

function createMockBrowser(options?: { snapshotContext?: PageContext }): BrowserInterface {
  const defaultContext: PageContext = {
    url: "https://example.com",
    host: "example.com",
    path: "/",
    protocol: "https:",
  };

  return {
    navigate: vi.fn().mockResolvedValue(undefined),
    click: vi.fn().mockResolvedValue(undefined),
    fill: vi.fn().mockResolvedValue(undefined),
    submit: vi.fn().mockResolvedValue(undefined),
    snapshot: vi.fn().mockResolvedValue(options?.snapshotContext ?? defaultContext),
    wait: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  };
}
