---
summary: "CLI オンボーディングウィザード: Gateway（ゲートウェイ）、ワークスペース、チャンネル、Skills のガイド付きセットアップ"
read_when:
  - オンボーディングウィザードを実行または設定するとき
  - 新しいマシンをセットアップするとき
title: "オンボーディングウィザード（CLI）"
sidebarTitle: "オンボーディング: CLI"
x-i18n:
  source_path: start/wizard.md
  source_hash: 5495d951a2d78ffb
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:11:22Z
---

# オンボーディングウィザード（CLI）

オンボーディングウィザードは、macOS、Linux、または Windows（WSL2 経由; 強く推奨）で OpenClaw をセットアップするための **推奨** の方法です。
ローカル Gateway（ゲートウェイ）またはリモート Gateway（ゲートウェイ）接続に加えて、チャンネル、Skills、ワークスペースのデフォルトを、1 つのガイド付きフローで設定します。

```bash
openclaw onboard
```

<Info>
最速で最初のチャット: Control UI を開きます（チャンネル設定は不要です）。`openclaw dashboard` を実行して、ブラウザでチャットしてください。ドキュメント: [Dashboard](/web/dashboard)。
</Info>

後で再設定するには:

```bash
openclaw configure
openclaw agents add <name>
```

<Note>
`--json` は、非対話モードを意味しません。スクリプトでは、`--non-interactive` を使用してください。
</Note>

<Tip>
推奨: エージェントが `web_search` を使用できるように、Brave Search API キーを設定してください（`web_fetch` はキーなしでも動作します）。最も簡単な方法: `openclaw configure --section web`。これは `tools.web.search.apiKey` を保存します。ドキュメント: [Web tools](/tools/web)。
</Tip>

## クイックスタート vs 高度な設定

ウィザードは、**QuickStart**（デフォルト）と **Advanced**（完全な制御）から始まります。

<Tabs>
  <Tab title="QuickStart (defaults)">
    - ローカルゲートウェイ（loopback）
    - ワークスペースのデフォルト（または既存のワークスペース）
    - Gateway（ゲートウェイ）ポート **18789**
    - Gateway（ゲートウェイ）認証 **Token**（loopback 上でも自動生成）
    - Tailscale 公開 **Off**
    - Telegram + WhatsApp のダイレクトメッセージは、デフォルトで **allowlist**（電話番号の入力を求められます）
  </Tab>
  <Tab title="Advanced (full control)">
    - すべての手順（モード、ワークスペース、ゲートウェイ、チャンネル、デーモン、Skills）を公開します。
  </Tab>
</Tabs>

## ウィザードが設定する内容

**ローカルモード（デフォルト）** では、次の手順を案内します:

1. **モデル/認証** — Anthropic API キー（推奨）、OAuth、OpenAI、またはその他のプロバイダー。デフォルトモデルを選択します。
2. **ワークスペース** — エージェントファイルの場所（デフォルト `~/.openclaw/workspace`）。ブートストラップファイルを生成します。
3. **Gateway（ゲートウェイ）** — ポート、バインドアドレス、認証モード、Tailscale 公開。
4. **チャンネル** — WhatsApp、Telegram、Discord、Google Chat、Mattermost、Signal、BlueBubbles、または iMessage。
5. **デーモン** — LaunchAgent（macOS）または systemd ユーザーユニット（Linux/WSL2）をインストールします。
6. **ヘルスチェック** — Gateway（ゲートウェイ）を起動し、稼働していることを検証します。
7. **Skills** — 推奨 Skills とオプションの依存関係をインストールします。

<Note>
ウィザードを再実行しても、明示的に **Reset** を選択する（または `--reset` を渡す）場合を除き、何も消去されません。
設定が無効である、またはレガシーキーが含まれている場合、ウィザードは先に `openclaw doctor` を実行するよう求めます。
</Note>

**リモートモード** は、別の場所にある Gateway（ゲートウェイ）へ接続するようローカルクライアントを設定するだけです。
リモートホスト上では、何もインストールも変更もしません。

## 別のエージェントを追加する

`openclaw agents add <name>` を使用して、独自のワークスペース、セッション、認証プロファイルを持つ別のエージェントを作成します。`--workspace` なしで実行すると、ウィザードが起動します。

設定される内容:

- `agents.list[].name`
- `agents.list[].workspace`
- `agents.list[].agentDir`

注意:

- デフォルトのワークスペースは `~/.openclaw/workspace-<agentId>` に従います。
- インバウンドメッセージをルーティングするには `bindings` を追加します（ウィザードでも可能です）。
- 非対話フラグ: `--model`、`--agent-dir`、`--bind`、`--non-interactive`。

## 完全なリファレンス

詳細なステップバイステップの内訳、非対話スクリプト、Signal のセットアップ、
RPC API、そしてウィザードが書き込む設定フィールドの完全な一覧については、
[Wizard Reference](/reference/wizard) を参照してください。

## 関連ドキュメント

- CLI コマンドリファレンス: [`openclaw onboard`](/cli/onboard)
- macOS アプリのオンボーディング: [Onboarding](/start/onboarding)
- エージェント初回実行の儀式: [Agent Bootstrapping](/start/bootstrapping)
