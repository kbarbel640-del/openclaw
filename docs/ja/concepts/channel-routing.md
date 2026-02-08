---
summary: "チャンネル（WhatsApp、Telegram、Discord、Slack）ごとのルーティングルールと共有コンテキスト"
read_when:
  - チャンネルルーティングまたは受信箱の挙動を変更する場合
title: "チャンネルルーティング"
x-i18n:
  source_path: concepts/channel-routing.md
  source_hash: 1a322b5187e32c82
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:01:56Z
---

# チャンネルとルーティング

OpenClaw は、**メッセージが届いたチャンネルに返信を返します**。モデルがチャンネルを選ぶことはありません。ルーティングは決定的であり、ホストの設定によって制御されます。

## 主要用語

- **Channel**: `whatsapp`、`telegram`、`discord`、`slack`、`signal`、`imessage`、`webchat`。
- **AccountId**: チャンネルごとのアカウントインスタンス（サポートされる場合）。
- **AgentId**: 分離されたワークスペース + セッションストア（「脳」）。
- **SessionKey**: コンテキストを保存し、並行性を制御するために使用されるバケットキーです。

## セッションキーの形（例）

ダイレクトメッセージは、エージェントの **メイン** セッションに集約されます。

- `agent:<agentId>:<mainKey>`（デフォルト: `agent:main:main`）

グループとチャンネルは、チャンネルごとに分離されたままです。

- グループ: `agent:<agentId>:<channel>:group:<id>`
- チャンネル/ルーム: `agent:<agentId>:<channel>:channel:<id>`

スレッド:

- Slack/Discord のスレッドは、ベースキーに `:thread:<threadId>` を追加します。
- Telegram のフォーラムトピックは、グループキーに `:topic:<topicId>` を埋め込みます。

例:

- `agent:main:telegram:group:-1001234567890:topic:42`
- `agent:main:discord:channel:123456:thread:987654`

## ルーティングルール（エージェントがどのように選ばれるか）

ルーティングは、各インバウンドメッセージに対して **1 つのエージェント** を選びます。

1. **完全一致のピアマッチ**（`bindings` を `peer.kind` + `peer.id` で一致）。
2. **ギルドマッチ**（Discord）を `guildId` 経由で行います。
3. **チームマッチ**（Slack）を `teamId` 経由で行います。
4. **アカウントマッチ**（そのチャンネル上の `accountId`）。
5. **チャンネルマッチ**（そのチャンネル上の任意のアカウント）。
6. **デフォルトエージェント**（`agents.list[].default`、それ以外は最初のリストエントリ、フォールバックは `main`）。

一致したエージェントによって、使用されるワークスペースとセッションストアが決まります。

## ブロードキャストグループ（複数エージェントを実行）

ブロードキャストグループを使うと、OpenClaw が通常返信する場面で（例: WhatsApp グループにおいて、メンション/アクティベーションのゲーティング後に）、同じピアに対して **複数のエージェント** を実行できます。

設定:

```json5
{
  broadcast: {
    strategy: "parallel",
    "120363403215116621@g.us": ["alfred", "baerbel"],
    "+15555550123": ["support", "logger"],
  },
}
```

参照: [Broadcast Groups](/broadcast-groups)。

## 設定の概要

- `agents.list`: 名前付きのエージェント定義（ワークスペース、モデルなど）。
- `bindings`: インバウンドのチャンネル/アカウント/ピアをエージェントにマッピングします。

例:

```json5
{
  agents: {
    list: [{ id: "support", name: "Support", workspace: "~/.openclaw/workspace-support" }],
  },
  bindings: [
    { match: { channel: "slack", teamId: "T123" }, agentId: "support" },
    { match: { channel: "telegram", peer: { kind: "group", id: "-100123" } }, agentId: "support" },
  ],
}
```

## セッションストレージ

セッションストアは、状態ディレクトリ（デフォルト `~/.openclaw`）の配下に置かれます。

- `~/.openclaw/agents/<agentId>/sessions/sessions.json`
- JSONL トランスクリプトはストアと並んで保存されます

`session.store` と `{agentId}` のテンプレート化により、ストアパスを上書きできます。

## WebChat の挙動

WebChat は **選択されたエージェント** にアタッチされ、デフォルトでエージェントのメインセッションになります。このため、WebChat では、そのエージェントのクロスチャンネルコンテキストを 1 か所で確認できます。

## 返信コンテキスト

インバウンド返信には、以下が含まれます。

- 利用可能な場合は `ReplyToId`、`ReplyToBody`、および `ReplyToSender`。
- 引用コンテキストは、`[Replying to ...]` ブロックとして `Body` に追加されます。

これはチャンネル間で一貫しています。
