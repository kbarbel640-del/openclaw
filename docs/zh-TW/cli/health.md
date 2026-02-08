---
summary: "透過 RPC 的 Gateway 閘道器健康狀態端點之 `openclaw health` CLI 參考"
read_when:
  - "你想要快速檢查正在執行的 Gateway 閘道器健康狀態"
title: "health"
x-i18n:
  source_path: cli/health.md
  source_hash: 82a78a5a97123f7a
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:52:42Z
---

# `openclaw health`

從正在執行的 Gateway 閘道器取得健康狀態。

```bash
openclaw health
openclaw health --json
openclaw health --verbose
```

注意事項：

- `--verbose` 會執行即時探測，並在設定多個帳戶時列印各帳戶的耗時。
- 當設定多個代理程式時，輸出會包含各代理程式的工作階段儲存區。
