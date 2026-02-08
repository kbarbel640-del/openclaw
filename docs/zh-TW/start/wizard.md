---
summary: 「CLI 入門引導精靈：為 Gateway 閘道器、工作區、頻道與 Skills 提供引導式設定」
read_when:
  - 執行或設定入門引導精靈時
  - 設定新機器時
title: 「入門引導精靈（CLI）」
sidebarTitle: "Onboarding: CLI"
x-i18n:
  source_path: start/wizard.md
  source_hash: 5495d951a2d78ffb
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:54:52Z
---

# 入門引導精靈（CLI）

入門引導精靈是設定 OpenClaw 於 macOS、
Linux 或 Windows（透過 WSL2；強烈建議）的**建議**方式。
它會在單一引導流程中設定本機 Gateway 閘道器或遠端 Gateway 閘道器連線，以及頻道、Skills
與工作區的預設值。

```bash
openclaw onboard
```

<Info>
最快的首次聊天：開啟控制 UI（不需要設定頻道）。執行
`openclaw dashboard` 並在瀏覽器中聊天。文件：[Dashboard](/web/dashboard)。
</Info>

若要之後重新設定：

```bash
openclaw configure
openclaw agents add <name>
```

<Note>
`--json` 並不代表非互動模式。用於腳本時，請使用 `--non-interactive`。
</Note>

<Tip>
建議：設定 Brave Search API 金鑰，讓代理程式可以使用 `web_search`
（`web_fetch` 不需要金鑰即可運作）。最簡單的方式：`openclaw configure --section web`
會儲存 `tools.web.search.apiKey`。文件：[Web tools](/tools/web)。
</Tip>

## 快速開始 vs 進階

精靈一開始提供 **快速開始**（預設值）與 **進階**（完整控制）。

<Tabs>
  <Tab title="快速開始（預設值）">
    - 本機 Gateway 閘道器（loopback）
    - 工作區預設值（或既有工作區）
    - Gateway 閘道器連接埠 **18789**
    - Gateway 閘道器驗證 **Token**（即使在 loopback 也會自動產生）
    - Tailscale 曝露 **關閉**
    - Telegram + WhatsApp 私訊預設為 **allowlist**（會提示你輸入電話號碼）
  </Tab>
  <Tab title="進階（完整控制）">
    - 顯示每個步驟（模式、工作區、Gateway 閘道器、頻道、常駐程式、Skills）。
  </Tab>
</Tabs>

## 精靈會設定的內容

**本機模式（預設）** 會帶你完成以下步驟：

1. **模型／驗證** — Anthropic API 金鑰（建議）、OAuth、OpenAI 或其他提供者。選擇預設模型。
2. **工作區** — 代理程式檔案的位置（預設為 `~/.openclaw/workspace`）。植入啟動檔案。
3. **Gateway 閘道器** — 連接埠、繫結位址、驗證模式、Tailscale 曝露。
4. **頻道** — WhatsApp、Telegram、Discord、Google Chat、Mattermost、Signal、BlueBubbles 或 iMessage。
5. **常駐程式** — 安裝 LaunchAgent（macOS）或 systemd 使用者單元（Linux/WSL2）。
6. **健康檢查** — 啟動 Gateway 閘道器並驗證其正在執行。
7. **Skills** — 安裝建議的 Skills 與選用相依套件。

<Note>
重新執行精靈**不會**清除任何內容，除非你明確選擇 **Reset**（或傳入 `--reset`）。
若設定無效或包含舊版金鑰，精靈會要求你先執行 `openclaw doctor`。
</Note>

**遠端模式** 只會設定本機用戶端以連線至其他地方的 Gateway 閘道器。
它**不會**在遠端主機上安裝或變更任何內容。

## 新增另一個代理程式

使用 `openclaw agents add <name>` 建立一個具有獨立工作區、
工作階段與驗證設定檔的代理程式。未加入 `--workspace` 直接執行時會啟動精靈。

其設定內容：

- `agents.list[].name`
- `agents.list[].workspace`
- `agents.list[].agentDir`

注意事項：

- 預設工作區遵循 `~/.openclaw/workspace-<agentId>`。
- 加入 `bindings` 以路由傳入訊息（精靈可協助完成）。
- 非互動旗標：`--model`、`--agent-dir`、`--bind`、`--non-interactive`。

## 完整參考

如需詳細的逐步拆解、非互動式腳本、Signal 設定、
RPC API，以及精靈寫入的完整設定欄位清單，請參閱
[Wizard Reference](/reference/wizard)。

## 相關文件

- CLI 指令參考：[`openclaw onboard`](/cli/onboard)
- macOS 應用程式入門引導：[Onboarding](/start/onboarding)
- 代理程式首次執行儀式：[Agent Bootstrapping](/start/bootstrapping)
