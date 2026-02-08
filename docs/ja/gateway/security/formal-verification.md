---
title: 形式検証（セキュリティモデル）
summary: OpenClaw の最高リスク経路に対する機械検証済みセキュリティモデル。
permalink: /security/formal-verification/
x-i18n:
  source_path: gateway/security/formal-verification.md
  source_hash: 8dff6ea41a37fb6b
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:31:53Z
---

# 形式検証（セキュリティモデル）

このページでは、OpenClaw の **形式的セキュリティモデル**（現時点では TLA+/TLC。必要に応じて追加）を追跡します。

> 注記：一部の古いリンクは、以前のプロジェクト名を参照している場合があります。

**目標（ノーススター）：** 明示的な前提の下で、OpenClaw が意図したセキュリティポリシー（認可、セッション分離、ツールのゲーティング、設定不備に対する安全性）を強制していることについて、機械検証された主張を提供することです。

**これは何か（現時点）：** 実行可能で、攻撃者主導の **セキュリティ回帰スイート** です。

- 各主張には、有限状態空間に対する実行可能なモデル検査があります。
- 多くの主張には、現実的なバグクラスに対する反例トレースを生成する、対になる **ネガティブモデル** があります。

**これは何ではないか（まだ）：** 「OpenClaw はあらゆる点で安全である」という証明、あるいは完全な TypeScript 実装が正しいという証明ではありません。

## モデルの所在

モデルは別リポジトリで管理されています：[vignesh07/openclaw-formal-models](https://github.com/vignesh07/openclaw-formal-models)。

## 重要な注意点

- これらは **モデル** であり、完全な TypeScript 実装ではありません。モデルとコードの乖離が生じる可能性があります。
- 結果は TLC が探索する状態空間に制約されます。「グリーン」は、モデル化された前提や境界を超えた安全性を意味しません。
- 一部の主張は、明示的な環境上の前提（例：正しいデプロイ、正しい設定入力）に依存します。

## 結果の再現

現時点では、モデルのリポジトリをローカルにクローンし、TLC を実行することで結果を再現します（下記参照）。将来の反復では、次を提供できる可能性があります。

- 公開アーティファクト（反例トレース、実行ログ）を伴う CI 実行モデル
- 小規模で境界付きの検査向けに「このモデルを実行する」ホステッドワークフロー

はじめに：

```bash
git clone https://github.com/vignesh07/openclaw-formal-models
cd openclaw-formal-models

# Java 11+ required (TLC runs on the JVM).
# The repo vendors a pinned `tla2tools.jar` (TLA+ tools) and provides `bin/tlc` + Make targets.

make <target>
```

### Gateway（ゲートウェイ）の公開範囲とオープンなゲートウェイ設定不備

**主張：** 認証なしで loopback を超えてバインドすると、リモート侵害が可能になる／露出が増大します。トークン／パスワードは、モデルの前提に基づき、未認証の攻撃者をブロックします。

- グリーン実行：
  - `make gateway-exposure-v2`
  - `make gateway-exposure-v2-protected`
- レッド（想定どおり）：
  - `make gateway-exposure-v2-negative`

併せて参照：モデルリポジトリ内の `docs/gateway-exposure-matrix.md`。

### Nodes.run パイプライン（最高リスクの機能）

**主張：** `nodes.run` には、（a）ノードコマンドの許可リストと宣言済みコマンド、（b）設定時のライブ承認が必要です。承認は、（モデル上で）リプレイ防止のためトークン化されます。

- グリーン実行：
  - `make nodes-pipeline`
  - `make approvals-token`
- レッド（想定どおり）：
  - `make nodes-pipeline-negative`
  - `make approvals-token-negative`

### ペアリングストア（DM ゲーティング）

**主張：** ペアリング要求は、TTL と保留リクエストの上限を尊重します。

- グリーン実行：
  - `make pairing`
  - `make pairing-cap`
- レッド（想定どおり）：
  - `make pairing-negative`
  - `make pairing-cap-negative`

### 入口（Ingress）のゲーティング（メンション + 制御コマンドのバイパス）

**主張：** メンションが必要なグループコンテキストにおいて、未認可の「制御コマンド」はメンションゲーティングを回避できません。

- グリーン：
  - `make ingress-gating`
- レッド（想定どおり）：
  - `make ingress-gating-negative`

### ルーティング／セッションキーの分離

**主張：** 明示的にリンク／設定されない限り、異なるピアからのダイレクトメッセージは同一セッションに統合されません。

- グリーン：
  - `make routing-isolation`
- レッド（想定どおり）：
  - `make routing-isolation-negative`

## v1++：追加の境界付きモデル（並行性、リトライ、トレース正確性）

これらは、実世界の障害モード（非原子的更新、リトライ、メッセージのファンアウト）に対する忠実度を高める後続モデルです。

### ペアリングストアの並行性／冪等性

**主張：** ペアリングストアは、インターリービング下でも `MaxPending` と冪等性を強制すべきです（すなわち、「チェックしてから書き込む」は原子的／ロックされている必要があり、更新で重複を作ってはなりません）。

意味するところ：

- 並行リクエスト下で、チャンネルあたりの `MaxPending` を超過できません。
- 同一の `(channel, sender)` に対する繰り返しの要求／更新は、重複した有効な保留行を作成してはなりません。

- グリーン実行：
  - `make pairing-race`（原子的／ロック付きの上限チェック）
  - `make pairing-idempotency`
  - `make pairing-refresh`
  - `make pairing-refresh-race`
- レッド（想定どおり）：
  - `make pairing-race-negative`（非原子的な begin/commit による上限競合）
  - `make pairing-idempotency-negative`
  - `make pairing-refresh-negative`
  - `make pairing-refresh-race-negative`

### Ingress のトレース相関／冪等性

**主張：** 取り込みは、ファンアウト全体でトレース相関を保持し、プロバイダーのリトライ下で冪等であるべきです。

意味するところ：

- 1 つの外部イベントが複数の内部メッセージになる場合、すべての要素が同一のトレース／イベント ID を保持します。
- リトライによって二重処理が発生しません。
- プロバイダーのイベント ID が欠落している場合、重複排除は安全なキー（例：トレース ID）にフォールバックし、異なるイベントの欠落を防ぎます。

- グリーン：
  - `make ingress-trace`
  - `make ingress-trace2`
  - `make ingress-idempotency`
  - `make ingress-dedupe-fallback`
- レッド（想定どおり）：
  - `make ingress-trace-negative`
  - `make ingress-trace2-negative`
  - `make ingress-idempotency-negative`
  - `make ingress-dedupe-fallback-negative`

### ルーティングの dmScope 優先順位 + identityLinks

**主張：** ルーティングは、既定では DM セッションを分離したままにし、明示的に設定された場合にのみ（チャンネル優先順位 + identity links）セッションを統合しなければなりません。

意味するところ：

- チャンネル固有の dmScope 上書きは、グローバル既定より優先される必要があります。
- identityLinks は、無関係なピアをまたがらず、明示的にリンクされたグループ内でのみ統合すべきです。

- グリーン：
  - `make routing-precedence`
  - `make routing-identitylinks`
- レッド（想定どおり）：
  - `make routing-precedence-negative`
  - `make routing-identitylinks-negative`
