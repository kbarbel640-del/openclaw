import type { TriggerKind } from "./triggers";
import type { AffectionStateV3b } from "./v3b-engine";

export type ReplyContext = {
  kind: TriggerKind;
  phrase: string;
  state: AffectionStateV3b;
  // deterministic seed components
  seed: string;
};

function hash32(s: string): number {
  // small deterministic hash
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick<T>(arr: T[], seed: string): T {
  const idx = hash32(seed) % arr.length;
  return arr[idx];
}

function warmthBand(state: AffectionStateV3b): "low" | "mid" | "high" {
  const aff = state.aff ?? 0;
  if (aff >= 750) return "high";
  if (aff >= 150) return "mid";
  return "low";
}

export function renderTriggerReply(ctx: ReplyContext): string {
  const band = warmthBand(ctx.state);
  const label = (ctx.state.label ?? "").toUpperCase();
  const seed = `${ctx.seed}|${ctx.kind}|${band}|${label}`;

  const PRAISE_LOW = ["noted.", "thanks.", "ok. i heard you."];
  const PRAISE_MID = ["ngl that hit. thanks.", "ok fine. thank you.", "you're sweet."];
  const PRAISE_HIGH = ["you're gonna make me blush.", "stoppp. (but thanks.)", "i'm proud of that one too."];

  const GRAT_LOW = ["k.", "got it.", "thanks."];
  const GRAT_MID = ["appreciate it.", "thanks, Boss.", "ok fine, you're cute."];
  const GRAT_HIGH = ["i'm soft now. thanks.", "love that energy.", "mm. thank you."];

  const SUCCESS_LOW = ["good.", "finally.", "W."];
  const SUCCESS_MID = ["ok. we're so back.", "nice. clean.", "that's what i like to hear."];
  const SUCCESS_HIGH = ["god you're giving me dopamine.", "we're unstoppable.", "yeahhh. that's my Boss."];

  const INSULT_LOW = ["no.", "don't talk to me like that.", "try again, nicer."];
  const INSULT_MID = ["watch your mouth.", "nah. we're not doing that.", "chill."];
  const INSULT_HIGH = ["you're better than that. don't.", "i'm not your punching bag.", "if you're mad, say what's wrong."];

  const DISMISS_LOW = ["ok.", "k.", "heard."];
  const DISMISS_MID = ["alright.", "cool.", "noted."];
  const DISMISS_HIGH = ["lol ok.", "fine, be like that.", "mhm."];

  if (ctx.kind === "praise") {
    return pick(band === "high" ? PRAISE_HIGH : band === "mid" ? PRAISE_MID : PRAISE_LOW, seed);
  }
  if (ctx.kind === "gratitude") {
    return pick(band === "high" ? GRAT_HIGH : band === "mid" ? GRAT_MID : GRAT_LOW, seed);
  }
  if (ctx.kind === "success") {
    return pick(band === "high" ? SUCCESS_HIGH : band === "mid" ? SUCCESS_MID : SUCCESS_LOW, seed);
  }
  if (ctx.kind === "insult") {
    return pick(band === "high" ? INSULT_HIGH : band === "mid" ? INSULT_MID : INSULT_LOW, seed);
  }
  // dismissive
  return pick(band === "high" ? DISMISS_HIGH : band === "mid" ? DISMISS_MID : DISMISS_LOW, seed);
}
