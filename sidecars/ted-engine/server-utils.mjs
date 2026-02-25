/**
 * server-utils.mjs — Pure, testable utility functions extracted from server.mjs
 * SDD 75, QA-002: These functions have zero side effects and no dependencies on
 * server state (config getters, ledgers, event log). server.mjs imports and
 * delegates to these — zero behavior change.
 */

// ─── Token Estimation ───
export function estimateTokens(text) {
  if (typeof text !== "string") {
    return 0;
  }
  return Math.ceil(text.split(/\s+/).length * 1.3);
}

// ─── Word-Level Edit Distance (BL-001) ───
// Returns 0.0 (identical) to 1.0 (total rewrite)
export function editDistance(a, b) {
  if (typeof a !== "string" || typeof b !== "string") {
    return 1.0;
  }
  const wordsA = a.split(/\s+/).filter(Boolean);
  const wordsB = b.split(/\s+/).filter(Boolean);
  if (wordsA.length === 0 && wordsB.length === 0) {
    return 0.0;
  }
  if (wordsA.length === 0 || wordsB.length === 0) {
    return 1.0;
  }
  const setA = new Set(wordsA);
  const setB = new Set(wordsB);
  let shared = 0;
  for (const w of setA) {
    if (setB.has(w)) {
      shared++;
    }
  }
  const total = new Set([...wordsA, ...wordsB]).size;
  return total === 0 ? 0.0 : Math.round((1 - shared / total) * 100) / 100;
}

// ─── HTML Stripping ───
export function stripHtml(html) {
  if (typeof html !== "string") {
    return "";
  }
  let text = html;
  text = text.replace(/<script[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<head[\s\S]*?<\/head>/gi, "");
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/p>/gi, "\n");
  text = text.replace(/<\/div>/gi, "\n");
  text = text.replace(/<\/li>/gi, "\n");
  text = text.replace(/<[^>]*>/g, "");
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&nbsp;/g, " ");
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&apos;/g, "'");
  text = text.replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(parseInt(code, 10)));
  text = text.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)));
  text = text.replace(/\n{3,}/g, "\n\n");
  return text.trim();
}

// ─── Cron Field Matching ───
export function cronFieldMatches(field, value) {
  if (field === "*") {
    return true;
  }
  const parts = field.split(",");
  for (const part of parts) {
    if (part.includes("/")) {
      const [rangePart, stepStr] = part.split("/");
      const step = parseInt(stepStr, 10);
      if (!Number.isFinite(step) || step <= 0) {
        continue;
      }
      if (rangePart === "*") {
        if (value % step === 0) {
          return true;
        }
      } else if (rangePart.includes("-")) {
        const [lo, hi] = rangePart.split("-").map(Number);
        if (value >= lo && value <= hi && (value - lo) % step === 0) {
          return true;
        }
      }
      continue;
    }
    if (part.includes("-")) {
      const [lo, hi] = part.split("-").map(Number);
      if (value >= lo && value <= hi) {
        return true;
      }
      continue;
    }
    if (parseInt(part, 10) === value) {
      return true;
    }
  }
  return false;
}

// ─── Cron Expression Matching (against a provided date object) ───
// Pure version: accepts { minute, hour, dayOfMonth, month, dayOfWeek } instead of reading system clock
export function cronMatchesDate(cronExpr, dateObj) {
  if (!cronExpr || typeof cronExpr !== "string") {
    return false;
  }
  const parts = cronExpr.trim().split(/\s+/);
  if (parts.length < 5) {
    return false;
  }
  const [cronMinute, cronHour, cronDom, cronMonth, cronDow] = parts;
  if (!cronFieldMatches(cronMinute, dateObj.minute)) {
    return false;
  }
  if (!cronFieldMatches(cronHour, dateObj.hour)) {
    return false;
  }
  if (!cronFieldMatches(cronDom, dateObj.dayOfMonth)) {
    return false;
  }
  if (!cronFieldMatches(cronMonth, dateObj.month)) {
    return false;
  }
  const normalizedDow = cronDow.replace(/\b7\b/g, "0");
  if (!cronFieldMatches(normalizedDow, dateObj.dayOfWeek)) {
    return false;
  }
  return true;
}

// ─── Route Policy Key Normalization ───
const DYNAMIC_ROUTE_PATTERNS = [
  [/^\/deals\/[^/]+$/, "/deals/{deal_id}"],
  [/^\/deals\/[^/]+\/update$/, "/deals/{deal_id}/update"],
  [/^\/deals\/[^/]+\/dates$/, "/deals/{deal_id}/dates"],
  [/^\/deals\/[^/]+\/investors$/, "/deals/{deal_id}/investors"],
  [/^\/deals\/[^/]+\/investors\/update$/, "/deals/{deal_id}/investors/update"],
  [/^\/deals\/[^/]+\/counsel$/, "/deals/{deal_id}/counsel"],
  [/^\/deals\/[^/]+\/counsel\/invoice$/, "/deals/{deal_id}/counsel/invoice"],
  [/^\/deals\/[^/]+\/tasks$/, "/deals/{deal_id}/tasks"],
  [/^\/deals\/[^/]+\/tasks\/update$/, "/deals/{deal_id}/tasks/update"],
  [/^\/deals\/[^/]+\/checklist$/, "/deals/{deal_id}/checklist"],
  [/^\/deals\/[^/]+\/notes$/, "/deals/{deal_id}/notes"],
  [/^\/deals\/[^/]+\/timeline$/, "/deals/{deal_id}/timeline"],
  [/^\/deals\/stale-owners$/, "/deals/stale-owners"],
  [/^\/deals\/[^/]+\/retrospective$/, "/deals/{deal_id}/retrospective"],
  [/^\/triage\/[^/]+\/link$/, "/triage/{item_id}/link"],
  [/^\/filing\/suggestions\/[^/]+\/approve$/, "/filing/suggestions/{suggestion_id}/approve"],
  [/^\/triage\/patterns\/[^/]+\/approve$/, "/triage/patterns/{pattern_id}/approve"],
  [/^\/graph\/[^/]+\/status$/, "/graph/{profile_id}/status"],
  [/^\/graph\/[^/]+\/calendar\/list$/, "/graph/{profile_id}/calendar/list"],
  [/^\/graph\/[^/]+\/auth\/device\/start$/, "/graph/{profile_id}/auth/device/start"],
  [/^\/graph\/[^/]+\/auth\/device\/poll$/, "/graph/{profile_id}/auth/device/poll"],
  [/^\/graph\/[^/]+\/auth\/revoke$/, "/graph/{profile_id}/auth/revoke"],
  [/^\/graph\/[^/]+\/mail\/draft\/create$/, "/graph/{profile_id}/mail/draft/create"],
  [/^\/graph\/[^/]+\/drafts\/generate$/, "/graph/{profile_id}/drafts/generate"],
  [/^\/graph\/[^/]+\/mail\/list$/, "/graph/{profile_id}/mail/list"],
  [/^\/graph\/[^/]+\/mail\/[^/]+\/move$/, "/graph/{profile_id}/mail/{message_id}/move"],
  [/^\/graph\/[^/]+\/calendar\/event\/create$/, "/graph/{profile_id}/calendar/event/create"],
  [/^\/graph\/[^/]+\/planner\/plans$/, "/graph/{profile_id}/planner/plans"],
  [
    /^\/graph\/[^/]+\/planner\/plans\/[^/]+\/buckets$/,
    "/graph/{profile_id}/planner/plans/{plan_id}/buckets",
  ],
  [
    /^\/graph\/[^/]+\/planner\/plans\/[^/]+\/tasks$/,
    "/graph/{profile_id}/planner/plans/{plan_id}/tasks",
  ],
  [/^\/graph\/[^/]+\/todo\/lists$/, "/graph/{profile_id}/todo/lists"],
  [/^\/graph\/[^/]+\/todo\/lists\/[^/]+\/tasks$/, "/graph/{profile_id}/todo/lists/{list_id}/tasks"],
  [
    /^\/graph\/[^/]+\/mail\/[^/]+\/extract-commitments$/,
    "/graph/{profile_id}/mail/{message_id}/extract-commitments",
  ],
  [/^\/graph\/[^/]+\/sync\/reconcile$/, "/graph/{profile_id}/sync/reconcile"],
  [/^\/graph\/[^/]+\/sync\/proposals$/, "/graph/{profile_id}/sync/proposals"],
  [
    /^\/graph\/[^/]+\/sync\/proposals\/[^/]+\/approve$/,
    "/graph/{profile_id}/sync/proposals/{proposal_id}/approve",
  ],
  [
    /^\/graph\/[^/]+\/sync\/proposals\/[^/]+\/reject$/,
    "/graph/{profile_id}/sync/proposals/{proposal_id}/reject",
  ],
  [/^\/improvement\/proposals\/[^/]+\/review$/, "/improvement/proposals/{proposal_id}/review"],
  [/^\/improvement\/proposals\/[^/]+\/apply$/, "/improvement/proposals/{proposal_id}/apply"],
  [/^\/ops\/builder-lane\/revert\/[^/]+$/, "/ops/builder-lane/revert/{proposal_id}"],
  [/^\/ops\/builder-lane\/shadow\/[^/]+$/, "/ops/builder-lane/shadow/{proposal_id}"],
  [/^\/drafts\/[^/]+\/submit-review$/, "/drafts/{draft_id}/submit-review"],
  [/^\/graph\/[^/]+\/sync\/status$/, "/graph/{profile_id}/sync/status"],
  [/^\/commitments\/[^/]+\/complete$/, "/commitments/{commitment_id}/complete"],
  [/^\/commitments\/[^/]+\/escalate$/, "/commitments/{commitment_id}/escalate"],
  [
    /^\/deals\/[^/]+\/investors\/[^/]+\/oig-update$/,
    "/deals/{deal_id}/investors/{investor_name}/oig-update",
  ],
  [/^\/facility\/alert\/[^/]+\/escalate$/, "/facility/alert/{alert_id}/escalate"],
  [/^\/facility\/alert\/[^/]+\/resolve$/, "/facility/alert/{alert_id}/resolve"],
  [/^\/gtd\/actions\/[^/]+\/complete$/, "/gtd/actions/{action_id}/complete"],
  [/^\/meeting\/prep\/[^/]+$/, "/meeting/prep/{event_id}"],
  [/^\/drafts\/[^/]+$/, "/drafts/{draft_id}"],
  [/^\/drafts\/[^/]+\/edit$/, "/drafts/{draft_id}/edit"],
  [/^\/drafts\/[^/]+\/approve$/, "/drafts/{draft_id}/approve"],
  [/^\/drafts\/[^/]+\/archive$/, "/drafts/{draft_id}/archive"],
  [/^\/drafts\/[^/]+\/execute$/, "/drafts/{draft_id}/execute"],
  [/^\/graph\/[^/]+\/sharepoint\/sites$/, "/graph/{profile_id}/sharepoint/sites"],
  [
    /^\/graph\/[^/]+\/sharepoint\/sites\/[^/]+\/drives$/,
    "/graph/{profile_id}/sharepoint/sites/{site_id}/drives",
  ],
  [
    /^\/graph\/[^/]+\/sharepoint\/drives\/[^/]+\/items$/,
    "/graph/{profile_id}/sharepoint/drives/{drive_id}/items",
  ],
  [
    /^\/graph\/[^/]+\/sharepoint\/drives\/[^/]+\/items\/[^/]+$/,
    "/graph/{profile_id}/sharepoint/drives/{drive_id}/items/{item_id}",
  ],
  [
    /^\/graph\/[^/]+\/sharepoint\/drives\/[^/]+\/search$/,
    "/graph/{profile_id}/sharepoint/drives/{drive_id}/search",
  ],
  [
    /^\/graph\/[^/]+\/sharepoint\/drives\/[^/]+\/upload$/,
    "/graph/{profile_id}/sharepoint/drives/{drive_id}/upload",
  ],
  [
    /^\/graph\/[^/]+\/sharepoint\/drives\/[^/]+\/folder$/,
    "/graph/{profile_id}/sharepoint/drives/{drive_id}/folder",
  ],
  [/^\/ops\/self-healing\/status$/, "/ops/self-healing/status"],
  [/^\/ops\/self-healing\/circuit-breakers$/, "/ops/self-healing/circuit-breakers"],
  [/^\/ops\/self-healing\/provider-health$/, "/ops/self-healing/provider-health"],
  [/^\/ops\/self-healing\/config-drift\/reconcile$/, "/ops/self-healing/config-drift/reconcile"],
  [/^\/ops\/self-healing\/compact-ledgers$/, "/ops/self-healing/compact-ledgers"],
  [/^\/ops\/self-healing\/expire-proposals$/, "/ops/self-healing/expire-proposals"],
  [/^\/ops\/self-healing\/correction-taxonomy$/, "/ops/self-healing/correction-taxonomy"],
  [/^\/ops\/self-healing\/engagement-insights$/, "/ops/self-healing/engagement-insights"],
  [/^\/ops\/self-healing\/noise-level$/, "/ops/self-healing/noise-level"],
  [/^\/ops\/self-healing\/autonomy-status$/, "/ops/self-healing/autonomy-status"],
  [/^\/ops\/engagement\/read-receipt$/, "/ops/engagement/read-receipt"],
  [/^\/ops\/engagement\/action-receipt$/, "/ops/engagement/action-receipt"],
  [
    /^\/ops\/builder-lane\/proposals\/[^/]+\/resurrect$/,
    "/ops/builder-lane/proposals/{proposal_id}/resurrect",
  ],
  [/^\/intake\/create$/, "/intake/create"],
  [/^\/ops\/trust\/reset$/, "/ops/trust/reset"],
  [/^\/ops\/tool-usage$/, "/ops/tool-usage"],
  [/^\/ops\/evaluation\/status$/, "/ops/evaluation/status"],
  [/^\/ops\/evaluation\/run$/, "/ops/evaluation/run"],
];

export function normalizeRoutePolicyKey(route) {
  if (typeof route !== "string" || route.length === 0) {
    return "";
  }
  for (const [pattern, key] of DYNAMIC_ROUTE_PATTERNS) {
    if (pattern.test(route)) {
      return key;
    }
  }
  return route;
}

// ─── Context Assembly (Pure Version) ───
// Accepts budgets as parameter instead of reading from module-level CONTEXT_BUDGETS
export function assembleContextPure(callType, sections, budgets) {
  const budget = budgets[callType];
  if (!budget) {
    return { assembled: sections, metadata: { budget_applied: false, call_type: callType } };
  }
  const maxTokens = budget.max_tokens;
  const responseReserve = Math.floor(maxTokens * 0.2);
  const availableTokens = maxTokens - responseReserve;

  let usedTokens = 0;
  const included = [];
  const truncated = [];
  const omitted = [];

  for (const sectionName of budget.priority) {
    const sectionContent = sections[sectionName];
    if (sectionContent === undefined || sectionContent === null || sectionContent === "") {
      continue;
    }
    const text =
      typeof sectionContent === "string" ? sectionContent : JSON.stringify(sectionContent);
    const sectionTokens = estimateTokens(text);
    const remaining = availableTokens - usedTokens;

    if (sectionTokens <= remaining) {
      included.push({ name: sectionName, tokens: sectionTokens, content: text });
      usedTokens += sectionTokens;
    } else if (remaining > 100) {
      const words = text.split(/\s+/);
      const maxWords = Math.floor(remaining / 1.3);
      const truncatedText =
        words.slice(0, maxWords).join(" ") +
        `\n[TRUNCATED — ${words.length - maxWords} words omitted]`;
      included.push({ name: sectionName, tokens: remaining, content: truncatedText });
      truncated.push(sectionName);
      usedTokens += remaining;
    } else {
      omitted.push(sectionName);
    }
  }

  const assembledText = included.map((s) => s.content).join("\n\n");
  return {
    assembled: assembledText,
    metadata: {
      budget_applied: true,
      call_type: callType,
      max_tokens: maxTokens,
      estimated_tokens: usedTokens,
      sections_included: included.map((s) => s.name),
      sections_truncated: truncated,
      sections_omitted: omitted,
    },
  };
}

// ─── Upcaster (Pure Version) ───
// Accepts upcasters Map as parameter instead of reading module-level LEDGER_UPCASTERS
export function upcastRecordPure(record, ledgerName, upcasters) {
  if (!record || typeof record !== "object") {
    return record;
  }
  const chain = upcasters.get(ledgerName);
  if (!chain || chain.length === 0) {
    return record;
  }
  let current = { ...record };
  let version = typeof current._schema_version === "number" ? current._schema_version : 0;
  const CURRENT_SCHEMA_VERSION = 1;
  while (version < CURRENT_SCHEMA_VERSION) {
    const upcaster = chain.find((u) => u.from_version === version);
    if (!upcaster) {
      break;
    }
    current = upcaster.transform(current);
    version = upcaster.to_version;
    current._schema_version = version;
  }
  return current;
}

// ─── PHI Redaction (Pure Version) ───
// Applies regex patterns without consulting config — caller decides whether to redact
export function redactPhiPatterns(messages) {
  return messages.map((msg) => {
    if (typeof msg.content !== "string") {
      return msg;
    }
    let content = msg.content;
    content = content.replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[REDACTED-SSN]");
    content = content.replace(
      /\b(?:DOB|date of birth|born)\s*[:-]?\s*\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/gi,
      "[REDACTED-DOB]",
    );
    content = content.replace(/\b(?:room|rm|bed)\s*#?\s*\d{1,4}[A-Za-z]?\b/gi, "[REDACTED-ROOM]");
    content = content.replace(/\b(?:MRN|medical record)\s*#?\s*\d{4,}\b/gi, "[REDACTED-MRN]");
    content = content.replace(
      /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
      "[REDACTED-PHONE]",
    );
    content = content.replace(
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      "[REDACTED-EMAIL]",
    );
    return { ...msg, content };
  });
}

// ─── QA-011 (SDD 75): Multi-Grader Functions (Pure) ───

/** Schema grader: validates required fields presence in text. Score: 0 or 1. */
export function gradeSchema(text, config) {
  const requiredFields = config.required_fields || [];
  if (requiredFields.length === 0) {
    return { score: 1, details: { required_fields: [], missing: [] } };
  }
  const textLower = text.toLowerCase();
  const missing = requiredFields.filter((f) => !textLower.includes(f.toLowerCase()));
  return {
    score: missing.length === 0 ? 1 : 0,
    details: { required_fields: requiredFields, missing },
  };
}

/** Keyword grader: checks for required/forbidden keywords. Score: 0 or 1. */
export function gradeKeyword(text, config) {
  const textLower = text.toLowerCase();
  const mustContainAll = config.must_contain_all || [];
  const mustContainOneOf = config.must_contain_one_of || [];
  const mustNotContain = config.must_not_contain || [];
  const missingAll = mustContainAll.filter((k) => !textLower.includes(k.toLowerCase()));
  const hasOneOf =
    mustContainOneOf.length === 0 ||
    mustContainOneOf.some((k) => textLower.includes(k.toLowerCase()));
  const forbidden = mustNotContain.filter((k) => textLower.includes(k.toLowerCase()));
  const pass = missingAll.length === 0 && hasOneOf && forbidden.length === 0;
  return {
    score: pass ? 1 : 0,
    details: { missing_all: missingAll, has_one_of: hasOneOf, forbidden_found: forbidden },
  };
}

/** Constraint grader: token count, banned phrases. Score: 0 or 1. */
export function gradeConstraint(text, config) {
  const maxTokens = config.max_tokens || Infinity;
  const bannedPhrases = config.banned_phrases || [];
  const tokens = estimateTokens(text);
  const tokenOk = tokens <= maxTokens;
  const foundBanned = bannedPhrases.filter((p) => text.toLowerCase().includes(p.toLowerCase()));
  const pass = tokenOk && foundBanned.length === 0;
  return {
    score: pass ? 1 : 0,
    details: { tokens, max_tokens: maxTokens, token_ok: tokenOk, banned_found: foundBanned },
  };
}

/** Pattern grader: regex matching. Score: 0 or 1. */
export function gradePattern(text, config) {
  const mustMatch = config.must_match || [];
  const mustNotMatch = config.must_not_match || [];
  const matchFailures = [];
  const notMatchFailures = [];
  for (const pat of mustMatch) {
    try {
      if (!new RegExp(pat).test(text)) {
        matchFailures.push(pat);
      }
    } catch {
      /* skip */
    }
  }
  for (const pat of mustNotMatch) {
    try {
      if (new RegExp(pat).test(text)) {
        notMatchFailures.push(pat);
      }
    } catch {
      /* skip */
    }
  }
  const pass = matchFailures.length === 0 && notMatchFailures.length === 0;
  return {
    score: pass ? 1 : 0,
    details: { match_failures: matchFailures, not_match_failures: notMatchFailures },
  };
}

/**
 * Run composable multi-grader evaluation. Pure version — accepts gradersConfig instead of reading from disk.
 * Returns { composite_score, grader_scores, pass, early_exit }
 */
export function runMultiGraderEvaluationPure(text, intent, gradersConfig) {
  const intentConfig = gradersConfig.intents?.[intent];
  if (!intentConfig) {
    return { composite_score: 1, grader_scores: {}, pass: true, early_exit: null };
  }
  const graderList = intentConfig.graders || [];
  const thresholds = gradersConfig.thresholds || {};
  const criticalIntents = thresholds.critical_intents || [];
  const passScore = criticalIntents.includes(intent)
    ? thresholds.critical_pass_score || 0.85
    : thresholds.default_pass_score || 0.7;
  const graderFunctions = {
    schema: gradeSchema,
    keyword: gradeKeyword,
    constraint: gradeConstraint,
    pattern: gradePattern,
  };
  const hardFailGraders = new Set(["schema", "constraint"]);
  const graderScores = {};
  for (const graderName of graderList) {
    const fn = graderFunctions[graderName];
    if (!fn) {
      graderScores[graderName] = { score: 1, details: { skipped: true } };
      continue;
    }
    const graderConfig = intentConfig[graderName] || {};
    const result = fn(text, graderConfig);
    graderScores[graderName] = result;
    if (hardFailGraders.has(graderName) && result.score === 0) {
      return {
        composite_score: 0,
        grader_scores: graderScores,
        pass: false,
        early_exit: graderName,
      };
    }
  }
  const scores = Object.values(graderScores).map((g) => g.score);
  const composite = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 1;
  return {
    composite_score: composite,
    grader_scores: graderScores,
    pass: composite >= passScore,
    early_exit: null,
  };
}

// ─── Output Contract Validation (Pure Version) ───
// Validates against provided contract data instead of reading config files
export function validateOutputContractPure(intent, llmOutput, contract) {
  const result = { valid: true, missing_sections: [], banned_phrases_found: [] };

  if (typeof llmOutput !== "string" || !llmOutput.trim()) {
    return { valid: false, missing_sections: ["entire_output"], banned_phrases_found: [] };
  }

  const outputLower = llmOutput.toLowerCase();

  // Check forbidden patterns from contract
  const contractForbidden = Array.isArray(contract?.forbidden_patterns)
    ? contract.forbidden_patterns
    : [];
  for (const pattern of contractForbidden) {
    if (typeof pattern === "string" && pattern && outputLower.includes(pattern.toLowerCase())) {
      result.banned_phrases_found.push(pattern);
      result.valid = false;
    }
  }

  // Check required sections from contract
  const contractRequired = Array.isArray(contract?.required_sections)
    ? contract.required_sections
    : [];
  for (const section of contractRequired) {
    const sectionLower = section.toLowerCase().replace(/_/g, " ");
    if (!outputLower.includes(sectionLower) && !outputLower.includes(section.toLowerCase())) {
      if (!result.missing_sections.includes(section)) {
        result.missing_sections.push(`contract:${section}`);
        result.valid = false;
      }
    }
  }

  return result;
}
