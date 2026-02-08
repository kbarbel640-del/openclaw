---
summary: "模型驗證：OAuth、API 金鑰與 setup-token"
read_when:
  - 偵錯模型驗證或 OAuth 到期
  - 文件化驗證或憑證儲存
title: "驗證"
x-i18n:
  source_path: gateway/authentication.md
  source_hash: 66fa2c64ff374c9c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:53:18Z
---

# 驗證

OpenClaw 支援模型提供者的 OAuth 與 API 金鑰。對於 Anthropic
帳戶，建議使用 **API 金鑰**。若要存取 Claude 訂閱，請使用由 `claude setup-token` 建立的長效權杖。

完整的 OAuth 流程與儲存配置，請參見 [/concepts/oauth](/concepts/oauth)。

## 建議的 Anthropic 設定（API 金鑰）

如果你直接使用 Anthropic，請使用 API 金鑰。

1. 在 Anthropic Console 建立 API 金鑰。
2. 將它放在 **gateway host**（執行 `openclaw gateway` 的機器）上。

```bash
export ANTHROPIC_API_KEY="..."
openclaw models status
```

3. 若 Gateway 在 systemd/launchd 下執行，建議將金鑰放入
   `~/.openclaw/.env`，讓常駐服務可讀取：

```bash
cat >> ~/.openclaw/.env <<'EOF'
ANTHROPIC_API_KEY=...
EOF
```

接著重新啟動常駐服務（或重新啟動你的 Gateway 程序）並再次檢查：

```bash
openclaw models status
openclaw doctor
```

如果你不想自行管理環境變數，入門引導精靈可以為常駐服務儲存 API 金鑰：`openclaw onboard`。

關於環境變數繼承（`env.shellEnv`、`~/.openclaw/.env`、systemd/launchd）的詳細資訊，請參見 [Help](/help)。

## Anthropic：setup-token（訂閱驗證）

對於 Anthropic，建議的路徑是 **API 金鑰**。如果你使用的是 Claude 訂閱，也支援 setup-token 流程。請在 **gateway host** 上執行：

```bash
claude setup-token
```

接著貼到 OpenClaw：

```bash
openclaw models auth setup-token --provider anthropic
```

如果權杖是在另一台機器上建立，請手動貼上：

```bash
openclaw models auth paste-token --provider anthropic
```

如果你看到如下的 Anthropic 錯誤：

```
This credential is only authorized for use with Claude Code and cannot be used for other API requests.
```

……請改用 Anthropic API 金鑰。

手動輸入權杖（任何提供者；會寫入 `auth-profiles.json` 並更新設定）：

```bash
openclaw models auth paste-token --provider anthropic
openclaw models auth paste-token --provider openrouter
```

自動化友善的檢查（到期或缺失時以 `1` 結束，接近到期時以 `2` 結束）：

```bash
openclaw models status --check
```

可選的營運腳本（systemd/Termux）記載於此：
[/automation/auth-monitoring](/automation/auth-monitoring)

> `claude setup-token` 需要互動式 TTY。

## 檢查模型驗證狀態

```bash
openclaw models status
openclaw doctor
```

## 控制使用哪個憑證

### 依工作階段（聊天指令）

使用 `/model <alias-or-id>@<profileId>` 來釘選目前工作階段要使用的特定提供者憑證（範例設定檔 ID：`anthropic:default`、`anthropic:work`）。

使用 `/model`（或 `/model list`）取得精簡選擇器；使用 `/model status` 取得完整檢視（候選項目 + 下一個驗證設定檔，並在已設定時顯示提供者端點詳細資訊）。

### 依代理程式（CLI 覆寫）

為某個代理程式設定明確的驗證設定檔順序覆寫（會儲存在該代理程式的 `auth-profiles.json`）：

```bash
openclaw models auth order get --provider anthropic
openclaw models auth order set --provider anthropic anthropic:default
openclaw models auth order clear --provider anthropic
```

使用 `--agent <id>` 指定特定代理程式；省略則使用已設定的預設代理程式。

## 疑難排解

### 「找不到任何憑證」

如果缺少 Anthropic 權杖設定檔，請在
**gateway host** 上執行 `claude setup-token`，然後再次檢查：

```bash
openclaw models status
```

### 權杖即將到期／已到期

執行 `openclaw models status` 以確認哪個設定檔即將到期。若設定檔
缺失，請重新執行 `claude setup-token` 並再次貼上權杖。

## 需求

- Claude Max 或 Pro 訂閱（適用於 `claude setup-token`）
- 已安裝 Claude Code CLI（可使用 `claude` 指令）
