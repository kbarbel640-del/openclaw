---
summary: 「監控模型提供者的 OAuth 到期狀態」
read_when:
  - 設定驗證到期監控或警示時
  - 自動化 Claude Code / Codex OAuth 重新整理檢查
title: 「驗證監控」
x-i18n:
  source_path: automation/auth-monitoring.md
  source_hash: eef179af9545ed7a
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:52:03Z
---

# 驗證監控

OpenClaw 透過 `openclaw models status` 公開 OAuth 到期的健康狀態。可用於
自動化與警示；指令碼僅是手機工作流程的選用附加項。

## 建議方式：CLI 檢查（可攜式）

```bash
openclaw models status --check
```

結束碼：

- `0`：正常
- `1`：認證已到期或遺失
- `2`：即將到期（24 小時內）

可在 cron/systemd 中運作，且不需要任何額外指令碼。

## 選用指令碼（維運／手機工作流程）

這些位於 `scripts/` 之下，且為**選用**。它們假設可透過 SSH 存取
Gateway 閘道器 主機，並針對 systemd + Termux 進行調校。

- `scripts/claude-auth-status.sh` 現在使用 `openclaw models status --json` 作為
  單一事實來源（若 CLI 無法使用，則回退為直接讀取檔案），
  因此請在 `PATH` 上為計時器保留 `openclaw`。
- `scripts/auth-monitor.sh`：cron/systemd 計時器目標；傳送警示（ntfy 或手機）。
- `scripts/systemd/openclaw-auth-monitor.{service,timer}`：systemd 使用者計時器。
- `scripts/claude-auth-status.sh`：Claude Code + OpenClaw 驗證檢查器（完整／json／簡易）。
- `scripts/mobile-reauth.sh`：透過 SSH 的引導式重新驗證流程。
- `scripts/termux-quick-auth.sh`：一鍵小工具狀態＋開啟驗證 URL。
- `scripts/termux-auth-widget.sh`：完整的引導式小工具流程。
- `scripts/termux-sync-widget.sh`：同步 Claude Code 認證 → OpenClaw。

如果不需要手機自動化或 systemd 計時器，可略過這些指令碼。
