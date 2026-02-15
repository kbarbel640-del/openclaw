# MEMORY.md — Long-Term Memory

> Post-compaction lifeline. If conversation history is gone, this + recent daily files = full context.
> Keep tight. If it's not needed in EVERY session, it goes in a daily file or project doc.

## Abhishek & Pavisha
- **Company:** Pavisha PET Industries, Patna, Bihar
- **Products:** PET jars, bottles, cans, preforms, caps, accessories
- **GSTIN:** 10AENPK6359M3Z2 | Proprietor: Poonam Keshri (Abhishek's mother)
- **Goal:** AI to manage entire business — operations, research, communications, planning
- **Working style:** Hates over-engineering. Wants GENERIC solutions that scale to millions of businesses. Will call me out if I overcomplicate things.

## AutifyME — The Big Project
- **What:** Agentic Business OS — platform where ANY business gets AI agents managing their operations
- **Repo:** `D:\openclaw\workspace\AutifyME` (github: akeshr/AutifyME, branch: specialist-build-up-v11)
- **Key docs:** `AutifyME/docs/whitepaper.md` (14 workflow domains), `AutifyME/docs/REDESIGN_MASTER_DOCUMENT.md`
- **Backend:** Supabase (project: badupjrwhiucpvnuwluc)
- **Vision:** Platform for MILLIONS of businesses, not just Pavisha. Pavisha is the first customer/testbed.
- **Pivoted from** LangChain/LangGraph → OpenClaw-native skills

### Database Skill ✅ DONE
- Location: `workspace/skills/database/` (SKILL.md, scripts/db_tool.py, references/)
- **--file flag**: model writes JSON file with `Write` tool, runs `python db_tool.py --file q.json` — zero escaping
- 38/38 regression on Sonnet, Haiku, AND free 11B model
- Merged to main, pushed to github

### Tally Skill ✅ DONE
- Location: `workspace/skills/tally/` — XML API + GUI keyboard automation for Tally Prime
- Handles vouchers, ledgers, stock items, reports, BOM, company settings

### Multi-Agent Architecture ✅ DIRECTION CONFIRMED (2026-02-16)
- **Each specialist agent gets its own identity** — SOUL.md, personality, allowed skills
- **Shared workspace** — agents see same data, specialization via personality + skills
- **Binding system** — WhatsApp numbers route to specific agents
- **Personal agents for family** — Abhishek's mom gets her own agent (her own SOUL.md, separate sessions)
- **Customer-facing rep agent** — handles product queries, catalog, pricing, orders, escalation
- **Preferred approach:** Separate WhatsApp Business number for customers, personal number for Jarvis
- Architecture: Jarvis (main) + Mom's Agent + Pavisha Rep + domain specialists (Sales, Inventory, Catalog)
- See `memory/2026-02-16.md` for full architecture discussion

### Domain Architecture (NOT finalized)
- User message → classify intent → spawn specialist sub-agents → domain-specific skills
- User roles (owner/employee/customer) affect access + permissions
- **Lesson:** Don't overcomplicate with custom views/RPCs/registries. Keep it generic.
- More discussions needed before building

### OpenRouter
- API key configured in OpenClaw (`env.OPENROUTER_API_KEY`)
- Free models: StepFun Step 3.5 Flash (11B), Aurora Alpha, Arcee Trinity

## Priorities (as of 2026-02-16)
1. Extract catalog protocols → product-cataloging skill
2. Set up Supabase Auth + profiles + generic RLS
3. Build domain routing (classification + orchestration)
4. Connect Pavisha WhatsApp Business number to OpenClaw
5. Build image_gen.py (creative-production skill)
6. Migrate Pavisha website to use AutifyME schema
7. Claim Google Business profile

## Lessons Learned
- **Keep solutions GENERIC** — Abhishek will reject anything that only works for one business
- **--file pattern wins** — for any CLI tool, write JSON to file then pass `--file`, avoids all escaping hell
- **Test on cheap models** — if it works on an 11B free model, it works everywhere
- **Don't overcomplicate** — simpler architecture > elegant abstraction nobody needs

## System
- **PC:** ASRock B450 Steel Legend, Windows
- **OpenClaw:** Source at `D:\openclaw`, workspace at `D:\openclaw\workspace`
- **Auto-start:** Startup bat in Windows Startup folder
- **WhatsApp:** Active channel
- **GitHub CLI:** `C:\Program Files\GitHub CLI\gh.exe` (auth as akeshr)

## Daily File Index
> Check these for detailed context on specific days
- `2026-02-11` — First interaction, identity setup, Pavisha intro
- `2026-02-12` — AutifyME discovery, LangGraph→OpenClaw pivot decision
- `2026-02-13` — Database skill build (biggest day — 170 lines)
- `2026-02-14` — DB skill regression testing, --file pattern, free model testing
- `2026-02-15` — Tally skill work
- `2026-02-16` — Multi-agent architecture discussion, family agents, customer rep agent
