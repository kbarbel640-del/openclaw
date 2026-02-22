import type { OpenClawConfig } from "../../config/config.js";
import { normalizeStringList } from "../../shared/frontmatter.js";
import type { SkillEntry } from "./types.js";

const TRIGGER_WEIGHT = 3;
const KEYWORD_WEIGHT = 1;
const CONNECTS_TO_WEIGHT = 2;
const DEFAULT_THRESHOLD = 3;

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function tokenizeMessage(message: string): Set<string> {
  return new Set(
    normalizeText(message)
      .split(/[^a-z0-9]+/)
      .map((part) => part.trim())
      .filter(Boolean),
  );
}

function matchPhrase(text: string, phrase: string): boolean {
  const normalizedPhrase = normalizeText(phrase);
  if (!normalizedPhrase) {
    return false;
  }
  return text.includes(normalizedPhrase);
}

function matchKeyword(text: string, tokens: Set<string>, keyword: string): boolean {
  const normalizedKeyword = normalizeText(keyword);
  if (!normalizedKeyword) {
    return false;
  }
  if (normalizedKeyword.includes(" ")) {
    return text.includes(normalizedKeyword);
  }
  return tokens.has(normalizedKeyword);
}

function parseSkillHintList(frontmatter: Record<string, unknown>, keys: string[]): string[] {
  for (const key of keys) {
    const raw = frontmatter[key];
    if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
        try {
          const parsedJson = JSON.parse(trimmed) as unknown;
          const parsedList = normalizeStringList(parsedJson);
          if (parsedList.length > 0) {
            return parsedList;
          }
        } catch {
          // Fall back to comma-separated parsing.
        }
      }
    }

    const parsed = normalizeStringList(raw);
    if (parsed.length > 0) {
      return parsed;
    }
  }
  return [];
}

function resolveThreshold(config?: OpenClawConfig): number {
  return config?.skills?.autoInvoke?.threshold ?? DEFAULT_THRESHOLD;
}

export function resolveAutoInvokedSkillNames(params: {
  message: string;
  entries: SkillEntry[];
  config?: OpenClawConfig;
}): string[] {
  const message = normalizeText(params.message);
  if (!message) {
    return [];
  }
  if (params.config?.skills?.autoInvoke?.enabled === false) {
    return [];
  }

  const threshold = Math.max(1, resolveThreshold(params.config));
  const tokens = tokenizeMessage(message);

  const scored = params.entries
    .map((entry) => {
      const triggers = parseSkillHintList(entry.frontmatter, ["triggers", "trigger"]);
      const keywords = parseSkillHintList(entry.frontmatter, ["keywords", "keyword"]);
      const connectsTo = parseSkillHintList(entry.frontmatter, [
        "connects_to",
        "connects-to",
        "connectsTo",
      ]);

      let score = 0;
      score += triggers.filter((trigger) => matchPhrase(message, trigger)).length * TRIGGER_WEIGHT;
      score +=
        keywords.filter((keyword) => matchKeyword(message, tokens, keyword)).length *
        KEYWORD_WEIGHT;
      score +=
        connectsTo.filter((dependency) => matchKeyword(message, tokens, dependency)).length *
        CONNECTS_TO_WEIGHT;

      return { skillName: entry.skill.name, score };
    })
    .filter((entry) => entry.score >= threshold)
    .sort((a, b) => {
      if (a.score !== b.score) {
        return b.score - a.score;
      }
      return a.skillName.localeCompare(b.skillName);
    });

  return scored.map((entry) => entry.skillName);
}

export function resolveAutoInvokeSkillFilter(params: {
  message: string;
  entries: SkillEntry[];
  baseSkillFilter?: string[];
  config?: OpenClawConfig;
}): string[] | undefined {
  if (params.baseSkillFilter !== undefined) {
    return params.baseSkillFilter;
  }

  const autoSkills = resolveAutoInvokedSkillNames({
    message: params.message,
    entries: params.entries,
    config: params.config,
  });
  return autoSkills.length > 0 ? autoSkills : undefined;
}
