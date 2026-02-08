---
summary: 「テストをローカルで実行する方法（vitest）と、force／coverage モードを使用する場面」
read_when:
  - テストを実行または修正する際
title: 「テスト」
x-i18n:
  source_path: reference/test.md
  source_hash: be7b751fb81c8c94
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:57Z
---

# テスト

- フルテストキット（スイート、ライブ、Docker）: [Testing](/testing)

- `pnpm test:force`: 既定の制御ポートを保持している残存 Gateway（ゲートウェイ）プロセスをすべて終了し、その後、分離された Gateway（ゲートウェイ）ポートで Vitest のフルスイートを実行します。これにより、サーバーテストが実行中のインスタンスと衝突するのを防ぎます。以前の Gateway（ゲートウェイ）実行によってポート 18789 が占有されたままの場合に使用してください。
- `pnpm test:coverage`: V8 カバレッジを有効にして Vitest を実行します。グローバルしきい値は、lines／branches／functions／statements がそれぞれ 70% です。カバレッジからは、統合依存の大きいエントリーポイント（CLI の配線、gateway/telegram ブリッジ、webchat の静的サーバー）を除外し、ユニットテスト可能なロジックに焦点を当てています。
- `pnpm test:e2e`: Gateway（ゲートウェイ）のエンドツーエンド・スモークテスト（複数インスタンスの WS／HTTP／node のペアリング）を実行します。
- `pnpm test:live`: プロバイダーのライブテスト（minimax／zai）を実行します。API キーと、スキップ解除のために `LIVE=1`（またはプロバイダー固有の `*_LIVE_TEST=1`）が必要です。

## モデルレイテンシー ベンチ（ローカルキー）

スクリプト: [`scripts/bench-model.ts`](https://github.com/openclaw/openclaw/blob/main/scripts/bench-model.ts)

使用方法:

- `source ~/.profile && pnpm tsx scripts/bench-model.ts --runs 10`
- 任意の環境変数: `MINIMAX_API_KEY`, `MINIMAX_BASE_URL`, `MINIMAX_MODEL`, `ANTHROPIC_API_KEY`
- 既定のプロンプト: 「単語 1 つで返信してください: ok。句読点や余分なテキストは不要です。」

最終実行（2025-12-31、20 回）:

- minimax 中央値 1279ms（最小 1114、最大 2431）
- opus 中央値 2454ms（最小 1224、最大 3170）

## オンボーディング E2E（Docker）

Docker は任意です。これはコンテナ化されたオンボーディングのスモークテストにのみ必要です。

クリーンな Linux コンテナでのフルコールドスタートフロー:

```bash
scripts/e2e/onboard-docker.sh
```

このスクリプトは疑似 TTY を介して対話型ウィザードを操作し、設定／ワークスペース／セッションの各ファイルを検証した後、Gateway（ゲートウェイ）を起動して `openclaw health` を実行します。

## QR インポート スモーク（Docker）

Docker 上の Node 22+ で `qrcode-terminal` が読み込まれることを確認します:

```bash
pnpm test:docker:qr
```
