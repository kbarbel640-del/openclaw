---
summary: "Tailscale + CoreDNS による広域デバイス検出ヘルパー向けの `openclaw dns` の CLI リファレンス"
read_when:
  - Tailscale + CoreDNS による広域デバイス検出（DNS-SD）が必要な場合
  - カスタムデバイス検出ドメイン（例: openclaw.internal）向けにスプリット DNS を設定する場合
title: "dns"
x-i18n:
  source_path: cli/dns.md
  source_hash: d2011e41982ffb4b
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:00:21Z
---

# `openclaw dns`

広域デバイス検出（Tailscale + CoreDNS）向けの DNS ヘルパーです。現在は macOS + Homebrew CoreDNS に重点を置いています。

関連:

- Gateway（ゲートウェイ）のデバイス検出: [Discovery](/gateway/discovery)
- 広域デバイス検出の設定: [Configuration](/gateway/configuration)

## セットアップ

```bash
openclaw dns setup
openclaw dns setup --apply
```
