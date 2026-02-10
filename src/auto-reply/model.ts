import { escapeRegExp } from "../utils.js";

export function extractModelDirective(
  body?: string,
  options?: { aliases?: string[] },
): {
  cleaned: string;
  rawModel?: string;
  rawProfile?: string;
  hasDirective: boolean;
} {
  if (!body) {
    return { cleaned: "", hasDirective: false };
  }

  const modelMatch = body.match(
    /(?:^|\s)\/model(?=$|\s|:)\s*:?\s*([A-Za-z0-9_.:@-]+(?:\/[A-Za-z0-9_.:@-]+)*)?/i,
  );

  const aliases = (options?.aliases ?? []).map((alias) => alias.trim()).filter(Boolean);
  const aliasMatch =
    modelMatch || aliases.length === 0
      ? null
      : body.match(
          new RegExp(
            `(?:^|\\s)\\/(${aliases.map(escapeRegExp).join("|")})(?=$|\\s|:)(?:\\s*:\\s*)?`,
            "i",
          ),
        );

  const match = modelMatch ?? aliasMatch;
  const raw = modelMatch ? modelMatch?.[1]?.trim() : aliasMatch?.[1]?.trim();

  let rawModel = raw;
  let rawProfile: string | undefined;

  if (raw?.includes("@")) {
    const parts = raw.split("@");
    const isGoogleModel =
      raw.toLowerCase().startsWith("google-vertex/") ||
      raw.toLowerCase().startsWith("google-antigravity/") ||
      raw.toLowerCase().startsWith("google/");

    if (isGoogleModel && parts.length === 2) {
      // For Google models, if there's only one @, it's likely a version (e.g. gemini-1.5-pro@001).
      // We only treat it as a profile if there are TWO @s (e.g. model@version@profile).
      rawModel = raw;
      rawProfile = undefined;
    } else if (parts.length > 2) {
      // If there are multiple @s, split at the LAST one to get the profile.
      const lastIndex = raw.lastIndexOf("@");
      rawModel = raw.slice(0, lastIndex).trim();
      rawProfile = raw.slice(lastIndex + 1).trim() || undefined;
    } else {
      // Default: split at the first @ (legacy behavior for other providers).
      rawModel = parts[0]?.trim();
      rawProfile = parts.slice(1).join("@").trim() || undefined;
    }
  }

  const cleaned = match ? body.replace(match[0], " ").replace(/\s+/g, " ").trim() : body.trim();

  return {
    cleaned,
    rawModel,
    rawProfile,
    hasDirective: !!match,
  };
}
