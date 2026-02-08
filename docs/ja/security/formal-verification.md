---
title: 形式検証（セキュリティモデル）
summary: OpenClaw の高リスク経路に対する機械検証済みセキュリティモデル。
permalink: /security/formal-verification/
x-i18n:
  source_path: security/formal-verification.md
  source_hash: 8dff6ea41a37fb6b
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:35:07Z
---

# 形式検証（セキュリティモデル）

このページでは、OpenClaw の **形式的セキュリティモデル**（現在は TLA+/TLC、必要に応じて追加）を追跡します。

> 注: 一部の古いリンクは、以前のプロジェクト名を参照している場合があります。

**目標（ノーススター）:** 明示的な前提条件の下で、OpenClaw が意図したセキュリティポリシー（認可、セッション分離、ツールのゲーティング、誤設定の安全性）を強制していることを、機械検証により示します。

**これは何か（現時点）:** 実行可能で攻撃者主導の **セキュリティ回帰スイート** です。

- 各主張には、有限状態空間に対する実行可能なモデルチェックがあります。
- 多くの主張には、現実的なバグクラスに対する反例トレースを生成する **ネガティブモデル** が対になっています。

**これは何ではないか（まだ）:** 「OpenClaw はあらゆる点で安全である」という証明、あるいは TypeScript 実装全体が正しいという証明ではありません。

## モデルの所在

モデルは別リポジトリで管理されています: [vignesh07/openclaw-formal-models](https://github.com/vignesh07/openclaw-formal-models)。

## 重要な注意点

- これらは **モデル** であり、完全な TypeScript 実装ではありません。モデルとコードの乖離が生じる可能性があります。
- 結果は TLC が探索する状態空間に制約されます。「グリーン」であっても、モデル化された前提と境界を超える安全性を意味するものではありません。
- 一部の主張は、明示的な環境上の前提（例: 正しいデプロイ、正しい設定入力）に依存します。

## 結果の再現

現在、結果はモデルリポジトリをローカルにクローンし、TLC を実行することで再現します（以下参照）。将来的な反復では、次の提供を検討しています。

- CI で実行されるモデルと公開アーティファクト（反例トレース、実行ログ）
- 小規模で境界付きのチェック向けの「このモデルを実行」するホスト型ワークフロー

はじめに:

```bash
git clone https://github.com/vignesh07/openclaw-formal-models
cd openclaw-formal-models

# Java 11+ required (TLC runs on the JVM).
# The repo vendors a pinned `tla2tools.jar` (TLA+ tools) and provides `bin/tlc` + Make targets.

make <target>
```

### Gateway（ゲートウェイ）の公開とオープンゲートウェイの誤設定

**主張:** 認証なしで loopback を超えてバインドすると、リモート侵害が可能になる／露出が増大します。トークン／パスワードは、（モデルの前提に基づき）未認証の攻撃者をブロックします。

- グリーン実行:
  - `make gateway-exposure-v2`
  - `make gateway-exposure-v2-protected`
- レッド（想定どおり）:
  - `make gateway-exposure-v2-negative`

あわせて参照: モデルリポジトリ内の `docs/gateway-exposure-matrix.md`。

### Nodes.run パイプライン（最高リスクの機能）

**主張:** `nodes.run` には、(a) ノードコマンドの allowlist と宣言済みコマンド、(b) 設定時のライブ承認が必要です。承認は（モデル上）リプレイ防止のためトークン化されています。

- グリーン実行:
  - `make nodes-pipeline`
  - `make approvals-token`
- レッド（想定どおり）:
  - `make nodes-pipeline-negative`
  - `make approvals-token-negative`

### ペアリングストア（ダイレクトメッセージのゲーティング）

**主張:** ペアリング要求は TTL と保留中要求数の上限を遵守します。

- グリーン実行:
  - `make pairing`
  - `make pairing-cap`
- レッド（想定どおり）:
  - `make pairing-negative`
  - `make pairing-cap-negative`

### インバウンドのゲーティング（メンション + 制御コマンドのバイパス）

**主張:** メンションを要求するグループ文脈において、未認可の「制御コマンド」はメンションゲーティングを回避できません。

- グリーン:
  - `make ingress-gating`
- レッド（想定どおり）:
  - `make ingress-gating-negative`

### ルーティング／セッションキーの分離

**主張:** 明示的にリンク／設定されない限り、異なるピアからのダイレクトメッセージは同一セッションに統合されません。

- グリーン:
  - `make routing-isolation`
- レッド（想定どおり）:
  - `make routing-isolation-negative`

## v1++: 追加の境界付きモデル（並行性、リトライ、トレース正確性）

これらは、現実世界の障害モード（非アトミック更新、リトライ、メッセージのファンアウト）に関する忠実度を高める追補モデルです。

### ペアリングストアの並行性／冪等性

**主張:** ペアリングストアは、インターリーブがあっても `MaxPending` と冪等性を強制すべきです（すなわち「チェックしてから書き込む」はアトミック／ロックされている必要があり、更新は重複を作ってはなりません）。

意味するところ:

- 並行リクエスト下でも、チャンネルあたりの `MaxPending` を超えることはできません。
- 同一の `(channel, sender)` に対する繰り返しの要求／更新は、重複した有効な保留行を作成してはなりません。

- グリーン実行:
  - `make pairing-race`（アトミック／ロックされた上限チェック）
  - `make pairing-idempotency`
  - `make pairing-refresh`
  - `make pairing-refresh-race`
- レッド（想定どおり）:
  - `make pairing-race-negative`（非アトミックな begin/commit による上限競合）
  - `make pairing-idempotency-negative`
  - `make pairing-refresh-negative`
  - `make pairing-refresh-race-negative`

### インバウンドのトレース相関／冪等性

**主張:** 取り込みは、ファンアウト全体でトレース相関を保持し、プロバイダーのリトライに対して冪等であるべきです。

意味するところ:

- 1 つの外部イベントが複数の内部メッセージになる場合でも、すべての部分が同一のトレース／イベント ID を保持します。
- リトライによって二重処理が発生しません。
- プロバイダーのイベント ID が欠落している場合、重複排除は安全なキー（例: トレース ID）にフォールバックし、異なるイベントを誤って破棄しないようにします。

- グリーン:
  - `make ingress-trace`
  - `make ingress-trace2`
  - `make ingress-idempotency`
  - `make ingress-dedupe-fallback`
- レッド（想定どおり）:
  - `make ingress-trace-negative`
  - `make ingress-trace2-negative`
  - `make ingress-idempotency-negative`
  - `make ingress-dedupe-fallback-negative`

### ルーティングの dmScope 優先順位 + identityLinks

**主張:** ルーティングは、既定では DM セッションを分離したままにし、明示的に設定された場合にのみセッションを統合すべきです（チャンネル優先順位 + identity links）。

意味するところ:

- チャンネル固有の dmScope 上書きは、グローバル既定よりも優先される必要があります。
- identityLinks は、明示的にリンクされたグループ内でのみ統合を行い、無関係なピア間では行ってはなりません。

- グリーン:
  - `make routing-precedence`
  - `make routing-identitylinks`
- レッド（想定どおり）:
  - `make routing-precedence-negative`
  - `make routing-identitylinks-negative`
