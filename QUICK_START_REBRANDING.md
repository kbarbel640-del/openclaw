# 🚀 QUICK START: GenSparx Rebranding

**Current Progress:** 10% ✅  
**Time to Complete:** 8-9 hours  
**Difficulty:** Medium  

---

## TL;DR - What You Need to Know

You've rebranded the **agent identity** but NOT the **package/CLI**. The system still runs as `openclaw` under the hood.

Before publishing, you MUST:
1. Rename the npm package (`openclaw` → `gensparx`)
2. Rename the CLI command (`openclaw` → `gensparx`)
3. Rename the config directory (`~/.openclaw/` → `~/.gensparx/`)
4. Update all environment variables (`OPENCLAW_*` → `GENSPARX_*`)
5. Update app bundle IDs (macOS/iOS/Android)
6. Update documentation (50+ files)

---

## 🔴 CRITICAL FIRST STEPS (Do These First)

### 1. Rename Package
**File:** `package.json`  
**Change Line 2:** `"name": "gensparx"`  
**Change Line 9:** `"gensparx": "gensparx.mjs"`  
**Also:** Rename `openclaw.mjs` → `gensparx.mjs`

### 2. Replace Environment Variables
**Command:**
```bash
grep -r "OPENCLAW_" src/ package.json | head -20
```

**Pattern:** Replace all `OPENCLAW_` with `GENSPARX_`

**Most important:**
- OPENCLAW_GATEWAY_TOKEN → GENSPARX_GATEWAY_TOKEN
- OPENCLAW_SKIP_CHANNELS → GENSPARX_SKIP_CHANNELS

### 3. Update Config Paths
**Files to search:**
- `src/utils.ts`
- `src/config/config-paths.ts`
- `src/agents/agent-paths.ts`

**Pattern:** Replace `~/.openclaw` → `~/.gensparx`

### 4. Update Bundle IDs
**macOS:** `ai.openclaw.mac` → `ai.gensparx.mac`  
**iOS:** `ai.openclaw.ios` → `ai.gensparx.ios`  
**Android:** `ai.openclaw.android` → `ai.gensparx.android`

**After these 4 steps, test:**
```bash
pnpm build  # Should compile
gensparx --version  # Should work
```

---

## 📚 DETAILED GUIDES AVAILABLE

- **PRODUCTION_READINESS_REPORT.md** - Current status & timeline
- **GENSPARX_IMPLEMENTATION_GUIDE.md** - Step-by-step instructions
- **GENSPARX_REBRANDING_CHECKLIST.md** - Complete reference

---

## ⏱️ TIME BREAKDOWN

| Phase | Time | Complexity |
|-------|------|-----------|
| 1. Critical tasks | 2 hours | Easy |
| 2. Extensions & CLI | 2.5 hours | Medium |
| 3. Documentation | 2 hours | Easy |
| 4. Polish | 1 hour | Easy |
| Testing | 1-2 hours | Medium |
| **TOTAL** | **8-9 hours** | |

---

## ✅ AFTER COMPLETION

You'll have:
- ✅ `gensparx` npm package (installable)
- ✅ `gensparx` CLI command (usable)
- ✅ `~/.gensparx/` config directory
- ✅ GenSparx mobile apps
- ✅ Updated documentation
- ✅ Ready to publish to npm

---

**Ready to start?** Open `GENSPARX_IMPLEMENTATION_GUIDE.md` and follow Phase 1!

