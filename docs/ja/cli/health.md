---
summary: "CLI リファレンス：`openclaw health`（RPC 経由の Gateway（ゲートウェイ）ヘルスエンドポイント）"
read_when:
  - 実行中の Gateway（ゲートウェイ）のヘルスをすばやく確認したい場合
title: "health"
x-i18n:
  source_path: cli/health.md
  source_hash: 82a78a5a97123f7a
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:00:17Z
---

# `openclaw health`

実行中の Gateway（ゲートウェイ）からヘルス情報を取得します。

```bash
openclaw health
openclaw health --json
openclaw health --verbose
```

注意事項：

- `--verbose` はライブプローブを実行し、複数のアカウントが設定されている場合はアカウントごとの所要時間を出力します。
- 出力には、複数のエージェントが設定されている場合のエージェントごとのセッションストアが含まれます。
