---
summary: "OpenClaw で MiniMax M2.1 を使用します"
read_when:
  - OpenClaw で MiniMax モデルを使いたい場合
  - MiniMax のセットアップ手順が必要な場合
title: "MiniMax"
x-i18n:
  source_path: providers/minimax.md
  source_hash: 5bbd47fa3327e40c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:44Z
---

# MiniMax

MiniMax は、**M2/M2.1** モデルファミリーを開発する AI 企業です。現在の
コーディング指向のリリースは **MiniMax M2.1**（2025 年 12 月 23 日）で、
現実世界の複雑なタスク向けに構築されています。

出典: [MiniMax M2.1 リリースノート](https://www.minimax.io/news/minimax-m21)

## モデル概要（M2.1）

MiniMax は、M2.1 における以下の改善点を強調しています。

- **多言語コーディング**（Rust、Java、Go、C++、Kotlin、Objective-C、TS/JS）の強化。
- **Web/アプリ開発**および美的な出力品質の向上（ネイティブモバイルを含む）。
- オフィス系ワークフロー向けの **複合指示** 処理の改善。インターリーブされた思考と統合された制約実行を基盤としています。
- トークン使用量を抑え、反復ループを高速化する **より簡潔な応答**。
- **ツール/エージェントフレームワーク** との互換性およびコンテキスト管理の強化（Claude Code、Droid/Factory AI、Cline、Kilo Code、Roo Code、BlackBox）。
- **対話および技術文書作成** の出力品質向上。

## MiniMax M2.1 と MiniMax M2.1 Lightning の比較

- **速度:** Lightning は、MiniMax の料金ドキュメントにおける「高速」バリアントです。
- **コスト:** 料金では入力コストは同一ですが、Lightning は出力コストが高くなります。
- **コーディングプランのルーティング:** Lightning のバックエンドは、MiniMax の
  コーディングプランでは直接利用できません。MiniMax は多くのリクエストを Lightning に自動ルーティングしますが、トラフィックスパイク時には通常の M2.1 バックエンドにフォールバックします。

## セットアップを選択する

### MiniMax OAuth（コーディングプラン）— 推奨

**最適な用途:** OAuth 経由で MiniMax コーディングプランを使用する迅速なセットアップ。API キーは不要です。

同梱の OAuth プラグインを有効化して認証します。

```bash
openclaw plugins enable minimax-portal-auth  # skip if already loaded.
openclaw gateway restart  # restart if gateway is already running
openclaw onboard --auth-choice minimax-portal
```

エンドポイントの選択を求められます。

- **Global** - 海外ユーザー向け（`api.minimax.io`）
- **CN** - 中国国内ユーザー向け（`api.minimaxi.com`）

詳細は [MiniMax OAuth プラグイン README](https://github.com/openclaw/openclaw/tree/main/extensions/minimax-portal-auth) を参照してください。

### MiniMax M2.1（API キー）

**最適な用途:** Anthropic 互換 API を備えたホステッド MiniMax。

CLI で設定します。

- `openclaw configure` を実行します。
- **Model/auth** を選択します。
- **MiniMax M2.1** を選択します。

```json5
{
  env: { MINIMAX_API_KEY: "sk-..." },
  agents: { defaults: { model: { primary: "minimax/MiniMax-M2.1" } } },
  models: {
    mode: "merge",
    providers: {
      minimax: {
        baseUrl: "https://api.minimax.io/anthropic",
        apiKey: "${MINIMAX_API_KEY}",
        api: "anthropic-messages",
        models: [
          {
            id: "MiniMax-M2.1",
            name: "MiniMax M2.1",
            reasoning: false,
            input: ["text"],
            cost: { input: 15, output: 60, cacheRead: 2, cacheWrite: 10 },
            contextWindow: 200000,
            maxTokens: 8192,
          },
        ],
      },
    },
  },
}
```

### MiniMax M2.1 をフォールバックとして使用（Opus をプライマリ）

**最適な用途:** Opus 4.6 をプライマリに維持し、MiniMax M2.1 にフェイルオーバーします。

```json5
{
  env: { MINIMAX_API_KEY: "sk-..." },
  agents: {
    defaults: {
      models: {
        "anthropic/claude-opus-4-6": { alias: "opus" },
        "minimax/MiniMax-M2.1": { alias: "minimax" },
      },
      model: {
        primary: "anthropic/claude-opus-4-6",
        fallbacks: ["minimax/MiniMax-M2.1"],
      },
    },
  },
}
```

### 任意: LM Studio 経由のローカル実行（手動）

**最適な用途:** LM Studio によるローカル推論。
強力なハードウェア（例: デスクトップ/サーバー）で LM Studio のローカルサーバーを使用した MiniMax M2.1 において、良好な結果が確認されています。

`openclaw.json` を介して手動で設定します。

```json5
{
  agents: {
    defaults: {
      model: { primary: "lmstudio/minimax-m2.1-gs32" },
      models: { "lmstudio/minimax-m2.1-gs32": { alias: "Minimax" } },
    },
  },
  models: {
    mode: "merge",
    providers: {
      lmstudio: {
        baseUrl: "http://127.0.0.1:1234/v1",
        apiKey: "lmstudio",
        api: "openai-responses",
        models: [
          {
            id: "minimax-m2.1-gs32",
            name: "MiniMax M2.1 GS32",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 196608,
            maxTokens: 8192,
          },
        ],
      },
    },
  },
}
```

## `openclaw configure` で設定する

JSON を編集せずに、対話型設定ウィザードを使用して MiniMax を設定します。

1. `openclaw configure` を実行します。
2. **Model/auth** を選択します。
3. **MiniMax M2.1** を選択します。
4. プロンプトが表示されたら、既定のモデルを選択します。

## 設定オプション

- `models.providers.minimax.baseUrl`: `https://api.minimax.io/anthropic`（Anthropic 互換）を推奨します。`https://api.minimax.io/v1` は OpenAI 互換ペイロード用として任意です。
- `models.providers.minimax.api`: `anthropic-messages` を推奨します。`openai-completions` は OpenAI 互換ペイロード用として任意です。
- `models.providers.minimax.apiKey`: MiniMax API キー（`MINIMAX_API_KEY`）。
- `models.providers.minimax.models`: `id`、`name`、`reasoning`、`contextWindow`、`maxTokens`、`cost` を定義します。
- `agents.defaults.models`: 許可リストに含めたいモデルにエイリアスを設定します。
- `models.mode`: 組み込みと並行して MiniMax を追加したい場合は、`merge` を保持します。

## 注意事項

- モデル参照は `minimax/<model>` です。
- コーディングプランの使用量 API: `https://api.minimaxi.com/v1/api/openplatform/coding_plan/remains`（コーディングプランのキーが必要です）。
- 正確なコスト追跡が必要な場合は、`models.json` の価格値を更新してください。
- MiniMax コーディングプランの紹介リンク（10% 割引）: https://platform.minimax.io/subscribe/coding-plan?code=DbXJTRClnb&source=link
- プロバイダーのルールについては [/concepts/model-providers](/concepts/model-providers) を参照してください。
- 切り替えには `openclaw models list` と `openclaw models set minimax/MiniMax-M2.1` を使用します。

## トラブルシューティング

### 「Unknown model: minimax/MiniMax-M2.1」

これは通常、**MiniMax プロバイダーが設定されていない** ことを意味します（プロバイダーエントリがなく、MiniMax の認証プロファイル/環境変数キーも見つかりません）。この検出に対する修正は **2026.1.12** に含まれています（執筆時点では未リリース）。以下の方法で対処してください。

- **2026.1.12** にアップグレードする（またはソースから実行 `main`）後、Gateway（ゲートウェイ）を再起動します。
- `openclaw configure` を実行し、**MiniMax M2.1** を選択します。または
- `models.providers.minimax` ブロックを手動で追加します。または
- `MINIMAX_API_KEY`（または MiniMax の認証プロファイル）を設定し、プロバイダーを注入できるようにします。

モデル ID は **大文字小文字を区別** することを確認してください。

- `minimax/MiniMax-M2.1`
- `minimax/MiniMax-M2.1-lightning`

その後、次で再確認します。

```bash
openclaw models list
```
