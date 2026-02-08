---
summary: 「提升的執行模式與 /elevated 指令」
read_when:
  - 調整提升模式的預設值、允許清單，或斜線指令行為
title: 「提升模式」
x-i18n:
  source_path: tools/elevated.md
  source_hash: 83767a0160930402
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:00Z
---

# 提升模式（/elevated 指令）

## 功能說明

- `/elevated on` 在 Gateway 閘道器 主機上執行，並保留 exec 核准（與 `/elevated ask` 相同）。
- `/elevated full` 在 Gateway 閘道器 主機上執行，**並且** 自動核准 exec（略過 exec 核准）。
- `/elevated ask` 在 Gateway 閘道器 主機上執行，但保留 exec 核准（與 `/elevated on` 相同）。
- `on`/`ask` **不會** 強制 `exec.security=full`；已設定的安全性／詢問政策仍然適用。
- 僅在代理程式為 **sandboxed** 時才會改變行為（否則 exec 本就已在主機上執行）。
- 指令形式：`/elevated on|off|ask|full`、`/elev on|off|ask|full`。
- 僅接受 `on|off|ask|full`；其他任何內容都會回傳提示且不會改變狀態。

## 控制範圍（以及不包含的部分）

- **可用性閘門**：`tools.elevated` 是全域基準。`agents.list[].tools.elevated` 可在每個代理程式層級進一步限制提升（兩者都必須允許）。
- **每個工作階段的狀態**：`/elevated on|off|ask|full` 會為目前的工作階段金鑰設定提升層級。
- **內嵌指令**：訊息內的 `/elevated on|ask|full` 僅套用於該則訊息。
- **群組**：在群組聊天中，只有在提及代理程式時才會套用提升指令。繞過提及需求的僅指令訊息會被視為已提及。
- **主機執行**：提升會強制將 `exec` 指向 Gateway 閘道器 主機；`full` 也會設定 `security=full`。
- **核准**：`full` 會略過 exec 核准；`on`/`ask` 在允許清單／詢問規則要求時會遵循核准流程。
- **未 sandbox 的代理程式**：對位置而言為無操作；僅影響閘門、記錄與狀態。
- **工具政策仍然適用**：若 `exec` 被工具政策拒絕，則無法使用提升。
- **與 `/exec` 分離**：`/exec` 會為已授權的傳送者調整每個工作階段的預設值，且不需要提升。

## 解析順序

1. 訊息中的內嵌指令（僅套用於該則訊息）。
2. 工作階段覆寫（透過傳送僅含指令的訊息設定）。
3. 全域預設值（設定中的 `agents.defaults.elevatedDefault`）。

## 設定工作階段預設值

- 傳送一則 **只包含** 指令的訊息（允許空白），例如：`/elevated full`。
- 會送出確認回覆（`Elevated mode set to full...` / `Elevated mode disabled.`）。
- 若提升存取已停用，或傳送者不在核准的允許清單中，指令會回覆可採取行動的錯誤，且不會變更工作階段狀態。
- 傳送 `/elevated`（或 `/elevated:`）且不帶參數，以查看目前的提升層級。

## 可用性 + 允許清單

- 功能閘門：`tools.elevated.enabled`（即使程式碼支援，預設也可透過設定關閉）。
- 傳送者允許清單：`tools.elevated.allowFrom`，並包含各提供者的允許清單（例如：`discord`、`whatsapp`）。
- 每個代理程式的閘門：`agents.list[].tools.elevated.enabled`（選用；只能進一步限制）。
- 每個代理程式的允許清單：`agents.list[].tools.elevated.allowFrom`（選用；設定後，傳送者必須同時符合 **全域 + 每代理程式** 的允許清單）。
- Discord 備援：若省略 `tools.elevated.allowFrom.discord`，則會使用 `channels.discord.dm.allowFrom` 清單作為備援。設定 `tools.elevated.allowFrom.discord`（即使是 `[]`）即可覆寫。每代理程式的允許清單 **不會** 使用備援。
- 所有閘門都必須通過；否則提升會被視為不可用。

## 記錄 + 狀態

- 提升的 exec 呼叫會以 info 等級記錄。
- 工作階段狀態包含提升模式（例如：`elevated=ask`、`elevated=full`）。
