---
summary: "npm + macOS 應用程式的逐步發佈檢查清單"
read_when:
  - 發佈新的 npm 版本時
  - 發佈新的 macOS 應用程式版本時
  - 發佈前驗證中繼資料時
x-i18n:
  source_path: reference/RELEASING.md
  source_hash: 54cb2b822bfa3c0b
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:54:44Z
---

# 發佈檢查清單（npm + macOS）

從 repo 根目錄使用 `pnpm`（Node 22+）。在標記／發佈前，請保持工作樹乾淨。

## 操作人員觸發

當操作人員說「release」時，請立即執行以下預檢（除非受阻，否則不要額外提問）：

- 閱讀本文件與 `docs/platforms/mac/release.md`。
- 從 `~/.profile` 載入環境變數，並確認已設定 `SPARKLE_PRIVATE_KEY_FILE` 與 App Store Connect 相關變數（SPARKLE_PRIVATE_KEY_FILE 應位於 `~/.profile`）。
- 如有需要，使用來自 `~/Library/CloudStorage/Dropbox/Backup/Sparkle` 的 Sparkle 金鑰。

1. **版本與中繼資料**

- [ ] 提升 `package.json` 版本（例如：`2026.1.29`）。
- [ ] 執行 `pnpm plugins:sync` 以對齊擴充套件套件版本與變更紀錄。
- [ ] 更新 CLI／版本字串：[`src/cli/program.ts`](https://github.com/openclaw/openclaw/blob/main/src/cli/program.ts) 與 [`src/provider-web.ts`](https://github.com/openclaw/openclaw/blob/main/src/provider-web.ts) 中的 Baileys 使用者代理。
- [ ] 確認套件中繼資料（名稱、描述、儲存庫、關鍵字、授權）以及 `bin` 對 `openclaw` 的對應指向 [`openclaw.mjs`](https://github.com/openclaw/openclaw/blob/main/openclaw.mjs)。
- [ ] 若相依性有變更，請執行 `pnpm install`，確保 `pnpm-lock.yaml` 為最新。

2. **建置與產物**

- [ ] 若 A2UI 輸入有變更，請執行 `pnpm canvas:a2ui:bundle`，並提交任何更新的 [`src/canvas-host/a2ui/a2ui.bundle.js`](https://github.com/openclaw/openclaw/blob/main/src/canvas-host/a2ui/a2ui.bundle.js)。
- [ ] `pnpm run build`（會重新產生 `dist/`）。
- [ ] 驗證 npm 套件 `files` 是否包含所有必要的 `dist/*` 資料夾（特別是用於 headless node + ACP CLI 的 `dist/node-host/**` 與 `dist/acp/**`）。
- [ ] 確認 `dist/build-info.json` 存在，且包含預期的 `commit` 雜湊（CLI 橫幅在 npm 安裝時會使用）。
- [ ] 選用：建置後執行 `npm pack --pack-destination /tmp`；檢視 tarball 內容，並保留以供 GitHub 發佈使用（**不要**提交）。

3. **變更紀錄與文件**

- [ ] 更新 `CHANGELOG.md`，加入以使用者為導向的重點（若缺少請建立檔案）；條目請嚴格依版本由新到舊排序。
- [ ] 確保 README 範例／旗標與目前的 CLI 行為一致（特別是新指令或選項）。

4. **驗證**

- [ ] `pnpm build`
- [ ] `pnpm check`
- [ ] `pnpm test`（或需要覆蓋率輸出時使用 `pnpm test:coverage`）
- [ ] `pnpm release:check`（驗證 npm pack 內容）
- [ ] `OPENCLAW_INSTALL_SMOKE_SKIP_NONROOT=1 pnpm test:install:smoke`（Docker 安裝冒煙測試，快速路徑；發佈前必須）
  - 若已知上一個 npm 發佈版本有問題，請在 preinstall 步驟設定 `OPENCLAW_INSTALL_SMOKE_PREVIOUS=<last-good-version>` 或 `OPENCLAW_INSTALL_SMOKE_SKIP_PREVIOUS=1`。
- [ ]（選用）完整安裝器冒煙測試（加入非 root + CLI 覆蓋）：`pnpm test:install:smoke`
- [ ]（選用）安裝器 E2E（Docker，執行 `curl -fsSL https://openclaw.ai/install.sh | bash`、完成入門引導，然後執行真實工具呼叫）：
  - `pnpm test:install:e2e:openai`（需要 `OPENAI_API_KEY`）
  - `pnpm test:install:e2e:anthropic`（需要 `ANTHROPIC_API_KEY`）
  - `pnpm test:install:e2e`（需要兩把金鑰；會同時執行兩個提供者）
- [ ]（選用）若變更影響傳送／接收路徑，請抽查 Web Gateway 閘道器。

5. **macOS 應用程式（Sparkle）**

- [ ] 建置並簽署 macOS 應用程式，然後壓縮成發佈用 zip。
- [ ] 產生 Sparkle appcast（HTML 備註透過 [`scripts/make_appcast.sh`](https://github.com/openclaw/openclaw/blob/main/scripts/make_appcast.sh)）並更新 `appcast.xml`。
- [ ] 準備好要附加到 GitHub 發佈的 app zip（以及選用的 dSYM zip）。
- [ ] 依照 [macOS release](/platforms/mac/release) 取得確切指令與所需環境變數。
  - `APP_BUILD` 必須是數字且單調遞增（不可有 `-beta`），以便 Sparkle 正確比較版本。
  - 若需公證，請使用由 App Store Connect API 環境變數建立的 `openclaw-notary` 金鑰圈設定檔（見 [macOS release](/platforms/mac/release)）。

6. **發佈（npm）**

- [ ] 確認 git 狀態乾淨；必要時提交並推送。
- [ ] 如有需要，執行 `npm login`（驗證 2FA）。
- [ ] `npm publish --access public`（預先發佈版本請使用 `--tag beta`）。
- [ ] 驗證註冊表：`npm view openclaw version`、`npm view openclaw dist-tags`，以及 `npx -y openclaw@X.Y.Z --version`（或 `--help`）。

### 疑難排解（來自 2.0.0-beta2 發佈的筆記）

- **npm pack／publish 卡住或產生巨大的 tarball**：位於 `dist/OpenClaw.app` 的 macOS 應用程式 bundle（以及發佈 zip）被一併打包。請透過 `package.json` `files` 白名單化發佈內容（包含 dist 子目錄、文件、skills；排除 app bundles）。使用 `npm pack --dry-run` 確認 `dist/OpenClaw.app` 未被列出。
- **npm auth 在 dist-tags 進入網頁循環**：使用舊版驗證以取得 OTP 提示：
  - `NPM_CONFIG_AUTH_TYPE=legacy npm dist-tag add openclaw@X.Y.Z latest`
- **`npx` 驗證以 `ECOMPROMISED: Lock compromised` 失敗**：使用全新快取重試：
  - `NPM_CONFIG_CACHE=/tmp/npm-cache-$(date +%s) npx -y openclaw@X.Y.Z --version`
- **晚修補後需要重新指向標籤**：強制更新並推送標籤，然後確保 GitHub 發佈資產仍相符：
  - `git tag -f vX.Y.Z && git push -f origin vX.Y.Z`

7. **GitHub 發佈 + appcast**

- [ ] 標記並推送：`git tag vX.Y.Z && git push origin vX.Y.Z`（或 `git push --tags`）。
- [ ] 為 `vX.Y.Z` 建立／更新 GitHub 發佈，**標題為 `openclaw X.Y.Z`**（不只是標籤）；內容需內嵌該版本的**完整**變更紀錄區段（Highlights + Changes + Fixes），不得只放連結，且**不可在內容中重複標題**。
- [ ] 附加產物：`npm pack` tarball（選用）、`OpenClaw-X.Y.Z.zip`，以及 `OpenClaw-X.Y.Z.dSYM.zip`（若有產生）。
- [ ] 提交更新後的 `appcast.xml` 並推送（Sparkle 從 main 讀取）。
- [ ] 從乾淨的暫存目錄（沒有 `package.json`）執行 `npx -y openclaw@X.Y.Z send --help`，確認安裝／CLI 入口點可用。
- [ ] 公告／分享發佈說明。

## 外掛發佈範圍（npm）

我們只在 `@openclaw/*` 範圍下發佈**既有的 npm 外掛**。未在 npm 上的隨附外掛維持為**僅磁碟樹**（仍會隨 `extensions/**` 發佈）。

產生清單的流程：

1. 執行 `npm search @openclaw --json` 並擷取套件名稱。
2. 與 `extensions/*/package.json` 的名稱比對。
3. 只發佈**交集**（已存在於 npm）。

目前的 npm 外掛清單（視需要更新）：

- @openclaw/bluebubbles
- @openclaw/diagnostics-otel
- @openclaw/discord
- @openclaw/feishu
- @openclaw/lobster
- @openclaw/matrix
- @openclaw/msteams
- @openclaw/nextcloud-talk
- @openclaw/nostr
- @openclaw/voice-call
- @openclaw/zalo
- @openclaw/zalouser

發佈說明也必須標註**新的選用隨附外掛**，且這些外掛**預設未啟用**（例如：`tlon`）。
