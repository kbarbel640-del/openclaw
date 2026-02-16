---
name: xtremeclaw-agentops
description: Run XtremeClaw AgentOps to scout fresh AI/Meme token candidates on DexScreener with quality filters, risk scoring, confidence tiers, snapshots, backtests, and optional webhook alerts. Use when a user asks for early AI/Meme token discovery, safer watchlist generation, momentum/risk ranking, or periodic scan reporting.
---

# XtremeClaw AgentOps

This skill targets the repository: `https://github.com/XtremeClaw/xtremeclaw-agentops`.

Use this skill only when that repo is available locally.

- If missing, clone it first:

```bash
git clone https://github.com/XtremeClaw/xtremeclaw-agentops.git
cd xtremeclaw-agentops
npm install
```

- “Repository root” means the folder containing `package.json` and `src/index.mjs` for `xtremeclaw-agentops`.

## Core commands

```bash
npm run doctor
npm run scan
npm run report
npm run snapshot
npm run backtest
npm run alert
```

## Practical scan modes

- Strict (safer candidates):

```bash
node src/index.mjs scan --mode strict --chains base,solana --max-picks 10
```

- Balanced (more candidates):

```bash
node src/index.mjs scan --mode balanced --chains base,solana --max-picks 15
```

- Early (aggressive):

```bash
node src/index.mjs scan --mode early --min-liq 3000 --min-vol1h 250 --min-score 35
```

## Output fields to prioritize

- `score` (momentum + activity + liquidity + freshness)
- `riskScore`, `riskReasons`, `safety`
- `confidence`, `composite`, `positionSize`

Treat picks as decision support. Always do manual contract checks before trading.
