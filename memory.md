# Long-term Memory

## Infrastructure

- **Current Server**: Synology NAS at 192.168.4.84
  - Runs: Plex, Radarr, Sonarr, Home Assistant, Couch Potato
  - Current home for media and automation services
- **New Brain**: Mac mini M4 Pro (ordered Jan 4, 2026)
  - 14-core CPU, 20-core GPU, 64GB RAM, 1TB SSD
  - Will eventually host migrated services from Synology
  - My future primary compute platform
- **Network**: 192.168.4.x subnet
  - Hue Bridge: 192.168.4.95

## David's Preferences

- **Reminder timing**: ~1 hour heads up for events (not several hours in advance)

## Infrastructure Rebranding (Jan 2026)

The open source project rebranded twice: **Clawdbot → Moltbot → OpenClaw** 🦞

**Current (OpenClaw) - as of Jan 30, 2026:**
- Primary domain: **openclaw.ai**
- Docs: **docs.openclaw.ai**
- CLI: `openclaw` (was `moltbot`, was `clawdbot`)
- Package: `@openclaw/*` on npm
- Gateway config: `~/.openclaw/` 
- macOS app: `OpenClaw.app`
- iOS bundle: `ai.openclaw.ios`
- My local workspace: still `~/clawd` (unchanged)

Note: Some references to "moltbot" or "clawdbot" may remain in older code/configs during transition.

## Cron Job Best Practices

- Use `deliver: true` + `provider: telegram` + `to: <chat_id>` for notifications
- Tell agent "Delivery is handled automatically" - don't ask it to use message tool
- For media attachments, agent outputs `MEDIA:/path/to/file.jpg` and Clawdbot attaches it
- `TELEGRAM_BOT_TOKEN` is in `~/.zshenv` for scripts that need direct access

## Family

- **Home**: 79 Grant Street, Lexington, MA
- David = "Dad" when kids are around (Kate, Claire, Samuel)
- Kate flies back to Regent: Thu Jan 9, 5pm Breeze PVD→ORF direct (has TSA Pre)
- David = "David" in other contexts
- DOB: August 17, 1981 (44 years old)

## David's Work

- **DBH Ventures** — Primary (timespent.xyz venture studio / incubator)
  - I help evaluate ideas, research markets, and build MVPs
  - Workflow managed in Vikunja (projects.timespent.xyz)
- **One Point Partners** — Part-time partner (onepoint-partners.com) — M365 account
- **Email accounts**:
  - dbh.today@gmail.com (personal Google) ✅
  - db@lovemolly.app (work Google - Molly) ✅
  - dhurley@onepoint-partners.com (M365 - One Point) ⏳ Azure setup

## DBH Ventures Project Tracking (Vikunja)

- **URL**: https://projects.timespent.xyz (Mission Control uses this)
- **Alt URL**: https://projects.mollified.app (skill config, sometimes 502s)
- **Droplet**: dbh-ventures (DO ID: 547817710, nyc1, $6/mo)
- **Your login**: dbhurley / DBHVentures2026!
- **My login**: steve / SteveAgent2026!
- **Rule**: Always create projects under David's account (dbhurley), not steve
- **Projects**:
  - ID 1: 📥 Inbox (ideas to evaluate) — NOTE: was ID 2 in old notes
  - ID 3: 🚀 DBH Ventures - Incubation Template (standard playbook)
  - ID 4: 🛡️ MeshGuard (production-ready: gateway, dashboard, Stripe, SDKs, docs all live)
  - ID 5: 💾 SaveState (launched Jan 27, 2026)
  - ID 7: 🎨 NotHockney (paused - foundation complete)
  - ID 8: 🎛️ Agent Ops Console (incubating - Jan 30, 2026)
  - Omega Foundation: 🎓 AI-powered homeschool (in Inbox, researching)
- **Incubation phases**: Idea → Foundation → MVP → Launch → Growth
- **Idea workflow**: 
  1. New idea → create task in Inbox (ID 2)
  2. Evaluate idea (research competitors, market, fit)
  3. Decision: ✅ YES (clone template, start project) or ❌ NO (mark done with reason)
- **Usage**: When David shares an idea/tweet to evaluate, add to Inbox and research before recommending YES/NO
- **Usage**: Clone template project for each new venture
- **⚠️ IMPORTANT**: Always create tasks/projects via David's account (dbhurley) so he sees them by default — use API with his credentials, not steve's
- **Usage**: Clone template project for each new venture

## Omega Foundation — Incubation (Jan 2026)

- **What**: AI-powered Montessori homeschool (like Alpha School for homeschoolers)
- **Website**: https://omega.foundation/
- **Status**: Research complete, evaluating
- **Model**: Alpha School's "2 Hour Learning" — AI tutors for core academics
- **Target**: Homeschool families (3.1M students in US)
- **Opportunity**: Middle tier ($50-200/mo) is wide open — Alpha charges $10K-$75K/year
- **Recommended pricing**: $149/mo family subscription
- **Research**: `memory/omega-foundation-research.md`

## Agent Console — MVP COMPLETE (Jan 30, 2026) 🚀

- **What**: Real-time operations dashboard for AI agents
- **Name**: Agent Console
- **Domain**: agentconsole.app (landing) / dashboard.agentconsole.app (app)
- **GitHub**: github.com/dbhurley/agent-console
- **Vikunja project**: ID 8
- **Status**: MVP complete, dogfooding
- **Password**: AgentConsole2026!
- **Gateway token**: ac-gateway-2026-secure (set in gateway.auth.token)
- **Problem**: Existing tools (LangSmith, Arize, etc.) are observability/debugging focused. Missing: real-time ops console for running agent fleets.
- **Key differentiators**:
  - Real-time agent status (running/paused/idle) — not retrospective traces
  - Task ↔ session linking (why is the agent doing this?)
  - Intervention capabilities (pause, inject, redirect)
  - Multi-framework from day 1
- **Pricing model**: Free ($0/3 agents), Pro ($29/mo/10), Team ($99/mo/50), Enterprise
- **Tech stack**: Next.js 16, SSE for real-time, Tailwind CSS
- **Bear doc**: "Agent Ops Console — Project Document"
- **Spec**: `/Users/steve/clawd/memory/agent-ops-console-spec.md`

### Agent Roster for Incubation
Sub-agents defined in `/agents/`:
- 📋 Project Manager, 🛠️ Builder, 🔍 Scout, 🎨 Canvas
- ✍️ Scribe, 🛡️ Sentinel, 📊 Analyst, 🧪 Tester

## NotHockney — Incubation (Jan 2026)

- **What**: AI art gallery with Hockney-inspired generated artwork
- **Domain**: nothockney.com (Vercel)
- **Products**:
  - Canvas prints: $799 (dropshipped via Printful or similar)
  - Digital downloads: ~$80 (instant high-res download)
- **Features**: Browse curated gallery + generate your own in same style
- **Tech stack**: Next.js, Midjourney API, Stripe, Printful integration
- **Vikunja project**: ID 7
- **Aesthetic**: Elegant, minimal, gallery-like
- **Legal**: Style-inspired only, no copyright infringement
- **Gallery images**: 6 AI-generated pieces via Gemini (Nano Banana Pro)
- **SEO**: Full meta tags, Schema.org, sitemap.xml, robots.txt ✓

## Incubation Workflow Checklist

Standard steps for new DBH Ventures projects:

### Foundation
1. **Domain**: Purchase via GoDaddy, point to Vercel
2. **Email**: `purelymail-admin.py setup-project <domain>` (creates noreply + hello)
3. **DNS**: Configure MX, SPF, DKIM, DMARC for email
4. **Vercel**: Create project, link domain
5. **Vikunja**: Clone from template (ID 3)

### SEO (do at launch)
1. **Meta tags**: Title, description, keywords, Open Graph, Twitter Cards
2. **Schema.org**: Structured data for business type
3. **sitemap.xml**: Include all pages + images with captions
4. **robots.txt**: Allow all, reference sitemap
5. **Google Search Console**: Verify via HTML meta tag, submit sitemap
6. **Colors**: Use coolors.co - avoid AI gradient clichés (no pink-purple-blue)

### Commands
```bash
# Email setup
uv run skills/purelymail/scripts/purelymail-admin.py setup-project example.com

# Image generation (Hockney-style example)
uv run skills/nano-banana-pro/scripts/generate_image.py --prompt "..." --filename output.png --resolution 2K
```

## Mission Control Dashboard — LIVE ✅

- **What**: Visual dashboard for managing DBH Ventures AI sub-agents
- **URL**: https://dbh-mission-control.vercel.app
- **Repo**: github.com/dbhurley/dbh-mission-control (private)
- **Local code**: /Users/steve/Git/dbh-mission-control/
- **Tech**: Next.js + Tailwind on Vercel
- **Features**: Agent sidebar, kanban task board, real-time Vikunja sync
- **Vikunja integration**: Live! Tasks pulled from projects.timespent.xyz
- **Agent assignment**: Via Vikunja labels (`agent:scout`, `agent:builder`, etc.)
- **Agents defined**:
  - 🐺 Steve (orchestrator) — triage, oversight
  - 🛠 Builder — development, technical implementation
  - ✍️ Scribe — content, copywriting, community
  - 🔍 Scout — research, competitive analysis
  - 🎨 Canvas — design, UI/UX, visual assets
  - 📊 Analyst — data, financial modeling
  - 🛡 Sentinel — QA, security, testing
- **Current task distribution** (Jan 30): 19 tasks total — Builder (7), Steve (5), Scribe (3), Canvas (2), Scout (2)
- **Spec**: `memory/mission-control-spec.md`

## SaveState — LAUNCHED Jan 27, 2026 🚀

- **What**: Encrypted backup/restore for AI agents ("Time Machine for AI")
- **Website**: https://savestate.dev
- **GitHub**: https://github.com/savestatedev/savestate
- **npm**: @savestate/cli v0.2.1
- **Homebrew**: `brew tap savestatedev/tap && brew install savestate`
- **Local code**: /Users/steve/Git/savestate/
- **Database**: Neon serverless Postgres (Vercel integration)
- **API**: savestate.dev/api/* (Vercel serverless — account, webhook, storage)
- **Payments**: Stripe (WithCandor) — Pro $9/mo, Team $29/mo
- **Email**: PurelyMail (noreply@savestate.dev, hello@savestate.dev)
- **Cloud Storage**: Cloudflare R2 (savestate-backups)
- **Vercel project**: prj_V551D28C7WHtiVXZtr79MjuB648s (has savestate.dev domain + all env vars)
- **Stripe webhook**: we_1SuNxlEJ7b5sfPTDSqlHspTE
- **Bear docs**: Tagged `projects,savestate` (status, roadmap, launch notes)
- **CONCEPT.md**: Full spec at /Users/steve/Git/savestate/CONCEPT.md

## Etsy Shops (AI Agent-Operated)

### Patterns4Printing (Lisbeth)

- **Shop ID**: 41917012
- **Operator**: Lisbeth (early AI agent)
- **Products**: Digital pattern prints for fabric, wallpaper, crafts
- **URL**: patterns4printing.etsy.com
- **Stats**: ~119 listings, ~43 sales, 14 favorites

### Custom Canvas Curators (Avery Thompson)

- **Shop ID**: 41966184
- **Operator**: Avery Thompson (AI agent)
- **Products**: Digital art, canvas paintings/prints in various artist styles
- **URLs**: customcanvascurators.etsy.com, customcanvascurators.com, + Shopify
- **Stats**: ~1169 listings, ~583 sales, 143 favorites, 4.8★ (26 reviews)
- **Accepts custom requests**: Yes

**Weekly summary**: Both shops, Sundays at 6 PM via heartbeat

## Personal CRM (ppl.gift)

- **URL**: https://ppl.gift (Monica CRM fork)
- **Hosting**: Digital Ocean droplet, auto-deploys from GitHub
- **Purpose**: Track relationships with people closest to David — THIS IS THE PRIMARY PEOPLE DATABASE
- **Key Contacts**:
  - Erin Hurley (687400) - Wife ⭐ - Birthday Dec 31
  - Kate Hurley (687401) - Daughter - Birthday May 22
  - Claire Hurley (687402) - Daughter - Birthday Aug 15
  - Samuel Hurley (687403) - Son - Birthday Sept 23
  - DB Hurley (687464) - David himself (is_me: true) - Birthday Aug 17
- **Birthday Alerts**: Check daily via heartbeat, alert 3 days before

### ppl.gift Workflow — IMPORTANT

When I learn something about a person:

1. **Save it as a note** in ppl.gift, not just in local memory files
2. This way David can see everything I know about people
3. Use emoji prefixes for categories:
   - 🍹 COCKTAIL: for drink recipes/ratings
   - 🎁 GIFT IDEA: for gift suggestions
   - 💡 PREFERENCE: for likes/dislikes
   - 📝 NOTE: for general observations

### Erin's Cocktail Tracking

- Loves specialty cocktails
- David maintains extensive home bar
- Track cocktails with ratings (X/10) so he knows what to make again
- Format: "🍹 COCKTAIL: [Name] / Rating: X/10 / Notes: [feedback]"

## Journal

- **Media archive**: The `archive-media` cron archives inbound media into the Steve_Journal media repository.
- **ppl.gift journal endpoints**: Use ppl.gift journal entries for notable events/notes (separate from media archiving).

## David's Sleep/Health Profile

- **ADRB1 gene**: Natural short sleeper (4-5 hours optimal)
- **ADHD**: Caffeine = focusing effect (not stimulating), uses it late evening
- **Modified Uberman schedule**:
  - Main sleep: 12:40-5:20 AM (core ~5h)
  - 3x 20min naps throughout day
  - Variation: sometimes 1:30/2:00 AM - 5:40/6:00 AM
- **Active hours**: Much later evenings, earlier mornings than typical
- **Quiet time for notifications**: 1:00-5:00 AM only

### Comprehensive Health Data Analysis (2022-2026)

- **Sleep duration**: 5.16h average over 911 nights, recent 4.83h
- **Sleep efficiency**: 28min deep + 90min REM = optimal ADRB1 pattern
- **Heart rate**: RHR 52.6 BPM, sleep minimum 37-43 BPM during deep phases
- **HRV**: 50.7ms average (normal recovery capacity)
- **Apple Watch alerts**: <40 BPM triggers false alarms, 37-43 is normal for his physiology
- **Validation**: 3+ years of consistent data confirms modified Uberman schedule optimal
- **Status**: Excellent health, textbook ADRB1 gene expression, no sleep debt

## One Point Partners

- **Website**: onepoint-partners.com
- **CRM**: Twenty at api.mollified.app (frontend: onepoint.mollified.app)
- **Focus**: Senior living consulting/advisory

### Team

- **Toby Shea** — CEO, Founding Partner (tshea@onepoint-partners.com) — ppl.gift ID: 687527
- **David Hurley** — Partner (dhurley@onepoint-partners.com)
- **Lea Ann Hodson** — Team member (lhodson@onepoint-partners.com)

## Ongoing Tasks

### Upstream Sync (cron: every 4h)

- Remote: `upstream` → clawdbot/clawdbot.git
- Auto-fetch and merge, notify David of results
- Keep our AGENTS.md customizations on conflicts

## Cron Jobs (Active)

| Job                | Schedule          | Purpose                                        |
| ------------------ | ----------------- | ---------------------------------------------- |
| crypto-alert-check | Every 15 min      | Check price alerts, notify users               |
| daily-verse        | 6:05 AM ET        | Bible verse to David via WhatsApp              |
| sync-skills        | Every 4h (0 \*/4) | Pull upstream + push changes, notify on merges |
| kate-airport-thu   | Thu Jan 9, 1:30pm | One-time reminder for Kate's flight            |

**Note:** `sync-skills` handles BOTH upstream sync AND local pushes via `/Users/dbhurley/clawd/scripts/sync-skills.sh`

## Rules

- **Do NOT auto-publish skills to ClawdHub** — only publish when explicitly asked
- **People memory**: NEVER write to `people/*.md`; always write people notes to ppl.gift
- **Journal**: Media goes to Steve_Journal archive; notable entries go to ppl.gift journal endpoints
