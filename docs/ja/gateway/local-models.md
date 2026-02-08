---
summary: "ローカル LLM（LM Studio、vLLM、LiteLLM、カスタム OpenAI エンドポイント）で OpenClaw を実行します"
read_when:
  - 自分の GPU マシンからモデルを提供したい場合
  - LM Studio や OpenAI 互換プロキシを接続する場合
  - 最も安全なローカルモデルのガイダンスが必要な場合
title: "ローカルモデル"
x-i18n:
  source_path: gateway/local-models.md
  source_hash: 63a7cc8b114355c6
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:31:45Z
---

# ローカルモデル

ローカル運用は可能ですが、OpenClaw は **大きなコンテキスト** と **プロンプトインジェクションに対する強力な防御** を前提とします。小規模なカードはコンテキストを切り詰め、安全性が漏れやすくなります。目標は高めに設定してください。**最大構成の Mac Studio を 2 台以上、または同等の GPU リグ（約 $30k+）** が目安です。**24 GB** の GPU 1 枚でも動作しますが、軽めのプロンプトに限られ、レイテンシは高くなります。**実行可能な最大／フルサイズのモデルバリアント** を使用してください。過度に量子化された、または「小型」チェックポイントはプロンプトインジェクションのリスクを高めます（[Security](/gateway/security) を参照）。

## 推奨：LM Studio + MiniMax M2.1（Responses API、フルサイズ）

現在のローカルスタックとして最良です。LM Studio に MiniMax M2.1 を読み込み、ローカルサーバー（既定 `http://127.0.0.1:1234`）を有効化し、Responses API を使用して推論と最終テキストを分離します。

```json5
{
  agents: {
    defaults: {
      model: { primary: "lmstudio/minimax-m2.1-gs32" },
      models: {
        "anthropic/claude-opus-4-6": { alias: "Opus" },
        "lmstudio/minimax-m2.1-gs32": { alias: "Minimax" },
      },
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

**セットアップチェックリスト**

- LM Studio をインストール： https://lmstudio.ai
- LM Studio で **入手可能な最大の MiniMax M2.1 ビルド** をダウンロード（「small」や強い量子化バリアントは回避）、サーバーを起動し、`http://127.0.0.1:1234/v1/models` に表示されることを確認します。
- モデルはロードしたままにしてください。コールドロードは起動レイテンシを追加します。
- LM Studio のビルドが異なる場合は、`contextWindow`/`maxTokens` を調整します。
- WhatsApp では、最終テキストのみを送信するため Responses API を使用してください。

ローカル運用時でもホスト型モデルの設定は維持し、`models.mode: "merge"` を使用してフォールバックを有効にしておきます。

### ハイブリッド構成：ホスト型を主、ローカルをフォールバック

```json5
{
  agents: {
    defaults: {
      model: {
        primary: "anthropic/claude-sonnet-4-5",
        fallbacks: ["lmstudio/minimax-m2.1-gs32", "anthropic/claude-opus-4-6"],
      },
      models: {
        "anthropic/claude-sonnet-4-5": { alias: "Sonnet" },
        "lmstudio/minimax-m2.1-gs32": { alias: "MiniMax Local" },
        "anthropic/claude-opus-4-6": { alias: "Opus" },
      },
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

### ローカル優先（ホスト型のセーフティネット付き）

主とフォールバックの順序を入れ替えます。同じ providers ブロックと `models.mode: "merge"` を維持し、ローカル機がダウンした際に Sonnet や Opus へフォールバックできるようにします。

### リージョナルホスティング／データルーティング

- ホスト型の MiniMax／Kimi／GLM の各バリアントは、OpenRouter にリージョン固定エンドポイント（例：US ホスト）としても存在します。そこでリージョナルバリアントを選択し、Anthropic／OpenAI のフォールバックには `models.mode: "merge"` を使用することで、トラフィックを選択した管轄内に保てます。
- プライバシーを最優先するならローカル専用が最強です。プロバイダー機能が必要だがデータフローの制御もしたい場合は、リージョナルホスティングが中間解です。

## その他の OpenAI 互換ローカルプロキシ

vLLM、LiteLLM、OAI-proxy、またはカスタム Gateway（ゲートウェイ）は、OpenAI 形式の `/v1` エンドポイントを公開していれば利用できます。上記の provider ブロックを、ご自身のエンドポイントとモデル ID に置き換えてください。

```json5
{
  models: {
    mode: "merge",
    providers: {
      local: {
        baseUrl: "http://127.0.0.1:8000/v1",
        apiKey: "sk-local",
        api: "openai-responses",
        models: [
          {
            id: "my-local-model",
            name: "Local Model",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 120000,
            maxTokens: 8192,
          },
        ],
      },
    },
  },
}
```

ホスト型モデルをフォールバックとして利用可能にするため、`models.mode: "merge"` を維持してください。

## トラブルシューティング

- Gateway（ゲートウェイ）からプロキシへ到達できますか？ `curl http://127.0.0.1:1234/v1/models`。
- LM Studio のモデルがアンロードされていますか？ 再ロードしてください。コールドスタートは「ハング」の一般的な原因です。
- コンテキストエラーが出ますか？ `contextWindow` を下げるか、サーバー側の上限を引き上げてください。
- 安全性：ローカルモデルはプロバイダー側のフィルタをスキップします。エージェントを狭く保ち、コンパクションを有効にして、プロンプトインジェクションの影響範囲を限定してください。
