# ThinkerCafe 基礎設施審計報告

**日期**: 2026-02-03
**範圍**: ThinkerCafe-tw GitHub Org (63 repos) + Vercel (21 projects)

---

## A. Vercel 專案對照表

| # | Vercel 專案 | 自訂域名 | GitHub Repo | 最近部署 | 狀態 | 建議 |
|---|------------|---------|-------------|---------|------|------|
| 1 | **thinker-official-website** | thinker.cafe, www.thinker.cafe | thinker_official_website | ERROR | ❌ 壞了 | 🔴 修復：這是主站！ |
| 2 | **thinker-cafe** | (vercel subdomain only) | thinker_official_website | ERROR | ❌ 壞了 | 🔴 刪除：與 #1 重複連同一 repo |
| 3 | **cruz-resume** | resume.thinker.cafe | thinker_official_website | READY | ✅ | ⚠️ 連到 monorepo，應改連獨立 repo |
| 4 | **thinker-news** | news.thinker.cafe | (無連結) | READY | ✅ | ✅ 正常 |
| 5 | **paomateng** | (vercel subdomain) | paomateng | READY | ✅ | ✅ 活躍 |
| 6 | **flipflop-travel** | (vercel subdomain) | flipflop-travel | READY | ✅ | ✅ 活躍 |
| 7 | **thislife** | (vercel subdomain) | thislife | READY | ✅ | ✅ |
| 8 | **thislife-wedding** | (vercel subdomain) | thislife | READY | ✅ | ⚠️ 與 #7 連同一 repo，確認是否需要 |
| 9 | **thinker-kit** | (vercel subdomain) | thinker-kit | ERROR | ❌ | ⚠️ 部署失敗，需修復或刪除 |
| 10 | **pt-liff-app** | (vercel subdomain) | pt-liff-app | READY | ✅ | ✅ |
| 11 | **meri-bot** | (vercel subdomain) | maryos | ERROR/READY | ⚠️ | 檢查最新部署 |
| 12 | **fetc** | (vercel subdomain) | fetc | READY | ✅ | ✅ |
| 13 | **thai-speed-tour-liff** | (vercel subdomain) | thai-speed-tour-liff | READY | ✅ | ✅ |
| 14 | **pcb-drilling-erp** | (vercel subdomain) | pcb-drilling-erp | READY | ✅ | ✅ |
| 15 | **salon-liff-app** | (vercel subdomain) | salon-liff-app | READY | ✅ | ✅ |
| 16 | **italian-brainrot** | (vercel subdomain) | italian-brainrot | READY | ✅ | ✅ |
| 17 | **course-assistant** | (vercel subdomain) | course-assistant | READY | ✅ | ✅ |
| 18 | **resume** | (vercel subdomain) | ❌ 無連結 | 無部署 | 🔴 | 🔴 刪除：孤兒專案 |
| 19 | **dashboard** | (vercel subdomain) | ❌ 無連結 | READY | ⚠️ | 🟡 確認用途或刪除 |
| 20 | **cron-test** | (vercel subdomain) | ❌ 無連結 | READY | ⚠️ | 🔴 刪除：測試專案 |
| 21 | **website** | (vercel subdomain) | ❌ 無連結 | READY | ⚠️ | 🔴 刪除：孤兒專案 |

**Vercel 統計**:
- 有自訂域名：3 個 (thinker.cafe, news.thinker.cafe, resume.thinker.cafe)
- 部署失敗：3 個 (thinker-official-website, thinker-cafe, thinker-kit)
- 孤兒專案（無 repo）：5 個 (resume, dashboard, cron-test, thinker-news, website)
- 重複連結同一 repo：3 個連到 thinker_official_website

---

## B. GitHub Repos 狀態

基準日: 2026-02-03

### 🟢 活躍（30 天內有 push）— 8 個

| Repo | 最近 Push | Vercel | 說明 |
|------|----------|--------|------|
| **thinker-news** | 2026-02-03 | ✅ thinker-news | 每日新聞，核心專案 |
| **paomateng** | 2026-02-03 | ✅ paomateng | 跑馬燈 |
| **thinker_official_website** | 2026-02-01 | ✅ thinker-official-website | Monorepo 主站 |
| **24bet** | 2026-01-30 | ❌ | 獨立專案 |
| **flipflop-travel** | 2026-01-22 | ✅ flipflop-travel | |
| **BG** | 2026-01-20 | ❌ | |
| **thislife** | 2026-01-19 | ✅ thislife | |
| **ai-social-6weeks** | 2026-01-14 | ❌ | |

### 🟡 休眠（30-180 天）— 24 個

| Repo | 最近 Push | Vercel | 說明 |
|------|----------|--------|------|
| **iPAS** | 2026-01-07 | ❌ | |
| **thinker-kit** | 2025-12-27 | ✅ (ERROR) | 部署壞了 |
| **maryos** | 2025-12-28 | ✅ meri-bot | |
| **HumanOS** | 2025-12-27 | ❌ | |
| **cruz-resume** | 2025-12-16 | ✅ cruz-resume | |
| **tesla-telegram-bot** | 2024-12-16 | ❌ | |
| **company_scrawler** | 2025-12-15 | ❌ | |
| **pt-liff-app** | 2025-12-14 | ✅ pt-liff-app | |
| **burp** | 2025-12-11 | ❌ | |
| **josh** | 2025-12-08 | ❌ | |
| **memory** | 2025-12-07 | ❌ | |
| **hi-telegram-bot** | 2025-11-28 | ❌ | |
| **fetc** | 2025-11-18 | ✅ fetc | |
| **18-websites-18-weeks** | 2025-11-14 | ❌ | |
| **threads-posts** | 2025-11-14 | ❌ | |
| **linear-regression-learning** | 2025-11-10 | ❌ | |
| **thinker_official_website_backup** | 2025-11-07 | ❌ | monorepo 備份 |
| **thinker-website-production** | 2025-11-07 | ❌ | 生產版本 |
| **vigor-fleet-tesla-charging** | 2025-11-06 | ❌ | |
| **thai-speed-tour-liff** | 2025-11-06 | ✅ | |
| **pcb-drilling-erp** | 2025-11-06 | ✅ | |
| **threads-playwright-publisher** | 2025-11-02 | ❌ | |
| **demo_lawyer** | 2025-10-29 | ❌ | |
| **.github** | 2025-10-26 | ❌ | 組織 profile |

### 🟡 休眠（續）

| Repo | 最近 Push | Vercel |
|------|----------|--------|
| **course-assistant** | 2025-10-24 | ✅ |
| **salon-liff-app** | 2025-10-24 | ✅ |
| **italian-brainrot** | 2025-10-23 | ✅ |
| **thinker-monorepo** | 2025-09-15 | ❌ |
| **ProjectChimera_MemoryPalace** | 2025-09-21 | ❌ |
| **certificate** | 2025-09-13 | ❌ |
| **zero_seven** | 2025-08-26 | ❌ |

### 🔴 死亡（180 天+ 無活動）— 31 個

| Repo | 最近 Push | 說明 |
|------|----------|------|
| **persona_max_ai** | 2025-07-29 | AI persona |
| **minli_demo2_cruz** | 2025-07-29 | 命理 demo |
| **persona_leo_ai** | 2025-07-11 | AI persona |
| **persona_builder_zero** | 2025-07-10 | AI persona |
| **persona_avery_ai** | 2025-07-07 | AI persona |
| **builder-governance** | 2025-07-01 | 治理系統 |
| **persona_cruz_ai** | 2025-06-27 | AI persona |
| **thinker-engine** | 2025-06-25 | |
| **line-mingli-frontend** | 2025-06-18 | |
| **field-rhythm-kit** | 2025-06-17 | |
| **conversation** | 2025-06-17 | |
| **workplace-data-lake** | 2025-06-09 | |
| **mingli_data** | 2025-06-06 | |
| **mingli-backend** | 2025-06-03 | |
| **ziwei-astrology-system** | 2025-04-29 | |
| **thinker-web-2.0** | 2025-03-20 | |
| **thinker-web** | 2025-03-18 | |
| **FileShare** | 2025-03-18 | |
| **mm-calley-automation** | 2025-03-10 | |
| **n8n-fastapi** | 2025-02-27 | |
| **CakeResume-Auto** | 2025-02-14 | |
| **mm-customer-service-automation** | 2025-02-13 | |
| **demo-repository** | 2024-11-27 | GitHub demo |
| **test** | 2024-11-28 | 測試 |
| **TeslaSync** | 2024-11-21 | |
| **Mentor** | 2024-11-05 | |
| **MessageBridge** | 2024-12-03 | |
| **AutoReport** | 2024-08-28 | 最老，1.5年無活動 |

---

## C. 問題清單

### 🔴 嚴重（立即處理）

1. **主站 thinker.cafe 部署失敗** — `thinker-official-website` Vercel 專案最近部署 ERROR，域名 thinker.cafe 可能無法訪問
2. **Monorepo 混亂** — 3 個 Vercel 專案（thinker-cafe, thinker-official-website, cruz-resume）都連到同一個 `thinker_official_website` repo，互相干擾

### 🟡 需關注

3. **thinker-kit 部署失敗** — Vercel 部署 ERROR
4. **daily-news Action 已停用** — workflow 205223969 在 thinker_official_website 已經是 disabled 狀態（無需操作）
5. **5 個孤兒 Vercel 專案** — resume, dashboard, cron-test, thinker-news, website 無連結 repo

### 🔵 清理建議

6. **31 個死亡 repo** — 180 天+ 無活動，建議 archive
7. **6 個 persona_* repo** — AI persona 實驗，全部死亡，建議合併或 archive
8. **命理系統 4 repo** — mingli-backend, line-mingli-frontend, mingli_data, minli_demo2_cruz 全部死亡
9. **thinker_official_website_backup + thinker-website-production** — monorepo 遷移殘留
10. **重複/測試 repo** — test, demo-repository, cron-test

---

## D. 建議行動（優先級排序）

### P0 — 今天做 ⚡

| # | 行動 | 原因 |
|---|------|------|
| 1 | **修復 thinker-official-website 部署** | 主站 thinker.cafe 可能掛了 |
| 2 | **刪除 Vercel 專案 `thinker-cafe`** | 重複專案，跟 thinker-official-website 連同一 repo |

### P1 — 本週做

| # | 行動 | 原因 |
|---|------|------|
| 3 | **cruz-resume 拆離 monorepo** | 讓 resume.thinker.cafe 獨立部署，不受 monorepo 影響 |
| 4 | **刪除孤兒 Vercel 專案** | resume, cron-test, website — 佔配額無用 |
| 5 | **修復或刪除 thinker-kit Vercel** | 部署失敗中 |
| 6 | **確認 dashboard Vercel 專案用途** | 無 repo 連結 |

### P2 — 本月做

| # | 行動 | 原因 |
|---|------|------|
| 7 | **Archive 31 個死亡 repo** | 減少噪音 |
| 8 | **清理 monorepo 殘留** | archive thinker_official_website_backup, thinker-website-production, thinker-monorepo |
| 9 | **合併 persona_* repos** | 6 個 persona repo → 1 個 archive |
| 10 | **合併命理 repos** | 4 個命理 repo → 1 個 archive |

### P3 — 可選

| # | 行動 |
|---|------|
| 11 | 為所有活躍 Vercel 專案設定自訂域名（*.thinker.cafe） |
| 12 | 為活躍 repo 統一 CI/CD（GitHub Actions 模板） |
| 13 | 建立 repo 命名規範 |

---

## E. 數據摘要

| 指標 | 數量 |
|------|------|
| GitHub Repos 總計 | 63 |
| 🟢 活躍 | 8 (12.7%) |
| 🟡 休眠 | 24 (38.1%) |
| 🔴 死亡 | 31 (49.2%) |
| Vercel 專案總計 | 21 |
| 有自訂域名 | 3 |
| 部署失敗 | 3 |
| 孤兒專案 | 5 |
| 重複連結 | 3 個連同一 repo |

> **結論**: 近半數 repo 已死亡，Vercel 有明顯重複和孤兒。最緊急的是修復主站 thinker.cafe 部署，其次是清理 monorepo 造成的混亂。
