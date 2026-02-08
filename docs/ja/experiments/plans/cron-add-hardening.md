---
summary: "cron.add の入力処理を堅牢化し、スキーマを整合させ、cron の UI/エージェントツールを改善します"
owner: "openclaw"
status: "complete"
last_updated: "2026-01-05"
title: "Cron Add の堅牢化"
x-i18n:
  source_path: experiments/plans/cron-add-hardening.md
  source_hash: d7e469674bd9435b
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:19:20Z
---

# Cron Add の堅牢化とスキーマ整合

## コンテキスト

最近の Gateway（ゲートウェイ）ログでは、無効なパラメータ（`sessionTarget`、`wakeMode`、`payload` の欠落、および `schedule` の不正形式）により、`cron.add` の失敗が繰り返し発生していることが示されています。これは、少なくとも 1 つのクライアント（おそらくエージェントのツール呼び出し経路）が、ラップされた、または部分的に指定されたジョブペイロードを送信していることを示します。別途、TypeScript、Gateway（ゲートウェイ）スキーマ、CLI フラグ、UI フォーム型の間で cron プロバイダー enum に乖離があり、さらに `cron.status` について UI の不一致（Gateway（ゲートウェイ）は `jobs` を返す一方で、UI は `jobCount` を期待）が存在します。

## 目標

- 一般的なラッパーペイロードを正規化し、欠落している `kind` フィールドを推論することで、`cron.add` INVALID_REQUEST スパムを停止します。
- Gateway（ゲートウェイ）スキーマ、cron 型、CLI ドキュメント、UI フォーム間で cron プロバイダーのリストを整合させます。
- LLM が正しいジョブペイロードを生成できるよう、エージェントの cron ツールスキーマを明示的にします。
- Control UI の cron ステータスのジョブ数表示を修正します。
- 正規化およびツール挙動をカバーするテストを追加します。

## 非目標

- cron のスケジューリングセマンティクスまたはジョブ実行挙動を変更しません。
- 新しいスケジュール種別や cron 式パースを追加しません。
- 必要なフィールド修正を超えて、cron の UI/UX を刷新しません。

## 調査結果（現状のギャップ）

- Gateway（ゲートウェイ）の `CronPayloadSchema` は `signal` + `imessage` を除外している一方で、TS 型にはそれらが含まれています。
- Control UI の CronStatus は `jobCount` を期待しますが、Gateway（ゲートウェイ）は `jobs` を返します。
- エージェントの cron ツールスキーマは任意の `job` オブジェクトを許容しており、不正形式の入力を可能にしています。
- Gateway（ゲートウェイ）は正規化なしで `cron.add` を厳密に検証するため、ラップされたペイロードは失敗します。

## 変更点

- `cron.add` と `cron.update` は、一般的なラッパー形状を正規化し、欠落している `kind` フィールドを推論するようになりました。
- エージェントの cron ツールスキーマは Gateway（ゲートウェイ）スキーマに一致し、これにより無効なペイロードが減少します。
- プロバイダー enum は Gateway（ゲートウェイ）、CLI、UI、macOS ピッカー間で整合されました。
- Control UI は、ステータスに Gateway（ゲートウェイ）の `jobs` カウントフィールドを使用します。

## 現在の挙動

- **正規化:** ラップされた `data`/`job` ペイロードはアンラップされます。安全な場合は `schedule.kind` と `payload.kind` が推論されます。
- **デフォルト:** 欠落している場合、`wakeMode` と `sessionTarget` には安全なデフォルトが適用されます。
- **プロバイダー:** Discord/Slack/Signal/iMessage は CLI/UI 全体で一貫して表示されるようになりました。

正規化された形状と例については、[Cron jobs](/automation/cron-jobs) を参照してください。

## 検証

- Gateway（ゲートウェイ）ログを監視し、`cron.add` INVALID_REQUEST エラーの減少を確認します。
- Control UI の cron ステータスが、更新後にジョブ数を表示することを確認します。

## 任意のフォローアップ

- Control UI の手動スモーク: プロバイダーごとに cron ジョブを追加し、ステータスのジョブ数を検証します。

## 未解決の質問

- `cron.add` は、クライアントから明示的な `state` を受け付けるべきでしょうか（現在はスキーマで不許可）？
- `webchat` を明示的な配信プロバイダーとして許可すべきでしょうか（現在は配信解決でフィルタリングされています）？
