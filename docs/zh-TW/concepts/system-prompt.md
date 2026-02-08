---
summary: "OpenClaw 系統提示的內容以及其組裝方式"
read_when:
  - 編輯系統提示文字、工具清單，或時間／心跳區段
  - 變更工作區啟動或 Skills 注入行為
title: "系統提示"
x-i18n:
  source_path: concepts/system-prompt.md
  source_hash: bef4b2674ba0414c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:53:15Z
---

# 系統提示

OpenClaw 會為每一次代理程式執行建構一個自訂的系統提示。該提示由 **OpenClaw 擁有**，且不使用 p-coding-agent 的預設提示。

系統提示由 OpenClaw 組裝，並注入到每一次代理程式執行中。

## 結構

系統提示刻意保持精簡，並使用固定區段：

- **Tooling**：目前的工具清單 + 簡短說明。
- **Safety**：簡短的防護欄提醒，避免追求權力的行為或規避監督。
- **Skills**（可用時）：告知模型如何按需載入技能指示。
- **OpenClaw Self-Update**：如何執行 `config.apply` 與 `update.run`。
- **Workspace**：工作目錄（`agents.defaults.workspace`）。
- **Documentation**：OpenClaw 文件的本機路徑（repo 或 npm 套件）以及何時閱讀。
- **Workspace Files (injected)**：指出下方包含啟動用檔案。
- **Sandbox**（啟用時）：指出沙箱隔離的執行環境、沙箱路徑，以及是否提供提升權限的 exec。
- **Current Date & Time**：使用者本地時間、時區與時間格式。
- **Reply Tags**：支援的提供者可使用的選用回覆標籤語法。
- **Heartbeats**：心跳提示與 ack 行為。
- **Runtime**：主機、OS、node、模型、repo root（偵測到時）、思考層級（單行）。
- **Reasoning**：目前的可見性層級 + /reasoning 切換提示。

系統提示中的 Safety 防護欄屬於建議性質。它們用於引導模型行為，但不強制政策。若需硬性約束，請使用工具政策、exec 核准、沙箱隔離，以及頻道允許清單；操作人員可依設計停用這些機制。

## 提示模式

OpenClaw 可為子代理程式渲染較小的系統提示。執行階段會為每次執行設定
`promptMode`（非使用者面向的設定）：

- `full`（預設）：包含上述所有區段。
- `minimal`：用於子代理程式；省略 **Skills**、**Memory Recall**、**OpenClaw
  Self-Update**、**Model Aliases**、**User Identity**、**Reply Tags**、
  **Messaging**、**Silent Replies** 與 **Heartbeats**。Tooling、**Safety**、
  Workspace、Sandbox、Current Date & Time（已知時）、Runtime，以及注入的
  內容仍可使用。
- `none`：僅回傳基礎身分識別行。

當 `promptMode=minimal` 時，額外注入的提示會標示為 **Subagent
Context**，而非 **Group Chat Context**。

## 工作區啟動注入

啟動檔案會被修剪後附加於 **Project Context** 之下，使模型在無需明確讀取的情況下即可看到身分與設定檔脈絡：

- `AGENTS.md`
- `SOUL.md`
- `TOOLS.md`
- `IDENTITY.md`
- `USER.md`
- `HEARTBEAT.md`
- `BOOTSTRAP.md`（僅於全新工作區）

大型檔案會以標記進行截斷。每個檔案的最大大小由
`agents.defaults.bootstrapMaxChars` 控制（預設：20000）。缺失的檔案會注入
簡短的缺檔標記。

內部 hook 可透過 `agent:bootstrap` 攔截此步驟，以變更或取代
注入的啟動檔案（例如將 `SOUL.md` 置換為替代人格）。

若要檢視每個注入檔案的貢獻量（原始 vs 注入、截斷，以及工具結構描述的額外負擔），請使用 `/context list` 或 `/context detail`。請參閱 [Context](/concepts/context)。

## 時間處理

當已知使用者時區時，系統提示會包含專用的 **Current Date & Time** 區段。為了維持提示的快取穩定性，現在僅包含 **時區**（不含動態時鐘或時間格式）。

當代理程式需要目前時間時，請使用 `session_status`；狀態卡會包含時間戳記行。

設定方式如下：

- `agents.defaults.userTimezone`
- `agents.defaults.timeFormat`（`auto` | `12` | `24`）

完整行為細節請參閱 [Date & Time](/date-time)。

## Skills

當存在符合資格的 Skills 時，OpenClaw 會注入精簡的 **available skills list**
（`formatSkillsForPrompt`），其中包含每個技能的 **檔案路徑**。提示會指示模型使用
`read` 在列出的位置（工作區、受管，或隨附）載入 SKILL.md。若沒有任何符合資格的 Skills，則會省略 Skills 區段。

```
<available_skills>
  <skill>
    <name>...</name>
    <description>...</description>
    <location>...</location>
  </skill>
</available_skills>
```

此作法可在維持基礎提示精簡的同時，仍支援精準的技能使用。

## Documentation

可用時，系統提示會包含 **Documentation** 區段，指向
本機 OpenClaw 文件目錄（repo 工作區中的 `docs/` 或隨附的 npm
套件文件），並同時註明公開鏡像、原始碼 repo、社群 Discord，以及
ClawHub（https://clawhub.com）以供 Skills 探索。提示會指示模型在需要了解 OpenClaw 的行為、指令、設定或架構時，優先查閱本機文件，並在可能的情況下自行執行
`openclaw status`（僅在無法存取時才詢問使用者）。
