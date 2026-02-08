---
summary: " `openclaw security`（監査と一般的なセキュリティ上の落とし穴の修正）の CLI リファレンス"
read_when:
  - 設定/状態に対して簡単なセキュリティ監査を実行したい場合
  - 安全な「修正」提案（chmod、デフォルト設定の強化）を適用したい場合
title: "security"
x-i18n:
  source_path: cli/security.md
  source_hash: 96542b4784e53933
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:00:35Z
---

# `openclaw security`

セキュリティツール（監査 + 任意の修正）です。

関連:

- セキュリティガイド: [Security](/gateway/security)

## 監査

```bash
openclaw security audit
openclaw security audit --deep
openclaw security audit --fix
```

この監査では、複数のダイレクトメッセージ送信者がメインセッションを共有している場合に警告し、共有受信箱に対して **セキュア DM モード**: `session.dmScope="per-channel-peer"`（またはマルチアカウントのチャンネル向けには `per-account-channel-peer`）を推奨します。
また、小型モデル（`<=300B`）がサンドボックス化なしで使用され、かつ Web/ブラウザツールが有効になっている場合にも警告します。
