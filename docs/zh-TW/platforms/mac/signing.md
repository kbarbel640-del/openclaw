---
summary: "由封裝腳本產生的 macOS 偵錯建置之簽署步驟"
read_when:
  - 建置或簽署 mac 偵錯建置時
title: "macOS 簽署"
x-i18n:
  source_path: platforms/mac/signing.md
  source_hash: 403b92f9a0ecdb7c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:54:12Z
---

# mac 簽署（偵錯建置）

此應用程式通常由 [`scripts/package-mac-app.sh`](https://github.com/openclaw/openclaw/blob/main/scripts/package-mac-app.sh) 建置，該腳本目前會：

- 設定穩定的偵錯 bundle identifier：`ai.openclaw.mac.debug`
- 使用該 bundle id 寫入 Info.plist（可透過 `BUNDLE_ID=...` 覆寫）
- 呼叫 [`scripts/codesign-mac-app.sh`](https://github.com/openclaw/openclaw/blob/main/scripts/codesign-mac-app.sh) 來簽署主要二進位檔與 app bundle，使 macOS 將每次重建視為同一個已簽署的 bundle，並保留 TCC 權限（通知、輔助使用、螢幕錄製、麥克風、語音）。為了權限穩定性，請使用正式的簽署身分；ad-hoc 為選用且不穩定（請參見 [macOS permissions](/platforms/mac/permissions)）。
- 預設使用 `CODESIGN_TIMESTAMP=auto`；它會為 Developer ID 簽章啟用受信任的時間戳記。將 `CODESIGN_TIMESTAMP=off` 設定為略過時間戳記（離線偵錯建置）。
- 將建置中繼資料注入 Info.plist：`OpenClawBuildTimestamp`（UTC）與 `OpenClawGitCommit`（短雜湊），以便「關於」面板顯示建置、git 與 debug/release 頻道。
- **封裝需要 Node 22+**：腳本會執行 TS 建置與 Control UI 建置。
- 從環境讀取 `SIGN_IDENTITY`。將 `export SIGN_IDENTITY="Apple Development: Your Name (TEAMID)"`（或你的 Developer ID Application 憑證）加入你的 shell rc，以便一律使用你的憑證簽署。ad-hoc 簽署需要透過 `ALLOW_ADHOC_SIGNING=1` 或 `SIGN_IDENTITY="-"` 明確啟用（不建議用於權限測試）。
- 簽署後執行 Team ID 稽核，若 app bundle 內任何 Mach-O 由不同的 Team ID 簽署則失敗。設定 `SKIP_TEAM_ID_CHECK=1` 以略過。

## 使用方式

```bash
# from repo root
scripts/package-mac-app.sh               # auto-selects identity; errors if none found
SIGN_IDENTITY="Developer ID Application: Your Name" scripts/package-mac-app.sh   # real cert
ALLOW_ADHOC_SIGNING=1 scripts/package-mac-app.sh    # ad-hoc (permissions will not stick)
SIGN_IDENTITY="-" scripts/package-mac-app.sh        # explicit ad-hoc (same caveat)
DISABLE_LIBRARY_VALIDATION=1 scripts/package-mac-app.sh   # dev-only Sparkle Team ID mismatch workaround
```

### Ad-hoc 簽署注意事項

使用 `SIGN_IDENTITY="-"`（ad-hoc）簽署時，腳本會自動停用 **Hardened Runtime**（`--options runtime`）。這是為了避免當應用程式嘗試載入未共用相同 Team ID 的內嵌 framework（例如 Sparkle）時發生當機。ad-hoc 簽章也會破壞 TCC 權限的持久性；復原步驟請參見 [macOS permissions](/platforms/mac/permissions)。

## 「關於」的建置中繼資料

`package-mac-app.sh` 會將以下內容蓋章至 bundle：

- `OpenClawBuildTimestamp`：封裝時的 ISO8601 UTC
- `OpenClawGitCommit`：短版 git 雜湊（若不可用則為 `unknown`）

「關於」分頁會讀取這些鍵值來顯示版本、建置日期、git 提交，以及是否為偵錯建置（透過 `#if DEBUG`）。在程式碼變更後請重新執行封裝器以更新這些值。

## 為什麼

TCC 權限同時綁定於 bundle identifier _以及_ 程式碼簽章。未簽署且 UUID 會變動的偵錯建置，會導致 macOS 在每次重建後遺失授權。對二進位檔進行簽署（預設為 ad-hoc）並維持固定的 bundle id/路徑（`dist/OpenClaw.app`）可在建置之間保留授權，這與 VibeTunnel 的做法一致。
