---
summary: "用於 `openclaw configure` 的 CLI 參考（互動式設定提示）"
read_when:
  - 你想要以互動方式調整認證、裝置或代理程式預設值
title: "configure"
x-i18n:
  source_path: cli/configure.md
  source_hash: 9cb2bb5237b02b3a
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:52:30Z
---

# `openclaw configure`

用於設定認證、裝置，以及代理程式預設值的互動式提示。

注意：**模型** 區段現在包含 `agents.defaults.models` 允許清單的多選項目（會顯示在 `/model` 與模型選擇器中）。

提示：不帶子指令執行 `openclaw config` 會開啟相同的精靈。若要進行非互動式編輯，請使用 `openclaw config get|set|unset`。

相關：

- Gateway 設定參考：[Configuration](/gateway/configuration)
- Config CLI：[Config](/cli/config)

備註：

- 選擇 Gateway 執行位置時，總是會更新 `gateway.mode`。如果只需要這一項，你可以在其他區段不做變更並選擇「Continue」。
- 以頻道為導向的服務（Slack/Discord/Matrix/Microsoft Teams）在設定期間會提示輸入頻道／房間的允許清單。你可以輸入名稱或 ID；精靈會在可行時將名稱解析為 ID。

## 範例

```bash
openclaw configure
openclaw configure --section models --section channels
```
