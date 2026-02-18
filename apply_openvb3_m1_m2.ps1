$ErrorActionPreference = "Stop"

function Fail($msg) { throw "[apply_openvb3_m1_m2] $msg" }
function Info($msg) { Write-Host "[apply_openvb3_m1_m2] $msg" }

if (!(Test-Path ".git")) { Fail "Run this from the repo root (folder with .git)" }

$needed = @(
  "src/affection/presence.ts",
  "src/affection/triggers.ts",
  "src/affection/rules.ts",
  "src/affection/replies.ts",
  "src/affection/v3b-trigger-engine.ts"
)
foreach ($p in $needed) {
  if (!(Test-Path $p)) { Fail "Missing $p (create the new files first)" }
}
Info "Found new affection files."

# ---------- Patch v3b-engine.ts ----------
$enginePath = "src/affection/v3b-engine.ts"
if (!(Test-Path $enginePath)) { Fail "Missing $enginePath" }

$engine = Get-Content -Raw -Encoding UTF8 $enginePath
if ([string]::IsNullOrWhiteSpace($engine)) { Fail "v3b-engine.ts read as empty" }

# 1) Add negBudgetUsed to AffectionToday
$oldToday = "export type AffectionToday = {`r`n  date: string; // YYYY-MM-DD`r`n  affGain: number;`r`n};"
$newToday = "export type AffectionToday = {`r`n  date: string; // YYYY-MM-DD`r`n  affGain: number;`r`n  // soft cap for how much negativity can apply in one day`r`n  negBudgetUsed?: number;`r`n};"
if ($engine -notlike "*$oldToday*") { Fail "Anchor not found: AffectionToday block" }
$engine = $engine.Replace($oldToday, $newToday)

# 2) Insert Presence types after AffectionToday
$presenceTypes = "export type PresenceState = `"ACTIVE`" | `"BRB`" | `"AWAY`";`r`n`r`nexport type Presence = {`r`n  state: PresenceState;`r`n  setAt: string;`r`n  brbExpectedReturnAt?: string | null;`r`n};`r`n"
$engine = $engine.Replace($newToday + "`r`n`r`n", $newToday + "`r`n`r`n" + $presenceTypes + "`r`n")

# 3) Add presence to AffectionStateV3b
$needle = "  // computed baseline`r`n  aff: number;`r`n  label: string;`r`n`r`n  cooldownUntil?: string | null;"
if ($engine -notlike "*$needle*") { Fail "Anchor not found: computed baseline section in AffectionStateV3b" }
$replacement = "  // computed baseline`r`n  aff: number;`r`n  label: string;`r`n`r`n  // lightweight state for `"BRB/back`" without turning into a punishment machine`r`n  presence: Presence;`r`n`r`n  cooldownUntil?: string | null;"
$engine = $engine.Replace($needle, $replacement)

# 4) Expand audit action union + add meta field
if ($engine -match 'action: "init" \| "touch" \| "sorry"') {
  # already expanded; no-op
} else {
  $engine = $engine.Replace('action: "init" | "touch" | "sorry";', 'action: "init" | "touch" | "sorry" | "reward" | "penalty" | "repair";')
}
if ($engine -notmatch "meta\?:") {
  $engine = $engine.Replace("note?: string;", "note?: string;`r`n  meta?: Record<string, any>;")
}

# 5) Patch loadOrInitState today parsing (exact)
$todayOld = "    const date = todayDate();`r`n    const today: AffectionToday =`r`n      parsed.today?.date === date`r`n        ? { date, affGain: Number(parsed.today?.affGain ?? 0) }`r`n        : { date, affGain: 0 };"
$todayNew = "    const date = todayDate();`r`n    const today: AffectionToday =`r`n      parsed.today?.date === date`r`n        ? {`r`n            date,`r`n            affGain: Number(parsed.today?.affGain ?? 0),`r`n            negBudgetUsed: Number((parsed.today as any)?.negBudgetUsed ?? 0),`r`n          }`r`n        : { date, affGain: 0, negBudgetUsed: 0 };"
if ($engine -notlike "*$todayOld*") { Fail "Anchor not found: loadOrInitState today parsing block" }
$engine = $engine.Replace($todayOld, $todayNew)

# 6) Add presence to parsed state object (insert after label: "NORMAL")
if ($engine -notmatch 'label:\s*"NORMAL"') { Fail "Anchor not found: label: \"NORMAL\" in parsed state object" }
if ($engine -notmatch 'presence:\s*Presence') { Fail "Type-level presence not found; aborting" }
if ($engine -notmatch 'presence:\s*\{') {
  $engine = $engine -replace 'label:\s*"NORMAL",\s*\/\/ computed below', @'
label: "NORMAL", // computed below
      presence: {
        state: (parsed as any).presence?.state ?? "ACTIVE",
        setAt: typeof (parsed as any).presence?.setAt === "string" ? (parsed as any).presence.setAt : isoNow(),
        brbExpectedReturnAt:
          typeof (parsed as any).presence?.brbExpectedReturnAt === "string"
            ? (parsed as any).presence.brbExpectedReturnAt
            : null,
      },
'@
}

# 7) Catch init defaults
$engine = $engine.Replace('today: { date: todayDate(), affGain: 0 },', 'today: { date: todayDate(), affGain: 0, negBudgetUsed: 0 },')
if ($engine -notmatch 'presence:\s*\{\s*state:\s*"ACTIVE"') {
  $engine = $engine -replace 'label:\s*labelForAff\(computeAff\(\{ closeness, trust \}\)\),', @'
label: labelForAff(computeAff({ closeness, trust })),
      presence: { state: "ACTIVE", setAt: isoNow(), brbExpectedReturnAt: null },
'@
}

# 8) saveState normalization
if ($engine -notmatch 'ensure forward-compatible defaults') {
  $saveSig = 'export async function saveState(workspace: string, state: AffectionStateV3b) {'
  if ($engine -notmatch [regex]::Escape($saveSig)) { Fail "saveState signature not found" }
  $norm = @'
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
'@
  $engine = $engine.Replace($saveSig, $norm)
}

# 9) reset today default
$engine = $engine.Replace('today: { date: todayDate(), affGain: 0 },', 'today: { date: todayDate(), affGain: 0, negBudgetUsed: 0 },')

Set-Content -Encoding UTF8 -NoNewline $enginePath $engine
Info "v3b-engine.ts patched."

# ---------- Patch bot-handlers.ts ----------
$botPath = "src/telegram/bot-handlers.ts"
if (!(Test-Path $botPath)) { Fail "Missing $botPath" }
$bot = Get-Content -Raw -Encoding UTF8 $botPath

if ($bot -match "passive affection triggers") {
  Info "bot-handlers.ts already contains trigger hook. Skipping."
} else {
  $anchor = "      if (shouldSkipUpdate(ctx)) {`r`n        return;`r`n      }"
  if ($bot -notlike "*$anchor*") { Fail "Could not find shouldSkipUpdate anchor in bot-handlers.ts" }

  $hook = @'

      // openVB3: passive affection triggers (DM-only, Boss-only for tuning)
      try {
        const isPrivate = msg.chat.type === "private";
        if (isPrivate) {
          const senderId = msg.from?.id != null ? String(msg.from.id) : "";
          const bossId = String(process.env.OPENCLAW_BOSS_TELEGRAM_USER_ID ?? "8068585788");
          if (senderId && senderId === bossId) {
            const text = (msg.text ?? "").trim();
            if (text) {
              const ws =
                cfg?.agents?.defaults?.workspace ??
                process.env.OPENCLAW_WORKSPACE ??
                "/home/node/.openclaw/workspace";

              const { detectPresenceCommand, applyPresenceUpdate } = await import("../affection/presence.js");
              const { detectTriggers } = await import("../affection/triggers.js");
              const { applyAffectionTrigger } = await import("../affection/v3b-trigger-engine.js");
const { loadOrInitState, saveState, appendAudit } = await import("../affection/v3b-engine.js");
              const { renderTriggerReply } = await import("../affection/replies.js");

              // Milestone 2: BRB/back presence (no scoring). If present command hits, we reply once and stop.
              const presenceCmd = detectPresenceCommand({ text });
              if (presenceCmd.kind === "set") {
                const state = await loadOrInitState(ws);
                const before = state.presence?.state;
                state.presence = applyPresenceUpdate(state.presence, presenceCmd);
                await saveState(ws, state);
                await appendAudit(ws, {
                  ts: new Date().toISOString(),
                  action: "touch",
                  note: `presence:${before ?? "?"}→${state.presence.state}`,
                  meta: { sourceId: `telegram:${msg.message_id}` },
                });

                if (state.presence.state === "BRB") {
                  await ctx.reply("ok. i’ll be here when you’re back.");
                } else if (state.presence.state === "ACTIVE") {
                  await ctx.reply("welcome back.");
                } else {
                  await ctx.reply("got it. i’ll keep it low-noise.");
                }
                return;
              }

              const matches = detectTriggers({ text });
              if (matches.length) {
                const match = matches[0];
                await applyAffectionTrigger({
                  workspace: ws,
                  match,
                  sourceId: `telegram:${msg.message_id}`,
                });

                const state = await loadOrInitState(ws);
                const reply = renderTriggerReply({
                  kind: match.kind,
                  phrase: match.phrase,
                  state,
                  seed: `${msg.date}:${msg.message_id}`,
                });

                await ctx.reply(reply);
              }
            }
          }
        }
      } catch {
        // ignore trigger system failures
      }

'@

  $bot = $bot.Replace($anchor, $hook + $anchor)
  Set-Content -Encoding UTF8 -NoNewline $botPath $bot
  Info "bot-handlers.ts patched."
}

# ---------- Post checks ----------
$saveCount = (Select-String -Path $enginePath -Pattern "export async function saveState" | Measure-Object).Count
if ($saveCount -ne 1) { Fail "Expected exactly 1 saveState, found $saveCount" }

Info "All patches applied successfully."

