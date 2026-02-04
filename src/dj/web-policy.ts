/**
 * Web Policy Engine for DJ Web Operator
 *
 * Provides action classification, allowlist management, and deny rules
 * for safe browser automation.
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Action classification for browser operations.
 * Determines approval requirements and auto-submit eligibility.
 */
export type ActionClass =
  | "READ_ONLY"
  | "DRAFT"
  | "SUBMIT_LOW_RISK"
  | "PUBLISH"
  | "PAYMENT"
  | "SECURITY"
  | "DESTRUCTIVE"
  | "AUTH"
  | "UPLOAD";

/**
 * Actions that ALWAYS require explicit approval, no exceptions.
 */
export const HARD_APPROVAL_ACTIONS: readonly ActionClass[] = [
  "PUBLISH",
  "PAYMENT",
  "SECURITY",
  "DESTRUCTIVE",
  "AUTH",
  "UPLOAD",
] as const;

/**
 * Allowlist entry for a domain.
 */
export interface AllowlistEntry {
  /** Exact hostname (e.g., "stataipodcast.com") */
  host: string;
  /** Alternative hostnames (e.g., "www.stataipodcast.com") */
  altHosts?: string[];
  /** Allowed page path prefixes (e.g., ["/contact", "/newsletter"]) */
  allowedPagePaths?: string[];
  /** Allowed form action target path prefixes/patterns */
  allowedSubmitPaths?: string[];
  /** If true, form action targets must match allowedSubmitPaths */
  submitTargetsMustMatchAllowlist?: boolean;
  /** Navigation-only host (never a submit target) */
  navigationOnly?: boolean;
  /** Regex patterns for paths (alternative to prefix matching) */
  pathPatterns?: string[];
}

/**
 * Deny rule result with reason.
 */
export interface DenyRuleResult {
  denied: boolean;
  reason?: string;
  rule?: string;
}

/**
 * Form field analysis for deny rule checking.
 */
export interface FormFieldInfo {
  type: string;
  name?: string;
  id?: string;
  label?: string;
  placeholder?: string;
  value?: string;
  maxLength?: number;
}

/**
 * Page context for policy decisions.
 */
export interface PageContext {
  url: string;
  host: string;
  path: string;
  protocol: string;
  title?: string;
  pageText?: string;
  formFields?: FormFieldInfo[];
  formAction?: string;
  formMethod?: string;
  hasCaptcha?: boolean;
  hasFileUpload?: boolean;
  hasPasswordField?: boolean;
}

/**
 * Policy decision result.
 */
export interface PolicyDecision {
  allowed: boolean;
  requiresApproval: boolean;
  actionClass: ActionClass;
  denyResult?: DenyRuleResult;
  reason: string;
}

/**
 * Web policy configuration.
 */
export interface WebPolicyConfig {
  autoSubmitEnabled: boolean;
  autoSubmitDailyCap: number;
  autoSubmitWorkflowCap: number;
  requireHttps: boolean;
  maxFreeTextFields: number;
  maxFreeTextChars: number;
  sensitiveKeywords: string[];
  logFieldValues: boolean;
  writeNotionWebOpsLog: boolean;
  customAllowlist?: AllowlistEntry[];
}

// =============================================================================
// Default Configuration
// =============================================================================

/**
 * Sensitive keywords that trigger approval requirement.
 */
export const DEFAULT_SENSITIVE_KEYWORDS: readonly string[] = [
  // Auth/Security
  "password",
  "passcode",
  "otp",
  "2fa",
  "mfa",
  "auth",
  "verify",
  "security",
  "recovery",
  "reset",
  "sign-in",
  "signin",
  "login",
  "log-in",
  // Payment/Commerce
  "checkout",
  "purchase",
  "order",
  "invoice",
  "billing",
  "upgrade",
  "subscription",
  "payment",
  "card",
  "credit",
  "debit",
  "cvv",
  "cvc",
  "expir",
  // PHI/PII
  "mrn",
  "medical record",
  "patient",
  "dob",
  "date of birth",
  "ssn",
  "social security",
  "diagnosis",
  "insurance",
  "chart",
  "hipaa",
  "health",
] as const;

/**
 * Default allowlist (Allowlist C).
 */
export const DEFAULT_ALLOWLIST: readonly AllowlistEntry[] = [
  // stataipodcast.com
  {
    host: "stataipodcast.com",
    altHosts: ["www.stataipodcast.com"],
    allowedPagePaths: ["/contact", "/newsletter", "/subscribe", "/join"],
    allowedSubmitPaths: ["/contact", "/newsletter", "/subscribe", "/join"],
    submitTargetsMustMatchAllowlist: true,
  },
  // Google Forms - navigation via forms.gle
  {
    host: "forms.gle",
    navigationOnly: true,
    pathPatterns: ["^/[^/]+$"],
  },
  // Google Forms - submission via docs.google.com
  {
    host: "docs.google.com",
    pathPatterns: ["^/forms/d/e/[^/]+/viewform$", "^/forms/d/e/[^/]+/formResponse$"],
    allowedSubmitPaths: ["/forms/d/e/"],
    submitTargetsMustMatchAllowlist: true,
  },
] as const;

/**
 * Default policy configuration.
 */
export const DEFAULT_POLICY_CONFIG: WebPolicyConfig = {
  autoSubmitEnabled: true,
  autoSubmitDailyCap: 3,
  autoSubmitWorkflowCap: 1,
  requireHttps: true,
  maxFreeTextFields: 2,
  maxFreeTextChars: 500,
  sensitiveKeywords: [...DEFAULT_SENSITIVE_KEYWORDS],
  logFieldValues: false,
  writeNotionWebOpsLog: true,
};

// =============================================================================
// Allowlist Matching
// =============================================================================

/**
 * Normalize hostname for comparison (lowercase, no trailing dot).
 */
export function normalizeHost(host: string): string {
  return host.toLowerCase().replace(/\.$/, "");
}

/**
 * Check if a host exactly matches an allowlist entry.
 * IMPORTANT: Must be exact match to prevent spoofing (e.g., stataipodcast.com.evil.com).
 */
export function hostMatchesEntry(host: string, entry: AllowlistEntry): boolean {
  const normalizedHost = normalizeHost(host);
  const entryHost = normalizeHost(entry.host);

  if (normalizedHost === entryHost) {
    return true;
  }

  if (entry.altHosts) {
    for (const altHost of entry.altHosts) {
      if (normalizedHost === normalizeHost(altHost)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if a path matches allowed prefixes or patterns.
 */
export function pathMatchesEntry(
  path: string,
  entry: AllowlistEntry,
  checkSubmitPaths: boolean = false,
): boolean {
  const prefixes = checkSubmitPaths ? entry.allowedSubmitPaths : entry.allowedPagePaths;

  // Check prefix matches
  if (prefixes) {
    for (const prefix of prefixes) {
      if (path.startsWith(prefix)) {
        return true;
      }
    }
  }

  // Check regex patterns
  if (entry.pathPatterns) {
    for (const pattern of entry.pathPatterns) {
      const regex = new RegExp(pattern);
      if (regex.test(path)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Find matching allowlist entry for a URL.
 */
export function findAllowlistEntry(
  url: string,
  allowlist: readonly AllowlistEntry[] = DEFAULT_ALLOWLIST,
): AllowlistEntry | null {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return null;
  }

  for (const entry of allowlist) {
    if (hostMatchesEntry(parsedUrl.hostname, entry)) {
      return entry;
    }
  }

  return null;
}

/**
 * Check if a URL is allowlisted for page navigation.
 */
export function isPageAllowlisted(
  url: string,
  allowlist: readonly AllowlistEntry[] = DEFAULT_ALLOWLIST,
): boolean {
  const entry = findAllowlistEntry(url, allowlist);
  if (!entry) {
    return false;
  }

  // If no path restrictions, host match is sufficient
  if (!entry.allowedPagePaths && !entry.pathPatterns) {
    return true;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return false;
  }

  return pathMatchesEntry(parsedUrl.pathname, entry, false);
}

/**
 * Check if a form action target is allowlisted for submission.
 */
export function isSubmitTargetAllowlisted(
  formActionUrl: string,
  pageUrl: string,
  allowlist: readonly AllowlistEntry[] = DEFAULT_ALLOWLIST,
): boolean {
  let parsedAction: URL;
  let parsedPage: URL;

  try {
    parsedPage = new URL(pageUrl);
    // Form action might be relative
    parsedAction = new URL(formActionUrl, pageUrl);
  } catch {
    return false;
  }

  const entry = findAllowlistEntry(parsedAction.href, allowlist);
  if (!entry) {
    return false;
  }

  // Navigation-only hosts cannot be submit targets
  if (entry.navigationOnly) {
    return false;
  }

  // If submit targets must match allowlist, check path
  if (entry.submitTargetsMustMatchAllowlist) {
    return pathMatchesEntry(parsedAction.pathname, entry, true);
  }

  return true;
}

/**
 * Check for cross-domain form submission.
 */
export function isCrossDomainSubmit(formActionUrl: string, pageUrl: string): boolean {
  try {
    const pageHost = new URL(pageUrl).hostname;
    const actionHost = new URL(formActionUrl, pageUrl).hostname;
    return normalizeHost(pageHost) !== normalizeHost(actionHost);
  } catch {
    return true; // Assume cross-domain if parsing fails
  }
}

// =============================================================================
// Deny Rules
// =============================================================================

/**
 * Check if a field appears to be a password field.
 */
export function isPasswordField(field: FormFieldInfo): boolean {
  if (field.type === "password") {
    return true;
  }

  const textToCheck = [field.name, field.id, field.label, field.placeholder]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return /password|passcode|passphrase/.test(textToCheck);
}

/**
 * Check if a field appears to be a file upload.
 */
export function isFileUploadField(field: FormFieldInfo): boolean {
  return field.type === "file";
}

/**
 * Check if a field is a free-text field (textarea or large text input).
 */
export function isFreeTextField(field: FormFieldInfo): boolean {
  if (field.type === "textarea") {
    return true;
  }

  if (field.type === "text" || field.type === "email" || !field.type) {
    // Check if it allows substantial text
    if (field.maxLength && field.maxLength > 100) {
      return true;
    }
    // If no maxLength specified, consider it potentially free-text
    if (!field.maxLength) {
      return true;
    }
  }

  return false;
}

/**
 * Count free-text fields in a form.
 */
export function countFreeTextFields(fields: FormFieldInfo[]): number {
  return fields.filter(isFreeTextField).length;
}

/**
 * Check text for sensitive keywords.
 */
export function containsSensitiveKeywords(
  text: string,
  keywords: readonly string[] = DEFAULT_SENSITIVE_KEYWORDS,
): string | null {
  const lowerText = text.toLowerCase();

  for (const keyword of keywords) {
    if (lowerText.includes(keyword.toLowerCase())) {
      return keyword;
    }
  }

  return null;
}

/**
 * Apply all deny rules to a page context.
 */
export function applyDenyRules(
  context: PageContext,
  config: WebPolicyConfig = DEFAULT_POLICY_CONFIG,
): DenyRuleResult {
  // Rule: HTTPS required
  if (config.requireHttps && context.protocol !== "https:") {
    return {
      denied: true,
      reason: "HTTPS required for auto-submit",
      rule: "require_https",
    };
  }

  // Rule: Password/auth fields
  if (context.hasPasswordField) {
    return {
      denied: true,
      reason: "Form contains password field",
      rule: "password_field",
    };
  }

  if (context.formFields) {
    for (const field of context.formFields) {
      if (isPasswordField(field)) {
        return {
          denied: true,
          reason: "Form contains password-like field",
          rule: "password_field",
        };
      }
    }
  }

  // Rule: File upload
  if (context.hasFileUpload) {
    return {
      denied: true,
      reason: "Form contains file upload",
      rule: "file_upload",
    };
  }

  if (context.formFields) {
    for (const field of context.formFields) {
      if (isFileUploadField(field)) {
        return {
          denied: true,
          reason: "Form contains file upload field",
          rule: "file_upload",
        };
      }
    }
  }

  // Rule: CAPTCHA
  if (context.hasCaptcha) {
    return {
      denied: true,
      reason: "Form contains CAPTCHA",
      rule: "captcha",
    };
  }

  // Rule: Sensitive keywords in fields
  if (context.formFields) {
    for (const field of context.formFields) {
      const fieldText = [field.name, field.id, field.label, field.placeholder]
        .filter(Boolean)
        .join(" ");

      const keyword = containsSensitiveKeywords(fieldText, config.sensitiveKeywords);
      if (keyword) {
        return {
          denied: true,
          reason: `Field contains sensitive keyword: "${keyword}"`,
          rule: "sensitive_keyword",
        };
      }
    }
  }

  // Rule: Sensitive keywords in page text
  if (context.pageText) {
    const keyword = containsSensitiveKeywords(context.pageText, config.sensitiveKeywords);
    if (keyword) {
      return {
        denied: true,
        reason: `Page contains sensitive keyword: "${keyword}"`,
        rule: "sensitive_keyword",
      };
    }
  }

  // Rule: Too many free-text fields
  if (context.formFields) {
    const freeTextCount = countFreeTextFields(context.formFields);
    if (freeTextCount > config.maxFreeTextFields) {
      return {
        denied: true,
        reason: `Too many free-text fields (${freeTextCount} > ${config.maxFreeTextFields})`,
        rule: "free_text_limit",
      };
    }
  }

  return { denied: false };
}

// =============================================================================
// Action Classification
// =============================================================================

/**
 * Payment-related keywords for classification.
 */
const PAYMENT_KEYWORDS = [
  "checkout",
  "purchase",
  "buy",
  "order",
  "payment",
  "pay now",
  "add to cart",
  "billing",
  "credit card",
  "debit card",
];

/**
 * Publish-related keywords for classification.
 */
const PUBLISH_KEYWORDS = [
  "publish",
  "post",
  "submit for review",
  "go live",
  "make public",
  "release",
];

/**
 * Destructive action keywords.
 */
const DESTRUCTIVE_KEYWORDS = [
  "delete",
  "remove",
  "destroy",
  "clear all",
  "reset",
  "unsubscribe",
  "cancel account",
  "close account",
];

/**
 * Auth-related keywords.
 */
const AUTH_KEYWORDS = [
  "login",
  "log in",
  "sign in",
  "signin",
  "authenticate",
  "register",
  "sign up",
  "signup",
  "forgot password",
  "reset password",
];

/**
 * Security-related keywords.
 */
const SECURITY_KEYWORDS = [
  "change password",
  "update password",
  "two-factor",
  "2fa",
  "mfa",
  "security settings",
  "permissions",
  "api key",
  "access token",
];

/**
 * Classify a browser action based on context.
 */
export function classifyAction(
  actionType: "navigate" | "click" | "fill" | "submit",
  context: PageContext,
  buttonText?: string,
): ActionClass {
  // Navigation is always READ_ONLY
  if (actionType === "navigate") {
    return "READ_ONLY";
  }

  // Fill is always READ_ONLY (just entering data, not submitting)
  if (actionType === "fill") {
    return "READ_ONLY";
  }

  const textToAnalyze = [
    buttonText,
    context.title,
    context.pageText?.slice(0, 1000), // Limit for performance
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  // Check for file upload
  if (context.hasFileUpload) {
    return "UPLOAD";
  }

  // Check for auth
  if (context.hasPasswordField || AUTH_KEYWORDS.some((k) => textToAnalyze.includes(k))) {
    return "AUTH";
  }

  // Check for security
  if (SECURITY_KEYWORDS.some((k) => textToAnalyze.includes(k))) {
    return "SECURITY";
  }

  // Check for payment
  if (PAYMENT_KEYWORDS.some((k) => textToAnalyze.includes(k))) {
    return "PAYMENT";
  }

  // Check for destructive
  if (DESTRUCTIVE_KEYWORDS.some((k) => textToAnalyze.includes(k))) {
    return "DESTRUCTIVE";
  }

  // Check for publish
  if (PUBLISH_KEYWORDS.some((k) => textToAnalyze.includes(k))) {
    return "PUBLISH";
  }

  // Submit action classification
  if (actionType === "submit" || actionType === "click") {
    // Check button text for draft indicators
    if (buttonText) {
      const lowerButton = buttonText.toLowerCase();
      if (lowerButton.includes("save draft") || lowerButton.includes("draft")) {
        return "DRAFT";
      }
      if (
        lowerButton.includes("submit") ||
        lowerButton.includes("send") ||
        lowerButton.includes("subscribe") ||
        lowerButton.includes("join") ||
        lowerButton.includes("contact")
      ) {
        return "SUBMIT_LOW_RISK";
      }
    }

    // Default click is READ_ONLY, submit is SUBMIT_LOW_RISK
    return actionType === "submit" ? "SUBMIT_LOW_RISK" : "READ_ONLY";
  }

  return "READ_ONLY";
}

// =============================================================================
// Policy Engine
// =============================================================================

/**
 * Make a policy decision for a browser action.
 */
export function evaluatePolicy(
  actionType: "navigate" | "click" | "fill" | "submit",
  context: PageContext,
  config: WebPolicyConfig = DEFAULT_POLICY_CONFIG,
  allowlist: readonly AllowlistEntry[] = DEFAULT_ALLOWLIST,
  buttonText?: string,
): PolicyDecision {
  // Merge custom allowlist with defaults
  const effectiveAllowlist = config.customAllowlist
    ? [...DEFAULT_ALLOWLIST, ...config.customAllowlist]
    : allowlist;

  // Classify the action
  const actionClass = classifyAction(actionType, context, buttonText);

  // Hard approval actions always require approval
  if (HARD_APPROVAL_ACTIONS.includes(actionClass)) {
    return {
      allowed: true,
      requiresApproval: true,
      actionClass,
      reason: `Action class "${actionClass}" always requires approval`,
    };
  }

  // READ_ONLY and DRAFT actions are always allowed without approval
  if (actionClass === "READ_ONLY") {
    return {
      allowed: true,
      requiresApproval: false,
      actionClass,
      reason: "Read-only action",
    };
  }

  if (actionClass === "DRAFT") {
    return {
      allowed: true,
      requiresApproval: false,
      actionClass,
      reason: "Draft action (does not publish)",
    };
  }

  // For SUBMIT_LOW_RISK, check allowlist and deny rules
  if (actionClass === "SUBMIT_LOW_RISK") {
    // Check if page is allowlisted
    const pageAllowlisted = isPageAllowlisted(context.url, effectiveAllowlist);
    if (!pageAllowlisted) {
      return {
        allowed: true,
        requiresApproval: true,
        actionClass,
        reason: "Page not allowlisted for auto-submit",
      };
    }

    // Check if form action target is allowlisted (for cross-domain or restricted entries)
    if (context.formAction) {
      const isCrossDomain = isCrossDomainSubmit(context.formAction, context.url);
      if (isCrossDomain) {
        const targetAllowlisted = isSubmitTargetAllowlisted(
          context.formAction,
          context.url,
          effectiveAllowlist,
        );
        if (!targetAllowlisted) {
          return {
            allowed: true,
            requiresApproval: true,
            actionClass,
            reason: "Cross-domain form target not allowlisted",
          };
        }
      }
    }

    // Apply deny rules
    const denyResult = applyDenyRules(context, config);
    if (denyResult.denied) {
      return {
        allowed: true,
        requiresApproval: true,
        actionClass,
        denyResult,
        reason: denyResult.reason || "Deny rule triggered",
      };
    }

    // Auto-submit enabled check
    if (!config.autoSubmitEnabled) {
      return {
        allowed: true,
        requiresApproval: true,
        actionClass,
        reason: "Auto-submit disabled",
      };
    }

    // All checks passed - auto-submit allowed
    return {
      allowed: true,
      requiresApproval: false,
      actionClass,
      reason: "Allowlisted, no deny rules triggered",
    };
  }

  // Default: require approval for unknown cases
  return {
    allowed: true,
    requiresApproval: true,
    actionClass,
    reason: "Unknown action type, requiring approval",
  };
}

// =============================================================================
// Allowlist Management
// =============================================================================

/**
 * Managed allowlist state.
 */
export class AllowlistManager {
  private entries: AllowlistEntry[];

  constructor(customEntries: AllowlistEntry[] = []) {
    this.entries = [...DEFAULT_ALLOWLIST, ...customEntries];
  }

  list(): AllowlistEntry[] {
    return [...this.entries];
  }

  add(entry: AllowlistEntry): void {
    // Remove existing entry for same host
    this.entries = this.entries.filter((e) => !hostMatchesEntry(entry.host, e));
    this.entries.push(entry);
  }

  remove(host: string): boolean {
    const initialLength = this.entries.length;
    this.entries = this.entries.filter((e) => !hostMatchesEntry(host, e));
    return this.entries.length < initialLength;
  }

  findEntry(url: string): AllowlistEntry | null {
    return findAllowlistEntry(url, this.entries);
  }

  isPageAllowlisted(url: string): boolean {
    return isPageAllowlisted(url, this.entries);
  }

  isSubmitTargetAllowlisted(formActionUrl: string, pageUrl: string): boolean {
    return isSubmitTargetAllowlisted(formActionUrl, pageUrl, this.entries);
  }
}
