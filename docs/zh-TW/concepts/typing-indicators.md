---
summary: "OpenClaw 何時顯示輸入中指示器，以及如何調整"
read_when:
  - 變更輸入中指示器的行為或預設值
title: "輸入中指示器"
x-i18n:
  source_path: concepts/typing-indicators.md
  source_hash: 8ee82d02829c4ff5
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:53:07Z
---

# 輸入中指示器

在執行期間，輸入中指示器會傳送到聊天頻道。使用
`agents.defaults.typingMode` 來控制輸入 **何時** 開始，並使用 `typingIntervalSeconds`
來控制 **多久** 重新整理一次。

## 預設值

當 `agents.defaults.typingMode` **未設定** 時，OpenClaw 會維持舊有行為：

- **直接聊天**：模型迴圈一開始就立即顯示輸入中。
- **有提及的群組聊天**：立即顯示輸入中。
- **沒有提及的群組聊天**：只有在訊息文字開始串流時才顯示輸入中。
- **心跳執行**：停用輸入中顯示。

## 模式

將 `agents.defaults.typingMode` 設為以下其中一項：

- `never` — 永遠不顯示輸入中指示器。
- `instant` — **模型迴圈一開始就** 顯示輸入中，即使之後只回傳靜默回覆權杖。
- `thinking` — 在 **第一個推理增量** 時顯示輸入中（執行需啟用
  `reasoningLevel: "stream"`）。
- `message` — 在 **第一個非靜默文字增量** 時顯示輸入中（忽略
  `NO_REPLY` 靜默權杖）。

「觸發時機由早到晚」的順序：
`never` → `message` → `thinking` → `instant`

## 設定

```json5
{
  agent: {
    typingMode: "thinking",
    typingIntervalSeconds: 6,
  },
}
```

你可以在每個工作階段覆寫模式或節奏：

```json5
{
  session: {
    typingMode: "message",
    typingIntervalSeconds: 4,
  },
}
```

## 注意事項

- `message` 模式不會為僅包含靜默的回覆顯示輸入中（例如用於抑制輸出的 `NO_REPLY` 權杖）。
- `thinking` 只有在執行串流推理（`reasoningLevel: "stream"`）時才會觸發。
  如果模型沒有輸出推理增量，輸入中將不會開始。
- 心跳永遠不顯示輸入中，無論模式為何。
- `typingIntervalSeconds` 控制的是 **重新整理的節奏**，而不是開始時間。
  預設為 6 秒。
