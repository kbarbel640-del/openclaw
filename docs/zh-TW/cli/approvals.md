---
summary: "「openclaw approvals」的 CLI 參考（用於 Gateway 閘道器 或 節點主機的 exec 核准）"
read_when:
  - 您想要從 CLI 編輯 exec 核准
  - 您需要在 Gateway 閘道器 或 節點主機上管理允許清單
title: "核准"
x-i18n:
  source_path: cli/approvals.md
  source_hash: 4329cdaaec2c5f5d
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:52:31Z
---

# `openclaw approvals`

管理 **本機主機**、**Gateway 閘道器 主機**，或 **節點主機** 的 exec 核准。
預設情況下，指令會以磁碟上的本機核准檔案為目標。使用 `--gateway` 以 Gateway 閘道器 為目標，或使用 `--node` 以指定的節點為目標。

相關：

- Exec 核准：[Exec approvals](/tools/exec-approvals)
- 節點：[Nodes](/nodes)

## 常用指令

```bash
openclaw approvals get
openclaw approvals get --node <id|name|ip>
openclaw approvals get --gateway
```

## 從檔案取代核准項目

```bash
openclaw approvals set --file ./exec-approvals.json
openclaw approvals set --node <id|name|ip> --file ./exec-approvals.json
openclaw approvals set --gateway --file ./exec-approvals.json
```

## 允許清單 輔助工具

```bash
openclaw approvals allowlist add "~/Projects/**/bin/rg"
openclaw approvals allowlist add --agent main --node <id|name|ip> "/usr/bin/uptime"
openclaw approvals allowlist add --agent "*" "/usr/bin/uname"

openclaw approvals allowlist remove "~/Projects/**/bin/rg"
```

## 注意事項

- `--node` 使用與 `openclaw nodes` 相同的解析器（id、name、ip，或 id 前綴）。
- `--agent` 預設為 `"*"`，會套用至所有代理程式。
- 節點主機必須公告 `system.execApprovals.get/set`（macOS app 或無介面節點主機）。
- 核准檔案會依主機儲存在 `~/.openclaw/exec-approvals.json`。
