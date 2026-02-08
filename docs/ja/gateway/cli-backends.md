---
summary: "CLI バックエンド: ローカル AI CLI を用いたテキストのみのフォールバック"
read_when:
  - API プロバイダーが失敗した際の信頼できるフォールバックが必要な場合
  - Claude Code CLI やその他のローカル AI CLI を実行しており、それらを再利用したい場合
  - セッションや画像をサポートしつつ、テキストのみ・ツール不要の経路が必要な場合
title: "CLI バックエンド"
x-i18n:
  source_path: gateway/cli-backends.md
  source_hash: 8285f4829900bc81
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:31:51Z
---

# CLI バックエンド（フォールバック実行環境）

OpenClaw は、API プロバイダーが停止している、レート制限されている、または一時的に不調な場合に、**ローカル AI CLI** を **テキストのみのフォールバック** として実行できます。これは意図的に保守的な設計です。

- **ツールは無効化** されます（ツール呼び出しなし）。
- **テキスト入力 → テキスト出力**（高い信頼性）。
- **セッションをサポート**（後続のターンでも一貫性を維持）。
- CLI が画像パスを受け付ける場合、**画像をそのまま渡すことが可能**。

これは主要な経路ではなく、**セーフティネット** として設計されています。外部 API に依存せず、「常に動作する」テキスト応答が必要な場合に使用してください。

## 初心者向けクイックスタート

Claude Code CLI は **設定なし** で利用できます（OpenClaw にはビルトインのデフォルトが同梱されています）。

```bash
openclaw agent --message "hi" --model claude-cli/opus-4.6
```

Codex CLI もそのまま動作します。

```bash
openclaw agent --message "hi" --model codex-cli/gpt-5.3-codex
```

Gateway（ゲートウェイ）が launchd / systemd 配下で実行され、PATH が最小限の場合は、コマンドパスのみを追加してください。

```json5
{
  agents: {
    defaults: {
      cliBackends: {
        "claude-cli": {
          command: "/opt/homebrew/bin/claude",
        },
      },
    },
  },
}
```

以上です。キーや、CLI 自体以外の追加の認証設定は不要です。

## フォールバックとして使用する

CLI バックエンドをフォールバックリストに追加すると、プライマリモデルが失敗した場合にのみ実行されます。

```json5
{
  agents: {
    defaults: {
      model: {
        primary: "anthropic/claude-opus-4-6",
        fallbacks: ["claude-cli/opus-4.6", "claude-cli/opus-4.5"],
      },
      models: {
        "anthropic/claude-opus-4-6": { alias: "Opus" },
        "claude-cli/opus-4.6": {},
        "claude-cli/opus-4.5": {},
      },
    },
  },
}
```

注意点:

- `agents.defaults.models`（allowlist）を使用する場合は、`claude-cli/...` を含める必要があります。
- プライマリプロバイダーが失敗した場合（認証、レート制限、タイムアウトなど）、OpenClaw は次に CLI バックエンドを試行します。

## 設定概要

すべての CLI バックエンドは以下に定義します。

```
agents.defaults.cliBackends
```

各エントリは **provider id**（例: `claude-cli`, `my-cli`）でキー指定されます。provider id はモデル参照の左側になります。

```
<provider>/<model>
```

### 設定例

```json5
{
  agents: {
    defaults: {
      cliBackends: {
        "claude-cli": {
          command: "/opt/homebrew/bin/claude",
        },
        "my-cli": {
          command: "my-cli",
          args: ["--json"],
          output: "json",
          input: "arg",
          modelArg: "--model",
          modelAliases: {
            "claude-opus-4-6": "opus",
            "claude-opus-4-5": "opus",
            "claude-sonnet-4-5": "sonnet",
          },
          sessionArg: "--session",
          sessionMode: "existing",
          sessionIdFields: ["session_id", "conversation_id"],
          systemPromptArg: "--system",
          systemPromptWhen: "first",
          imageArg: "--image",
          imageMode: "repeat",
          serialize: true,
        },
      },
    },
  },
}
```

## 仕組み

1. **バックエンドを選択** します（provider プレフィックス `claude-cli/...` に基づく）。
2. 同じ OpenClaw プロンプトとワークスペースコンテキストを使用して **システムプロンプトを構築** します。
3. 履歴の一貫性を保つため、セッション id（対応している場合）付きで **CLI を実行** します。
4. **出力を解析**（JSON またはプレーンテキスト）し、最終的なテキストを返します。
5. バックエンドごとに **セッション id を永続化** し、フォローアップで同じ CLI セッションを再利用します。

## セッション

- CLI がセッションをサポートしている場合は、`sessionArg`（例: `--session-id`）を設定するか、ID を複数のフラグに挿入する必要がある場合は `sessionArgs`（プレースホルダー `{sessionId}`）を設定してください。
- CLI が **resume サブコマンド** を異なるフラグで使用する場合は、`resumeArgs`（再開時に `args` を置き換える）を設定し、必要に応じて `resumeOutput`（非 JSON 再開用）を設定します。
- `sessionMode`:
  - `always`: 常にセッション id を送信します（保存済みがなければ新しい UUID）。
  - `existing`: 以前に保存された場合のみセッション id を送信します。
  - `none`: セッション id を送信しません。

## 画像（パススルー）

CLI が画像パスを受け付ける場合は、`imageArg` を設定してください。

```json5
imageArg: "--image",
imageMode: "repeat"
```

OpenClaw は base64 画像を一時ファイルに書き出します。`imageArg` が設定されている場合、そのパスが CLI 引数として渡されます。`imageArg` が未設定の場合、OpenClaw はファイルパスをプロンプトに追加します（パス注入）。これは、プレーンなパスからローカルファイルを自動読み込みする CLI（Claude Code CLI の挙動）には十分です。

## 入力 / 出力

- `output: "json"`（デフォルト）は JSON を解析し、テキストとセッション id を抽出します。
- `output: "jsonl"` は JSONL ストリーム（Codex CLI の `--json`）を解析し、最後の agent メッセージと、存在する場合は `thread_id` を抽出します。
- `output: "text"` は stdout を最終レスポンスとして扱います。

入力モード:

- `input: "arg"`（デフォルト）は、プロンプトを最後の CLI 引数として渡します。
- `input: "stdin"` は、プロンプトを stdin 経由で送信します。
- プロンプトが非常に長く、`maxPromptArgChars` が設定されている場合は、stdin が使用されます。

## デフォルト（ビルトイン）

OpenClaw には `claude-cli` のデフォルトが同梱されています。

- `command: "claude"`
- `args: ["-p", "--output-format", "json", "--dangerously-skip-permissions"]`
- `resumeArgs: ["-p", "--output-format", "json", "--dangerously-skip-permissions", "--resume", "{sessionId}"]`
- `modelArg: "--model"`
- `systemPromptArg: "--append-system-prompt"`
- `sessionArg: "--session-id"`
- `systemPromptWhen: "first"`
- `sessionMode: "always"`

OpenClaw には `codex-cli` のデフォルトも同梱されています。

- `command: "codex"`
- `args: ["exec","--json","--color","never","--sandbox","read-only","--skip-git-repo-check"]`
- `resumeArgs: ["exec","resume","{sessionId}","--color","never","--sandbox","read-only","--skip-git-repo-check"]`
- `output: "jsonl"`
- `resumeOutput: "text"`
- `modelArg: "--model"`
- `imageArg: "--image"`
- `sessionMode: "existing"`

必要な場合のみ上書きしてください（一般的には絶対 `command` パス）。

## 制限事項

- **OpenClaw ツールは使用不可**（CLI バックエンドはツール呼び出しを受け取りません）。一部の CLI は独自のエージェントツールを実行する場合があります。
- **ストリーミングなし**（CLI 出力は収集後に返却されます）。
- **構造化出力** は CLI の JSON 形式に依存します。
- **Codex CLI のセッション** はテキスト出力経由で再開されます（JSONL なし）。これは初回の `--json` 実行よりも構造化が弱くなりますが、OpenClaw のセッション自体は通常どおり機能します。

## トラブルシューティング

- **CLI が見つからない**: `command` をフルパスに設定してください。
- **モデル名が誤っている**: `modelAliases` を使用して `provider/model` → CLI モデルをマッピングしてください。
- **セッションが継続しない**: `sessionArg` が設定され、`sessionMode` が `none` でないことを確認してください（Codex CLI は現在 JSON 出力での再開に対応していません）。
- **画像が無視される**: `imageArg` を設定し、CLI がファイルパスをサポートしていることを確認してください。
