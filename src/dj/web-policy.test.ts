/**
 * Tests for Web Policy Engine
 */

import { describe, expect, it } from "vitest";
import {
  type AllowlistEntry,
  type FormFieldInfo,
  type PageContext,
  AllowlistManager,
  applyDenyRules,
  classifyAction,
  containsSensitiveKeywords,
  countFreeTextFields,
  DEFAULT_ALLOWLIST,
  DEFAULT_POLICY_CONFIG,
  DEFAULT_SENSITIVE_KEYWORDS,
  evaluatePolicy,
  findAllowlistEntry,
  HARD_APPROVAL_ACTIONS,
  hostMatchesEntry,
  isCrossDomainSubmit,
  isFileUploadField,
  isFreeTextField,
  isPageAllowlisted,
  isPasswordField,
  isSubmitTargetAllowlisted,
  normalizeHost,
  pathMatchesEntry,
} from "./web-policy.js";

describe("web-policy", () => {
  // ===========================================================================
  // Host Matching Tests
  // ===========================================================================

  describe("normalizeHost", () => {
    it("should lowercase host", () => {
      expect(normalizeHost("EXAMPLE.COM")).toBe("example.com");
    });

    it("should remove trailing dot", () => {
      expect(normalizeHost("example.com.")).toBe("example.com");
    });
  });

  describe("hostMatchesEntry", () => {
    const entry: AllowlistEntry = {
      host: "stataipodcast.com",
      altHosts: ["www.stataipodcast.com"],
      allowedPagePaths: ["/contact"],
    };

    it("should match primary host exactly", () => {
      expect(hostMatchesEntry("stataipodcast.com", entry)).toBe(true);
    });

    it("should match alt host exactly", () => {
      expect(hostMatchesEntry("www.stataipodcast.com", entry)).toBe(true);
    });

    it("should be case-insensitive", () => {
      expect(hostMatchesEntry("STATAIPODCAST.COM", entry)).toBe(true);
      expect(hostMatchesEntry("WWW.StAtAiPoDcAsT.CoM", entry)).toBe(true);
    });

    it("should NOT match spoofed domains", () => {
      // CRITICAL: Spoof protection test
      expect(hostMatchesEntry("stataipodcast.com.evil.com", entry)).toBe(false);
      expect(hostMatchesEntry("evil.stataipodcast.com", entry)).toBe(false);
      expect(hostMatchesEntry("fake-stataipodcast.com", entry)).toBe(false);
      expect(hostMatchesEntry("stataipodcast.com.co", entry)).toBe(false);
      expect(hostMatchesEntry("notstataipodcast.com", entry)).toBe(false);
    });

    it("should NOT match subdomains not in altHosts", () => {
      expect(hostMatchesEntry("api.stataipodcast.com", entry)).toBe(false);
      expect(hostMatchesEntry("admin.stataipodcast.com", entry)).toBe(false);
    });
  });

  // ===========================================================================
  // Path Matching Tests
  // ===========================================================================

  describe("pathMatchesEntry", () => {
    const entryWithPrefixes: AllowlistEntry = {
      host: "example.com",
      allowedPagePaths: ["/contact", "/newsletter"],
      allowedSubmitPaths: ["/api/submit"],
    };

    const entryWithPatterns: AllowlistEntry = {
      host: "docs.google.com",
      pathPatterns: ["^/forms/d/e/[^/]+/viewform$", "^/forms/d/e/[^/]+/formResponse$"],
    };

    it("should match path prefixes", () => {
      expect(pathMatchesEntry("/contact", entryWithPrefixes)).toBe(true);
      expect(pathMatchesEntry("/contact/form", entryWithPrefixes)).toBe(true);
      expect(pathMatchesEntry("/newsletter", entryWithPrefixes)).toBe(true);
    });

    it("should NOT match non-prefixed paths", () => {
      expect(pathMatchesEntry("/about", entryWithPrefixes)).toBe(false);
      expect(pathMatchesEntry("/", entryWithPrefixes)).toBe(false);
    });

    it("should check submit paths separately", () => {
      expect(pathMatchesEntry("/api/submit", entryWithPrefixes, true)).toBe(true);
      expect(pathMatchesEntry("/contact", entryWithPrefixes, true)).toBe(false);
    });

    it("should match regex patterns", () => {
      expect(pathMatchesEntry("/forms/d/e/abc123/viewform", entryWithPatterns)).toBe(true);
      expect(pathMatchesEntry("/forms/d/e/xyz789/formResponse", entryWithPatterns)).toBe(true);
    });

    it("should NOT match invalid patterns", () => {
      expect(pathMatchesEntry("/forms/d/e/abc123/edit", entryWithPatterns)).toBe(false);
      expect(pathMatchesEntry("/docs/something", entryWithPatterns)).toBe(false);
    });
  });

  // ===========================================================================
  // Google Forms Allowlist Tests
  // ===========================================================================

  describe("Google Forms allowlist", () => {
    it("should allow forms.gle for navigation only", () => {
      const entry = findAllowlistEntry("https://forms.gle/abc123");
      expect(entry).not.toBeNull();
      expect(entry?.navigationOnly).toBe(true);
    });

    it("should NOT allow forms.gle as submit target", () => {
      const allowed = isSubmitTargetAllowlisted("https://forms.gle/abc123", "https://example.com");
      expect(allowed).toBe(false);
    });

    it("should allow docs.google.com viewform", () => {
      const allowed = isPageAllowlisted("https://docs.google.com/forms/d/e/abc123/viewform");
      expect(allowed).toBe(true);
    });

    it("should allow docs.google.com formResponse as submit target", () => {
      const allowed = isSubmitTargetAllowlisted(
        "https://docs.google.com/forms/d/e/abc123/formResponse",
        "https://docs.google.com/forms/d/e/abc123/viewform",
      );
      expect(allowed).toBe(true);
    });

    it("should NOT allow arbitrary docs.google.com paths", () => {
      expect(isPageAllowlisted("https://docs.google.com/document/d/abc")).toBe(false);
      expect(isPageAllowlisted("https://docs.google.com/spreadsheets")).toBe(false);
    });
  });

  // ===========================================================================
  // Cross-Domain Submit Tests
  // ===========================================================================

  describe("isCrossDomainSubmit", () => {
    it("should detect cross-domain submissions", () => {
      expect(
        isCrossDomainSubmit("https://api.example.com/submit", "https://www.example.com/form"),
      ).toBe(true);
    });

    it("should not flag same-domain submissions", () => {
      expect(isCrossDomainSubmit("https://example.com/submit", "https://example.com/form")).toBe(
        false,
      );
    });

    it("should handle relative URLs", () => {
      expect(isCrossDomainSubmit("/api/submit", "https://example.com/form")).toBe(false);
    });
  });

  // ===========================================================================
  // Field Detection Tests
  // ===========================================================================

  describe("isPasswordField", () => {
    it("should detect input type=password", () => {
      expect(isPasswordField({ type: "password" })).toBe(true);
    });

    it("should detect password-like field names", () => {
      expect(isPasswordField({ type: "text", name: "user_password" })).toBe(true);
      expect(isPasswordField({ type: "text", id: "passcode-input" })).toBe(true);
      expect(isPasswordField({ type: "text", label: "Enter your passphrase" })).toBe(true);
    });

    it("should NOT flag non-password fields", () => {
      expect(isPasswordField({ type: "text", name: "email" })).toBe(false);
      expect(isPasswordField({ type: "text", name: "name" })).toBe(false);
    });
  });

  describe("isFileUploadField", () => {
    it("should detect file inputs", () => {
      expect(isFileUploadField({ type: "file" })).toBe(true);
    });

    it("should NOT flag other inputs", () => {
      expect(isFileUploadField({ type: "text" })).toBe(false);
      expect(isFileUploadField({ type: "email" })).toBe(false);
    });
  });

  describe("isFreeTextField", () => {
    it("should detect textareas", () => {
      expect(isFreeTextField({ type: "textarea" })).toBe(true);
    });

    it("should detect text fields with large maxLength", () => {
      expect(isFreeTextField({ type: "text", maxLength: 500 })).toBe(true);
    });

    it("should detect text fields with no maxLength", () => {
      expect(isFreeTextField({ type: "text" })).toBe(true);
    });

    it("should NOT flag small text fields", () => {
      expect(isFreeTextField({ type: "text", maxLength: 50 })).toBe(false);
    });
  });

  describe("countFreeTextFields", () => {
    it("should count free-text fields", () => {
      const fields: FormFieldInfo[] = [
        { type: "email", maxLength: 50 }, // Short email field - not free text
        { type: "textarea" },
        { type: "text", maxLength: 500 },
        { type: "text", maxLength: 20 },
      ];
      expect(countFreeTextFields(fields)).toBe(2);
    });
  });

  // ===========================================================================
  // Sensitive Keywords Tests
  // ===========================================================================

  describe("containsSensitiveKeywords", () => {
    it("should detect authentication keywords", () => {
      expect(containsSensitiveKeywords("Enter your password")).toBe("password");
      expect(containsSensitiveKeywords("2FA verification code")).toBe("2fa");
      expect(containsSensitiveKeywords("Please sign-in to continue")).toBe("sign-in");
      expect(containsSensitiveKeywords("Login required")).toBe("login");
    });

    it("should detect payment keywords", () => {
      expect(containsSensitiveKeywords("Proceed to checkout")).toBe("checkout");
      expect(containsSensitiveKeywords("Enter card number")).toBe("card");
      expect(containsSensitiveKeywords("Complete your purchase")).toBe("purchase");
    });

    it("should detect sensitive/PII keywords", () => {
      expect(containsSensitiveKeywords("Patient medical record")).toBe("medical record");
      expect(containsSensitiveKeywords("Enter your SSN")).toBe("ssn");
      expect(containsSensitiveKeywords("Date of birth")).toBe("date of birth");
    });

    it("should return null for safe text", () => {
      expect(containsSensitiveKeywords("Enter your email address")).toBeNull();
      expect(containsSensitiveKeywords("Subscribe to newsletter")).toBeNull();
    });
  });

  // ===========================================================================
  // Deny Rules Tests
  // ===========================================================================

  describe("applyDenyRules", () => {
    const baseContext: PageContext = {
      url: "https://example.com/form",
      host: "example.com",
      path: "/form",
      protocol: "https:",
    };

    it("should deny HTTP when HTTPS required", () => {
      const result = applyDenyRules({
        ...baseContext,
        protocol: "http:",
      });
      expect(result.denied).toBe(true);
      expect(result.rule).toBe("require_https");
    });

    it("should deny password fields", () => {
      const result = applyDenyRules({
        ...baseContext,
        hasPasswordField: true,
      });
      expect(result.denied).toBe(true);
      expect(result.rule).toBe("password_field");
    });

    it("should deny file uploads", () => {
      const result = applyDenyRules({
        ...baseContext,
        hasFileUpload: true,
      });
      expect(result.denied).toBe(true);
      expect(result.rule).toBe("file_upload");
    });

    it("should deny CAPTCHA", () => {
      const result = applyDenyRules({
        ...baseContext,
        hasCaptcha: true,
      });
      expect(result.denied).toBe(true);
      expect(result.rule).toBe("captcha");
    });

    it("should deny sensitive keywords in fields", () => {
      const result = applyDenyRules({
        ...baseContext,
        formFields: [{ type: "text", name: "credit_card_number" }],
      });
      expect(result.denied).toBe(true);
      expect(result.rule).toBe("sensitive_keyword");
    });

    it("should deny too many free-text fields", () => {
      const result = applyDenyRules({
        ...baseContext,
        formFields: [{ type: "textarea" }, { type: "textarea" }, { type: "textarea" }],
      });
      expect(result.denied).toBe(true);
      expect(result.rule).toBe("free_text_limit");
    });

    it("should allow clean forms", () => {
      const result = applyDenyRules({
        ...baseContext,
        formFields: [
          { type: "email", name: "email" },
          { type: "text", name: "name", maxLength: 50 },
        ],
      });
      expect(result.denied).toBe(false);
    });
  });

  // ===========================================================================
  // Action Classification Tests
  // ===========================================================================

  describe("classifyAction", () => {
    const baseContext: PageContext = {
      url: "https://example.com",
      host: "example.com",
      path: "/",
      protocol: "https:",
    };

    it("should classify navigation as READ_ONLY", () => {
      expect(classifyAction("navigate", baseContext)).toBe("READ_ONLY");
    });

    it("should classify fill as READ_ONLY", () => {
      expect(classifyAction("fill", baseContext)).toBe("READ_ONLY");
    });

    it("should classify file upload as UPLOAD", () => {
      expect(classifyAction("submit", { ...baseContext, hasFileUpload: true })).toBe("UPLOAD");
    });

    it("should classify auth pages as AUTH", () => {
      expect(classifyAction("submit", { ...baseContext, hasPasswordField: true })).toBe("AUTH");
      expect(classifyAction("click", { ...baseContext, title: "Sign in" })).toBe("AUTH");
    });

    it("should classify payment as PAYMENT", () => {
      expect(classifyAction("click", { ...baseContext, title: "Checkout" })).toBe("PAYMENT");
    });

    it("should classify publish buttons as PUBLISH", () => {
      expect(classifyAction("click", baseContext, "Publish")).toBe("PUBLISH");
      expect(classifyAction("click", baseContext, "Go Live")).toBe("PUBLISH");
    });

    it("should classify destructive as DESTRUCTIVE", () => {
      expect(classifyAction("click", baseContext, "Delete Account")).toBe("DESTRUCTIVE");
    });

    it("should classify draft buttons as DRAFT", () => {
      expect(classifyAction("click", baseContext, "Save Draft")).toBe("DRAFT");
    });

    it("should classify submit as SUBMIT_LOW_RISK by default", () => {
      expect(classifyAction("submit", baseContext)).toBe("SUBMIT_LOW_RISK");
      expect(classifyAction("click", baseContext, "Subscribe")).toBe("SUBMIT_LOW_RISK");
    });
  });

  // ===========================================================================
  // Policy Evaluation Tests
  // ===========================================================================

  describe("evaluatePolicy", () => {
    const allowlistedContext: PageContext = {
      url: "https://stataipodcast.com/newsletter",
      host: "stataipodcast.com",
      path: "/newsletter",
      protocol: "https:",
    };

    const nonAllowlistedContext: PageContext = {
      url: "https://random-site.com/form",
      host: "random-site.com",
      path: "/form",
      protocol: "https:",
    };

    it("should allow READ_ONLY without approval", () => {
      const decision = evaluatePolicy("navigate", nonAllowlistedContext);
      expect(decision.allowed).toBe(true);
      expect(decision.requiresApproval).toBe(false);
      expect(decision.actionClass).toBe("READ_ONLY");
    });

    it("should allow DRAFT without approval", () => {
      const decision = evaluatePolicy(
        "click",
        allowlistedContext,
        DEFAULT_POLICY_CONFIG,
        DEFAULT_ALLOWLIST,
        "Save Draft",
      );
      expect(decision.allowed).toBe(true);
      expect(decision.requiresApproval).toBe(false);
      expect(decision.actionClass).toBe("DRAFT");
    });

    it("should require approval for PUBLISH", () => {
      const decision = evaluatePolicy(
        "click",
        allowlistedContext,
        DEFAULT_POLICY_CONFIG,
        DEFAULT_ALLOWLIST,
        "Publish",
      );
      expect(decision.allowed).toBe(true);
      expect(decision.requiresApproval).toBe(true);
      expect(decision.actionClass).toBe("PUBLISH");
    });

    it("should require approval for non-allowlisted submit", () => {
      const decision = evaluatePolicy(
        "submit",
        nonAllowlistedContext,
        DEFAULT_POLICY_CONFIG,
        DEFAULT_ALLOWLIST,
        "Submit",
      );
      expect(decision.allowed).toBe(true);
      expect(decision.requiresApproval).toBe(true);
      expect(decision.reason).toContain("not allowlisted");
    });

    it("should allow auto-submit for allowlisted domain", () => {
      const decision = evaluatePolicy(
        "submit",
        allowlistedContext,
        DEFAULT_POLICY_CONFIG,
        DEFAULT_ALLOWLIST,
        "Subscribe",
      );
      expect(decision.allowed).toBe(true);
      expect(decision.requiresApproval).toBe(false);
      expect(decision.actionClass).toBe("SUBMIT_LOW_RISK");
    });

    it("should require approval when deny rule triggers", () => {
      const contextWithCaptcha = {
        ...allowlistedContext,
        hasCaptcha: true,
      };
      const decision = evaluatePolicy(
        "submit",
        contextWithCaptcha,
        DEFAULT_POLICY_CONFIG,
        DEFAULT_ALLOWLIST,
        "Submit",
      );
      expect(decision.requiresApproval).toBe(true);
      expect(decision.denyResult?.rule).toBe("captcha");
    });

    it("should require approval when auto-submit disabled", () => {
      const config = { ...DEFAULT_POLICY_CONFIG, autoSubmitEnabled: false };
      const decision = evaluatePolicy(
        "submit",
        allowlistedContext,
        config,
        DEFAULT_ALLOWLIST,
        "Subscribe",
      );
      expect(decision.requiresApproval).toBe(true);
      expect(decision.reason).toContain("disabled");
    });
  });

  // ===========================================================================
  // Hard Approval Actions Tests
  // ===========================================================================

  describe("HARD_APPROVAL_ACTIONS", () => {
    it("should include all high-risk actions", () => {
      expect(HARD_APPROVAL_ACTIONS).toContain("PUBLISH");
      expect(HARD_APPROVAL_ACTIONS).toContain("PAYMENT");
      expect(HARD_APPROVAL_ACTIONS).toContain("SECURITY");
      expect(HARD_APPROVAL_ACTIONS).toContain("DESTRUCTIVE");
      expect(HARD_APPROVAL_ACTIONS).toContain("AUTH");
      expect(HARD_APPROVAL_ACTIONS).toContain("UPLOAD");
    });

    it("should NOT include low-risk actions", () => {
      expect(HARD_APPROVAL_ACTIONS).not.toContain("READ_ONLY");
      expect(HARD_APPROVAL_ACTIONS).not.toContain("DRAFT");
      expect(HARD_APPROVAL_ACTIONS).not.toContain("SUBMIT_LOW_RISK");
    });
  });

  // ===========================================================================
  // Allowlist Manager Tests
  // ===========================================================================

  describe("AllowlistManager", () => {
    it("should include default allowlist", () => {
      const manager = new AllowlistManager();
      const entries = manager.list();
      expect(entries.length).toBeGreaterThan(0);
      expect(entries.some((e) => e.host === "stataipodcast.com")).toBe(true);
    });

    it("should add custom entries", () => {
      const manager = new AllowlistManager();
      manager.add({
        host: "custom.com",
        allowedPagePaths: ["/submit"],
      });
      expect(manager.isPageAllowlisted("https://custom.com/submit")).toBe(true);
    });

    it("should remove entries", () => {
      const manager = new AllowlistManager([{ host: "temp.com", allowedPagePaths: ["/"] }]);
      expect(manager.isPageAllowlisted("https://temp.com/")).toBe(true);
      manager.remove("temp.com");
      expect(manager.isPageAllowlisted("https://temp.com/")).toBe(false);
    });
  });
});
