---
summary: "用於 `openclaw dns` 的 CLI 參考（廣域探索輔助工具）"
read_when:
  - 你想透過 Tailscale + CoreDNS 進行廣域探索（DNS-SD）
  - 你正在為自訂探索網域設定分割 DNS（例如：openclaw.internal）
title: "dns"
x-i18n:
  source_path: cli/dns.md
  source_hash: d2011e41982ffb4b
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:52:34Z
---

# `openclaw dns`

用於廣域探索的 DNS 輔助工具（Tailscale + CoreDNS）。目前著重於 macOS + Homebrew CoreDNS。

相關內容：

- Gateway 探索：[Discovery](/gateway/discovery)
- 廣域探索設定：[Configuration](/gateway/configuration)

## 設定

```bash
openclaw dns setup
openclaw dns setup --apply
```
