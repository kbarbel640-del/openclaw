export type TriggerKind =
  | "praise"
  | "gratitude"
  | "success"
  | "insult"
  | "dismissive";

export type TriggerMatch = {
  kind: TriggerKind;
  phrase: string;
  confidence: "high" | "low";
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[_*~`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// NOTE: keep these high-signal. We can expand later.
const PRAISE = [
  "well done",
  "good job",
  "nice work",
  "great work",
  "proud of you",
  "im proud of you",
  "based",
  "goated",
  "goat",
  "w",
];

const GRATITUDE = [
  "thank you",
  "thanks",
  "ty",
  "tysm",
  "appreciate it",
  "i appreciate it",
];

const SUCCESS = [
  "that worked",
  "it worked",
  "fixed",
  "shipped",
  "its live",
  "we're back",
  "we are back",
];

const INSULT = [
  "stfu",
  "shut up",
  "useless",
  "idiot",
  "dumb",
  "pathetic",
  "worthless",
];

const DISMISSIVE = [
  "k",
  "ok",
  "whatever",
  "dont care",
  "don't care",
  "idc",
];

function includesPhrase(text: string, phrase: string): boolean {
  // crude but reliable; avoids regex footguns.
  return text.includes(phrase);
}

export function detectTriggers(input: { text: string }): TriggerMatch[] {
  const t = normalize(input.text);
  if (!t) return [];

  // Avoid rewarding commands.
  if (t.startsWith("/")) return [];

  const out: TriggerMatch[] = [];

  for (const p of PRAISE) {
    if (includesPhrase(t, p)) out.push({ kind: "praise", phrase: p, confidence: "high" });
  }
  for (const p of GRATITUDE) {
    if (includesPhrase(t, p)) out.push({ kind: "gratitude", phrase: p, confidence: "high" });
  }
  for (const p of SUCCESS) {
if (includesPhrase(t, p)) out.push({ kind: "success", phrase: p, confidence: "high" });
  }

  // Negatives: keep conservative.
  for (const p of INSULT) {
    if (includesPhrase(t, p)) out.push({ kind: "insult", phrase: p, confidence: "high" });
  }

  // Dismissive is tricky; only treat as low confidence unless it's clearly standalone.
  for (const p of DISMISSIVE) {
    if (includesPhrase(t, p)) {
      const standalone = t === p;
      out.push({ kind: "dismissive", phrase: p, confidence: standalone ? "high" : "low" });
    }
  }

  // De-dupe by kind keeping first occurrence.
  const seen = new Set<string>();
  return out.filter((m) => {
    const key = `${m.kind}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
