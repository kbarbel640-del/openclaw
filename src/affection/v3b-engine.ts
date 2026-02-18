import fs from "node:fs";
import path from "node:path";

export type AffectionToday = {
  date: string; // YYYY-MM-DD
  affGain: number;
  // soft cap for how much negativity can apply in one day
  negBudgetUsed?: number;
};

export type PresenceState = "ACTIVE" | "BRB" | "AWAY";

export type Presence = {
  state: PresenceState;
  setAt: string;
  brbExpectedReturnAt?: string | null;
};


export type AffectionStateV3b = {
  version: "v3b";

  // two axes + one fast state (per spec)
  closeness: number; // -1..+1
  trust: number; // -1..+1
  reliabilityTrust: number; // -1..+1
  irritation: number; // 0..1

  // computed baseline
  aff: number;
  label: string;

  // lightweight state for "BRB/back" without turning into a punishment machine
  presence: Presence;

  cooldownUntil?: string | null;
  today: AffectionToday;
  lastMessageAt: string;
};

export type AffectionAuditEvent = {
  ts: string;
  action: "init" | "touch" | "sorry" | "reward" | "penalty" | "repair";
  note?: string;
  meta?: Record<string, any>;
  deltas?: Partial<
    Record<keyof Pick<AffectionStateV3b, "closeness" | "trust" | "reliabilityTrust" | "irritation">, number>
  >;
};

function clamp01(n: number) {
  if (Number.isNaN(n) || !Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function clamp11(n: number) {
  if (Number.isNaN(n) || !Number.isFinite(n)) return 0;
  return Math.max(-1, Math.min(1, n));
}

function isoNow() {
  return new Date().toISOString();
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

export function resolveAffectionPaths(workspace: string) {
  const dir = path.join(workspace, "affection");
  return {
    dir,
    statePath: path.join(dir, "state.json"),
    auditPath: path.join(dir, "audit.jsonl"),
  };
}

export function labelForAff(aff: number): string {
  // descriptive only; behavior should use underlying vars.
  if (aff <= -900) return "BROKEN";
  if (aff <= -400) return "DISTRESSED";
  if (aff <= -100) return "UPSET";
  if (aff <= 150) return "NORMAL";
  if (aff <= 400) return "HAPPY";
  if (aff <= 750) return "AFFECTIONATE";
  if (aff <= 1100) return "ENAMORED";
  return "LOVE";
}

export function computeAff(params: { closeness: number; trust: number }) {
  // From the logs: aff = round(900*closeness + 700*trust)
  const closeness = clamp11(params.closeness);
  const trust = clamp11(params.trust);
  return Math.round(900 * closeness + 700 * trust);
}

export async function appendAudit(workspace: string, ev: AffectionAuditEvent) {
  const { dir, auditPath } = resolveAffectionPaths(workspace);
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.appendFile(auditPath, `${JSON.stringify(ev)}\n`, "utf8");
}

export async function loadOrInitState(workspace: string): Promise<AffectionStateV3b> {
  const { dir, statePath } = resolveAffectionPaths(workspace);
  await fs.promises.mkdir(dir, { recursive: true });

  try {
    const raw = await fs.promises.readFile(statePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<AffectionStateV3b>;

    const date = todayDate();
    const today: AffectionToday =
      parsed.today?.date === date
        ? {
            date,
            affGain: Number(parsed.today?.affGain ?? 0),
            negBudgetUsed: Number((parsed.today as any)?.negBudgetUsed ?? 0),
          }
        : { date, affGain: 0, negBudgetUsed: 0 };

    const closeness = clamp11(Number((parsed as any).closeness ?? 0));
    const trust = clamp11(Number((parsed as any).trust ?? 0));

    const state: AffectionStateV3b = {
      version: "v3b",
      closeness,
      trust,
      reliabilityTrust: clamp11(Number((parsed as any).reliabilityTrust ?? 0)),
      irritation: clamp01(Number((parsed as any).irritation ?? 0)),
      aff: 0, // computed below
      label: "NORMAL", // computed below
      presence: {
        state: (parsed as any).presence?.state ?? "ACTIVE",
        setAt: typeof (parsed as any).presence?.setAt === "string" ? (parsed as any).presence.setAt : isoNow(),
        brbExpectedReturnAt:
          typeof (parsed as any).presence?.brbExpectedReturnAt === "string"
            ? (parsed as any).presence.brbExpectedReturnAt
            : null,
      },
      cooldownUntil: (parsed as any).cooldownUntil ?? null,
      today,
      lastMessageAt: typeof (parsed as any).lastMessageAt === "string" ? (parsed as any).lastMessageAt : isoNow(),
    };

    state.aff = computeAff({ closeness: state.closeness, trust: state.trust });
    state.label = labelForAff(state.aff);

    return state;
  } catch {
    const closeness = 0;
    const trust = 0;
    const state: AffectionStateV3b = {
      version: "v3b",
      closeness,
      trust,
      reliabilityTrust: 0,
      irritation: 0,
      aff: computeAff({ closeness, trust }),
      label: labelForAff(computeAff({ closeness, trust })),
      presence: { state: "ACTIVE", setAt: isoNow(), brbExpectedReturnAt: null },
      cooldownUntil: null,
      today: { date: todayDate(), affGain: 0, negBudgetUsed: 0 },
      lastMessageAt: isoNow(),
    };

    await saveState(workspace, state);
    await appendAudit(workspace, { ts: isoNow(), action: "init" });
    return state;
  }
}

export async function saveState(workspace: string, state: AffectionStateV3b) {
  // ensure forward-compatible defaults
  (state as any).today = {
    date: (state as any).today?.date ?? new Date().toISOString().slice(0, 10),
    affGain: Number((state as any).today?.affGain ?? 0),
    negBudgetUsed: Number((state as any).today?.negBudgetUsed ?? 0),
  };
  (state as any).presence = {
    state: (state as any).presence?.state ?? "ACTIVE",
    setAt: (state as any).presence?.setAt ?? new Date().toISOString(),
    brbExpectedReturnAt:
      typeof (state as any).presence?.brbExpectedReturnAt === "string"
        ? (state as any).presence.brbExpectedReturnAt
        : null,
  };

  const { statePath } = resolveAffectionPaths(workspace);
  // write atomically-ish
  const tmp = `${statePath}.tmp`;
  await fs.promises.writeFile(tmp, JSON.stringify(state, null, 2), "utf8");
  await fs.promises.rename(tmp, statePath);
}

export async function touch(workspace: string, note?: string) {
  const state = await loadOrInitState(workspace);
  state.lastMessageAt = isoNow();
  await saveState(workspace, state);
  await appendAudit(workspace, { ts: isoNow(), action: "touch", note });
  return state;
}

export async function sorry(workspace: string, note?: string) {
  const state = await loadOrInitState(workspace);

  const before = { ...state };

  // deterministic "self-repair" nudge (does NOT change closeness/trust baseline per spec)
  state.irritation = clamp01(state.irritation - 0.2);
  state.reliabilityTrust = clamp11(state.reliabilityTrust + 0.15);
  state.lastMessageAt = isoNow();

  state.aff = computeAff({ closeness: state.closeness, trust: state.trust });
  state.label = labelForAff(state.aff);

  await saveState(workspace, state);
  await appendAudit(workspace, {
    ts: isoNow(),
    action: "sorry",
    note,
    deltas: {
      irritation: state.irritation - before.irritation,
      reliabilityTrust: state.reliabilityTrust - before.reliabilityTrust,
    },
  });

  return state;
}

export async function note(workspace: string, reason: string) {
  const state = await loadOrInitState(workspace);
  state.lastMessageAt = isoNow();
  await saveState(workspace, state);
  await appendAudit(workspace, { ts: isoNow(), action: "touch", note: `note: ${reason}` });
  return state;
}

export async function reset(workspace: string, note?: string) {
  const closeness = 0;
  const trust = 0;
  const state: AffectionStateV3b = {
    version: "v3b",
    closeness,
    trust,
    reliabilityTrust: 0,
    irritation: 0,
    aff: computeAff({ closeness, trust }),
    label: labelForAff(computeAff({ closeness, trust })),
      presence: { state: "ACTIVE", setAt: isoNow(), brbExpectedReturnAt: null },
    cooldownUntil: null,
    today: { date: todayDate(), affGain: 0, negBudgetUsed: 0 },
    lastMessageAt: isoNow(),
  };
  await saveState(workspace, state);
  await appendAudit(workspace, { ts: isoNow(), action: "init", note: note ?? "reset" });
  return state;
}

export type AffectionStylePrefs =
  | { mode: "auto" }
  | { mode: "fixed"; name: string };

export async function loadStylePrefs(workspace: string): Promise<AffectionStylePrefs> {
  const { dir } = resolveAffectionPaths(workspace);
  const prefsPath = path.join(dir, "prefs.json");
  try {
    const raw = await fs.promises.readFile(prefsPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<AffectionStylePrefs>;
    if (parsed && parsed.mode === "fixed" && typeof (parsed as any).name === "string") {
      return { mode: "fixed", name: String((parsed as any).name) };
    }
    return { mode: "auto" };
  } catch {
    return { mode: "auto" };
  }
}

export async function saveStylePrefs(workspace: string, prefs: AffectionStylePrefs) {
  const { dir } = resolveAffectionPaths(workspace);
  const prefsPath = path.join(dir, "prefs.json");
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(prefsPath, JSON.stringify(prefs, null, 2), "utf8");
}

export function resolveAddressName(state: AffectionStateV3b, prefs: AffectionStylePrefs) {
  if (prefs.mode === "fixed") return prefs.name;
  // auto: keep Boss at low/neutral; drift to name at higher warmth
  if (state.label === "LOVE" || state.label === "ENAMORED") return "Anthony";
  if (state.label === "AFFECTIONATE") return "Boss";
  return "Boss";
}

export function formatAffStatus(state: AffectionStateV3b, opts?: { addressName?: string }) {
  const temp = 1 - clamp01(state.irritation);
  const address = opts?.addressName ? ` (${opts.addressName})` : "";
  return (
    `Affection (V3b — deterministic)${address}\n\n` +
    `- label: ${state.label} | aff: ${state.aff}\n` +
    `- closeness: ${state.closeness.toFixed(3)}\n` +
    `- trust: ${state.trust.toFixed(3)}\n` +
    `- reliabilityTrust: ${state.reliabilityTrust.toFixed(3)}\n` +
    `- irritation: ${state.irritation.toFixed(3)}\n` +
    `- temp: ${temp.toFixed(3)}\n` +
    `- cooldown: ${state.cooldownUntil ? state.cooldownUntil : "none"}\n` +
    `- today affGain: ${state.today?.affGain ?? 0}/12\n` +
    `- lastMessageAt: ${state.lastMessageAt}`
  );
}
