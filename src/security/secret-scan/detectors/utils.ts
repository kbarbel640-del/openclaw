import { RE2JS } from "re2js";

const FLAG_MAP: Record<string, number> = {
  i: RE2JS.CASE_INSENSITIVE,
  m: RE2JS.MULTILINE,
  s: RE2JS.DOTALL,
};
const IGNORED_FLAGS = new Set(["g"]);

type ExecMatch = {
  text: string;
  index: number;
  groups: Array<string | null>;
};

export function compileRegex(pattern: string, flags = ""): RE2JS {
  let mask = 0;
  for (const flag of flags) {
    if (IGNORED_FLAGS.has(flag)) continue;
    const mapped = FLAG_MAP[flag];
    if (!mapped) {
      throw new Error(`[secret-scan] unsupported regex flag "${flag}" for pattern "${pattern}"`);
    }
    mask |= mapped;
  }
  return RE2JS.compile(pattern, mask);
}

export function execAll(re: RE2JS, text: string, onMatch: (match: ExecMatch) => void): void {
  const matcher = re.matcher(text);
  const groupCount = re.groupCount();
  let cursor = 0;
  while (matcher.find(cursor)) {
    const start = Number(matcher.start());
    const end = Number(matcher.end());
    const groups: Array<string | null> = [];
    for (let i = 0; i <= groupCount; i += 1) {
      groups.push(matcher.group(i));
    }
    const full = groups[0] ?? "";
    onMatch({ text: full, index: start, groups });
    const next = end > start ? end : start + 1;
    cursor = next > cursor ? next : cursor + 1;
    if (cursor > text.length) break;
  }
}
