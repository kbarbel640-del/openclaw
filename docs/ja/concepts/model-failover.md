---
summary: "OpenClaw が認証プロファイルをローテーションし、モデル間でフォールバックする方法"
read_when:
  - 認証プロファイルのローテーション、クールダウン、またはモデルフォールバックの挙動を診断する場合
  - 認証プロファイルまたはモデルのフェイルオーバールールを更新する場合
title: "モデルフェイルオーバー"
x-i18n:
  source_path: concepts/model-failover.md
  source_hash: eab7c0633824d941
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:05:41Z
---

# モデルフェイルオーバー

OpenClaw は障害を 2 段階で処理します。

1. 現在のプロバイダー内での **認証プロファイルのローテーション**。
2. `agents.defaults.model.fallbacks` 内の次のモデルへの **モデルフォールバック**。

このドキュメントでは、ランタイムのルールと、それを裏付けるデータについて説明します。

## 認証ストレージ（キー + OAuth）

OpenClaw は、API キーと OAuth トークンの両方に **認証プロファイル** を使用します。

- シークレットは `~/.openclaw/agents/<agentId>/agent/auth-profiles.json`（レガシー: `~/.openclaw/agent/auth-profiles.json`）に保存されます。
- 設定 `auth.profiles` / `auth.order` は **メタデータ + ルーティング専用** です（シークレットは含みません）。
- レガシーのインポート専用 OAuth ファイル: `~/.openclaw/credentials/oauth.json`（初回使用時に `auth-profiles.json` にインポートされます）。

詳細: [/concepts/oauth](/concepts/oauth)

認証情報の種類:

- `type: "api_key"` → `{ provider, key }`
- `type: "oauth"` → `{ provider, access, refresh, expires, email? }`（一部のプロバイダーでは `projectId`/`enterpriseUrl` も）

## プロファイル ID

OAuth ログインでは、複数アカウントを共存できるように、個別のプロファイルが作成されます。

- デフォルト: メールアドレスが利用できない場合は `provider:default`。
- メールアドレス付き OAuth: `provider:<email>`（例: `google-antigravity:user@gmail.com`）。

プロファイルは `~/.openclaw/agents/<agentId>/agent/auth-profiles.json` の `profiles` 配下に保存されます。

## ローテーション順序

プロバイダーに複数のプロファイルがある場合、OpenClaw は次のように順序を選びます。

1. **明示的な設定**: `auth.order[provider]`（設定されている場合）。
2. **設定済みプロファイル**: プロバイダーでフィルタした `auth.profiles`。
3. **保存済みプロファイル**: プロバイダーに対する `auth-profiles.json` 内のエントリー。

明示的な順序が設定されていない場合、OpenClaw はラウンドロビン順序を使用します。

- **一次キー:** プロファイル種別（**OAuth が API キーより先**）。
- **二次キー:** `usageStats.lastUsed`（種別ごとに古い順）。
- **クールダウン中/無効化されたプロファイル** は末尾に移動され、期限が最も早い順に並びます。

### セッションのスティッキー（キャッシュフレンドリー）

OpenClaw はプロバイダーのキャッシュを温めた状態に保つため、**セッションごとに選択された認証プロファイルを固定** します。
各リクエストごとにはローテーションしません。固定されたプロファイルは、次の場合まで再利用されます。

- セッションがリセットされる（`/new` / `/reset`）
- コンパクションが完了する（コンパクション回数が増加する）
- プロファイルがクールダウン中/無効化される

`/model …@<profileId>` による手動選択は、そのセッションの **ユーザーオーバーライド** を設定し、
新しいセッションが開始されるまで自動ローテーションされません。

自動固定されたプロファイル（セッションルーターが選択）は **優先** として扱われます。
まずそれが試されますが、レート制限/タイムアウト時には OpenClaw が別のプロファイルへローテーションする場合があります。
ユーザー固定のプロファイルはそのプロファイルにロックされたままです。失敗し、かつモデルフォールバックが設定されている場合、
OpenClaw はプロファイルを切り替える代わりに次のモデルへ移動します。

### OAuth が「消えたように見える」理由

同一プロバイダーに対して OAuth プロファイルと API キーのプロファイルの両方がある場合、固定しない限り、ラウンドロビンによりメッセージ間でそれらが切り替わることがあります。単一のプロファイルを強制するには:

- `auth.order[provider] = ["provider:profileId"]` で固定する、または
- `/model …` によるセッション単位のオーバーライドで、プロファイルオーバーライドを使用します（UI/チャット画面が対応している場合）。

## クールダウン

認証/レート制限エラー（またはレート制限に見えるタイムアウト）でプロファイルが失敗すると、OpenClaw はそれをクールダウンとしてマークし、次のプロファイルへ移動します。
フォーマット/無効リクエストのエラー（例: Cloud Code Assist ツール呼び出し ID の検証失敗）は、フェイルオーバー対象として扱われ、同じクールダウンが適用されます。

クールダウンは指数バックオフを使用します。

- 1 分
- 5 分
- 25 分
- 1 時間（上限）

状態は `auth-profiles.json` の `usageStats` 配下に保存されます。

```json
{
  "usageStats": {
    "provider:profile": {
      "lastUsed": 1736160000000,
      "cooldownUntil": 1736160600000,
      "errorCount": 2
    }
  }
}
```

## 課金による無効化

課金/クレジットの失敗（例: 「insufficient credits」/「credit balance too low」）はフェイルオーバー対象として扱われますが、通常は一時的ではありません。短いクールダウンの代わりに、OpenClaw はプロファイルを **無効化**（より長いバックオフ）としてマークし、次のプロファイル/プロバイダーへローテーションします。

状態は `auth-profiles.json` に保存されます。

```json
{
  "usageStats": {
    "provider:profile": {
      "disabledUntil": 1736178000000,
      "disabledReason": "billing"
    }
  }
}
```

デフォルト:

- 課金バックオフは **5 時間** から開始し、課金失敗ごとに倍増し、**24 時間** で上限になります。
- プロファイルが **24 時間** 失敗していない場合、バックオフカウンターはリセットされます（設定可能）。

## モデルフォールバック

プロバイダーのすべてのプロファイルが失敗した場合、OpenClaw は `agents.defaults.model.fallbacks` 内の次のモデルへ移動します。これは認証失敗、レート制限、およびプロファイルローテーションを使い切ったタイムアウトに適用されます（その他のエラーではフォールバックは進みません）。

実行がモデルオーバーライド（フックまたは CLI）で開始された場合でも、フォールバックは設定されたフォールバックを試した後、`agents.defaults.model.primary` で終了します。

## 関連設定

以下については [Gateway 設定](/gateway/configuration) を参照してください。

- `auth.profiles` / `auth.order`
- `auth.cooldowns.billingBackoffHours` / `auth.cooldowns.billingBackoffHoursByProvider`
- `auth.cooldowns.billingMaxHours` / `auth.cooldowns.failureWindowHours`
- `agents.defaults.model.primary` / `agents.defaults.model.fallbacks`
- `agents.defaults.imageModel` ルーティング

より広いモデル選択とフォールバックの概要については [Models](/concepts/models) を参照してください。
