---
summary: "用於 `openclaw doctor` 的 CLI 參考（健康檢查 + 引導式修復）"
read_when:
  - 你遇到連線／驗證問題，並希望取得引導式修復
  - 你已更新並想進行健全性檢查
title: "doctor"
x-i18n:
  source_path: cli/doctor.md
  source_hash: 92310aa3f3d111e9
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:52:40Z
---

# `openclaw doctor`

為 Gateway 閘道器 與 頻道 提供健康檢查 + 快速修復。

相關：

- 疑難排解：[Troubleshooting](/gateway/troubleshooting)
- 安全性稽核：[Security](/gateway/security)

## 範例

```bash
openclaw doctor
openclaw doctor --repair
openclaw doctor --deep
```

注意事項：

- 互動式提示（例如 keychain／OAuth 修復）僅在 stdin 是 TTY 且未設定 `--non-interactive` 時執行。無頭執行（cron、Telegram、無終端機）將跳過提示。
- `--fix`（`--repair` 的別名）會將備份寫入 `~/.openclaw/openclaw.json.bak`，並移除未知的設定金鑰，逐一列出每次移除。

## macOS：`launchctl` 環境變數 覆寫

如果你先前執行過 `launchctl setenv OPENCLAW_GATEWAY_TOKEN ...`（或 `...PASSWORD`），該值會覆寫你的設定檔，並可能導致持續出現「unauthorized」錯誤。

```bash
launchctl getenv OPENCLAW_GATEWAY_TOKEN
launchctl getenv OPENCLAW_GATEWAY_PASSWORD

launchctl unsetenv OPENCLAW_GATEWAY_TOKEN
launchctl unsetenv OPENCLAW_GATEWAY_PASSWORD
```
