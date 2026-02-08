---
summary: "OpenClaw で OpenCode Zen（厳選モデル）を使用します"
read_when:
  - "モデルアクセスに OpenCode Zen を使用したい場合"
  - "コーディング向けに厳選されたモデル一覧が必要な場合"
title: "OpenCode Zen"
x-i18n:
  source_path: providers/opencode.md
  source_hash: b3b5c640ac32f317
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:36Z
---

# OpenCode Zen

OpenCode Zen は、コーディングエージェント向けに OpenCode チームが推奨する **厳選されたモデルの一覧** です。
API キーと `opencode` プロバイダーを使用する、オプションのホスト型モデルアクセス経路です。
Zen は現在ベータ版です。

## CLI setup

```bash
openclaw onboard --auth-choice opencode-zen
# or non-interactive
openclaw onboard --opencode-zen-api-key "$OPENCODE_API_KEY"
```

## Config snippet

```json5
{
  env: { OPENCODE_API_KEY: "sk-..." },
  agents: { defaults: { model: { primary: "opencode/claude-opus-4-6" } } },
}
```

## Notes

- `OPENCODE_ZEN_API_KEY` もサポートされています。
- Zen にサインインし、請求情報を追加して、API キーをコピーします。
- OpenCode Zen はリクエストごとに課金されます。詳細は OpenCode ダッシュボードを確認してください。
