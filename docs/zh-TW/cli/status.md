---
summary: "CLI 參考文件：`openclaw status`（診斷、探測、使用快照）"
read_when:
  - 你想要快速診斷頻道健康狀態 + 最近的工作階段收件者
  - 你想要一份可直接貼上的「all」狀態用於除錯
title: "status"
x-i18n:
  source_path: cli/status.md
  source_hash: 2bbf5579c48034fc
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:52:41Z
---

# `openclaw status`

用於頻道 + 工作階段的診斷。

```bash
openclaw status
openclaw status --all
openclaw status --deep
openclaw status --usage
```

注意事項：

- `--deep` 會執行即時探測（WhatsApp Web + Telegram + Discord + Google Chat + Slack + Signal）。
- 當設定多個代理程式時，輸出會包含每個代理程式的工作階段儲存狀態。
- 概覽在可用時會包含 Gateway 閘道器 + 節點主機服務的安裝／執行狀態。
- 概覽會包含更新頻道 + git SHA（適用於原始碼檢出）。
- 更新資訊會顯示在概覽中；若有可用更新，狀態會提示執行 `openclaw update`（請參閱 [Updating](/install/updating)）。
