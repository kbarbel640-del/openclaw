---
summary: "用於外送頻道的 Markdown 格式化管線"
read_when:
  - 你正在變更外送頻道的 Markdown 格式化或分塊行為
  - 你正在新增新的頻道格式器或樣式對應
  - 你正在除錯跨頻道的格式化回歸問題
title: "Markdown 格式化"
x-i18n:
  source_path: concepts/markdown-formatting.md
  source_hash: f9cbf9b744f9a218
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:53:02Z
---

# Markdown 格式化

OpenClaw 會先將外送的 Markdown 轉換為共用的中介表示（IR），再渲染成各頻道專屬的輸出。IR 在保留來源文字原貌的同時，攜帶樣式／連結的範圍（span），讓分塊與渲染能在各頻道間保持一致。

## 目標

- **一致性：** 一次解析，多個渲染器。
- **安全的分塊：** 在渲染前切分文字，確保行內格式不會跨塊被打斷。
- **頻道適配：** 將同一份 IR 對應到 Slack mrkdwn、Telegram HTML 與 Signal 樣式範圍，而無需重新解析 Markdown。

## 管線

1. **解析 Markdown -> IR**
   - IR 是純文字，加上樣式範圍（粗體／斜體／刪除線／程式碼／劇透）與連結範圍。
   - 位移量使用 UTF-16 程式碼單元，讓 Signal 的樣式範圍能與其 API 對齊。
   - 只有在頻道選擇加入表格轉換時，才會解析表格。
2. **分塊 IR（先格式）**
   - 分塊在渲染前於 IR 文字上進行。
   - 行內格式不會跨塊切分；每個區塊會切出對應的範圍。
3. **依頻道渲染**
   - **Slack：** mrkdwn 標記（粗體／斜體／刪除線／程式碼），連結為 `<url|label>`。
   - **Telegram：** HTML 標籤（`<b>`、`<i>`、`<s>`、`<code>`、`<pre><code>`、`<a href>`）。
   - **Signal：** 純文字 + `text-style` 範圍；當標籤與 URL 不同時，連結會變成 `label (url)`。

## IR 範例

輸入的 Markdown：

```markdown
Hello **world** — see [docs](https://docs.openclaw.ai).
```

IR（示意）：

```json
{
  "text": "Hello world — see docs.",
  "styles": [{ "start": 6, "end": 11, "style": "bold" }],
  "links": [{ "start": 19, "end": 23, "href": "https://docs.openclaw.ai" }]
}
```

## 使用位置

- Slack、Telegram 與 Signal 的外送轉接器皆從 IR 進行渲染。
- 其他頻道（WhatsApp、iMessage、MS Teams、Discord）仍使用純文字或其自有的格式規則；當啟用時，Markdown 表格轉換會在分塊前套用。

## 表格處理

Markdown 表格在各聊天客戶端中的支援並不一致。請使用
`markdown.tables` 來控制各頻道（以及各帳號）的轉換方式。

- `code`：將表格渲染為程式碼區塊（多數頻道的預設）。
- `bullets`：將每一列轉換為項目符號（Signal + WhatsApp 的預設）。
- `off`：停用表格解析與轉換；原始表格文字會直接通過。

設定金鑰：

```yaml
channels:
  discord:
    markdown:
      tables: code
    accounts:
      work:
        markdown:
          tables: off
```

## 分塊規則

- 分塊上限來自頻道轉接器／設定，並套用於 IR 文字。
- 程式碼圍欄會保留為單一區塊，並在結尾加上換行，以確保各頻道正確渲染。
- 清單前綴與引用區塊前綴屬於 IR 文字的一部分，因此分塊不會在前綴中途切開。
- 行內樣式（粗體／斜體／刪除線／行內程式碼／劇透）絕不會跨塊切分；渲染器會在每個區塊內重新開啟樣式。

若需要更多關於跨頻道分塊行為的說明，請參閱
[Streaming + chunking](/concepts/streaming)。

## 連結政策

- **Slack：** `[label](url)` -> `<url|label>`；裸 URL 會保持為裸連結。解析時會停用自動連結，以避免重複連結。
- **Telegram：** `[label](url)` -> `<a href="url">label</a>`（HTML 解析模式）。
- **Signal：** `[label](url)` -> `label (url)`，除非標籤與 URL 相同。

## 劇透

劇透標記（`||spoiler||`）只會為 Signal 進行解析，並對應到 SPOILER 樣式範圍。其他頻道會將其視為純文字。

## 如何新增或更新頻道格式器

1. **一次解析：** 使用共用的 `markdownToIR(...)` 輔助工具，並設定符合頻道的選項（自動連結、標題樣式、引用前綴）。
2. **渲染：** 以 `renderMarkdownWithMarkers(...)` 實作渲染器，並提供樣式標記對應（或 Signal 的樣式範圍）。
3. **分塊：** 在渲染前呼叫 `chunkMarkdownIR(...)`；逐塊進行渲染。
4. **接線轉接器：** 更新頻道外送轉接器，使用新的分塊器與渲染器。
5. **測試：** 新增或更新格式測試；若頻道使用分塊，請加入外送投遞測試。

## 常見陷阱

- Slack 的角括號標記（`<@U123>`、`<#C123>`、`<https://...>`）必須被保留；請安全地跳脫原始 HTML。
- Telegram HTML 需要對標籤外的文字進行跳脫，以避免標記損壞。
- Signal 的樣式範圍依賴 UTF-16 位移；請勿使用碼點位移。
- 為程式碼圍欄保留結尾換行，確保關閉標記落在獨立的一行。
