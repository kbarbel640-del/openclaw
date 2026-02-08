---
summary: "CLI 參考文件：`openclaw config`（以 get/set/unset 讀取／設定／移除設定值）"
read_when:
  - 你想以非互動方式讀取或編輯設定
title: "設定"
x-i18n:
  source_path: cli/config.md
  source_hash: d60a35f5330f22bc
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:52:31Z
---

# `openclaw config`

設定輔助工具：依路徑取得／設定／移除值。未指定子命令執行時，會開啟設定精靈（與 `openclaw configure` 相同）。

## 範例

```bash
openclaw config get browser.executablePath
openclaw config set browser.executablePath "/usr/bin/google-chrome"
openclaw config set agents.defaults.heartbeat.every "2h"
openclaw config set agents.list[0].tools.exec.node "node-id-or-name"
openclaw config unset tools.web.search.apiKey
```

## 路徑

路徑可使用點號或括號表示法：

```bash
openclaw config get agents.defaults.workspace
openclaw config get agents.list[0].id
```

使用代理程式清單索引以鎖定特定代理程式：

```bash
openclaw config get agents.list
openclaw config set agents.list[1].tools.exec.node "node-id-or-name"
```

## 值

在可行時，值會以 JSON5 解析；否則會視為字串。使用 `--json` 以要求進行 JSON5 解析。

```bash
openclaw config set agents.defaults.heartbeat.every "0m"
openclaw config set gateway.port 19001 --json
openclaw config set channels.whatsapp.groups '["*"]' --json
```

編輯後請重新啟動 Gateway 閘道器。
