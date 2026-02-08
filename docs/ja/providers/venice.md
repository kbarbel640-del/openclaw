---
summary: "OpenClaw で Venice AI のプライバシー重視モデルを使用します"
read_when:
  - OpenClaw でプライバシー重視の推論を行いたい場合
  - Venice AI のセットアップガイダンスが必要な場合
title: "Venice AI"
x-i18n:
  source_path: providers/venice.md
  source_hash: 2453a6ec3a715c24
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:58Z
---

# Venice AI（Venice ハイライト）

**Venice** は、プライバシー最優先の推論のための当社注目の Venice セットアップで、匿名化されたプロキシ経由でのプロプライエタリモデルへのオプションアクセスを提供します。

Venice AI は、検閲なしモデルのサポートと、匿名化プロキシを通じた主要なプロプライエタリモデルへのアクセスにより、プライバシー重視の AI 推論を提供します。すべての推論はデフォルトで非公開です。あなたのデータでの学習は行われず、ログも保存されません。

## OpenClaw で Venice を選ぶ理由

- オープンソースモデル向けの **プライベート推論**（ログなし）。
- 必要に応じて **検閲なしモデル**。
- 品質が重要な場合の **プロプライエタリモデルへの匿名化アクセス**（Opus/GPT/Gemini）。
- OpenAI 互換の `/v1` エンドポイント。

## プライバシーモード

Venice には 2 つのプライバシーレベルがあります。モデル選択の鍵となるため、理解が重要です。

| モード         | 説明                                                                                                                               | モデル                                        |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| **Private**    | 完全に非公開。プロンプト／レスポンスは **一切保存・記録されません**。エフェメラルです。                                            | Llama、Qwen、DeepSeek、Venice Uncensored など |
| **Anonymized** | Venice を介したプロキシで、メタデータを除去します。基盤プロバイダー（OpenAI、Anthropic）には匿名化されたリクエストのみが見えます。 | Claude、GPT、Gemini、Grok、Kimi、MiniMax      |

## 機能

- **プライバシー重視**：「private」（完全非公開）と「anonymized」（プロキシ経由）モードから選択
- **検閲なしモデル**：コンテンツ制限のないモデルにアクセス
- **主要モデルへのアクセス**：Venice の匿名化プロキシ経由で Claude、GPT-5.2、Gemini、Grok を使用
- **OpenAI 互換 API**：容易に統合できる標準の `/v1` エンドポイント
- **ストリーミング**：✅ すべてのモデルで対応
- **関数呼び出し**：✅ 一部のモデルで対応（モデルの機能を確認）
- **ビジョン**：✅ ビジョン機能を持つモデルで対応
- **厳格なレート制限なし**：極端な使用に対してはフェアユースのスロットリングが適用される場合があります

## セットアップ

### 1. API キーを取得

1. [venice.ai](https://venice.ai) でサインアップします
2. **Settings → API Keys → Create new key** に移動します
3. API キーをコピーします（形式：`vapi_xxxxxxxxxxxx`）

### 2. OpenClaw を設定

**オプション A：環境変数**

```bash
export VENICE_API_KEY="vapi_xxxxxxxxxxxx"
```

**オプション B：対話型セットアップ（推奨）**

```bash
openclaw onboard --auth-choice venice-api-key
```

これにより次が実行されます：

1. API キーの入力を求めます（または既存の `VENICE_API_KEY` を使用）
2. 利用可能なすべての Venice モデルを表示
3. デフォルトモデルを選択
4. プロバイダーを自動設定

**オプション C：非対話型**

```bash
openclaw onboard --non-interactive \
  --auth-choice venice-api-key \
  --venice-api-key "vapi_xxxxxxxxxxxx"
```

### 3. セットアップの確認

```bash
openclaw chat --model venice/llama-3.3-70b "Hello, are you working?"
```

## モデル選択

セットアップ後、OpenClaw には利用可能なすべての Venice モデルが表示されます。用途に応じて選択してください：

- **デフォルト（当社推奨）**：プライベートでバランスの取れた性能の `venice/llama-3.3-70b`。
- **総合的に最高品質**：難易度の高い作業向けの `venice/claude-opus-45`（Opus は依然として最強）。
- **プライバシー**：完全に非公開の推論には「private」モデルを選択。
- **機能性**：Venice のプロキシ経由で Claude、GPT、Gemini にアクセスするには「anonymized」モデルを選択。

デフォルトモデルはいつでも変更できます：

```bash
openclaw models set venice/claude-opus-45
openclaw models set venice/llama-3.3-70b
```

利用可能なすべてのモデルを一覧表示：

```bash
openclaw models list | grep venice
```

## `openclaw configure` で設定

1. `openclaw configure` を実行
2. **Model/auth** を選択
3. **Venice AI** を選択

## どのモデルを使うべきですか？

| ユースケース                   | 推奨モデル                       | 理由                             |
| ------------------------------ | -------------------------------- | -------------------------------- |
| **一般的なチャット**           | `llama-3.3-70b`                  | バランス良好、完全非公開         |
| **総合的に最高品質**           | `claude-opus-45`                 | 難しいタスクでは Opus が最強     |
| **プライバシー + Claude 品質** | `claude-opus-45`                 | 匿名化プロキシによる最高の推論   |
| **コーディング**               | `qwen3-coder-480b-a35b-instruct` | コード最適化、262k コンテキスト  |
| **ビジョンタスク**             | `qwen3-vl-235b-a22b`             | 最高のプライベートビジョンモデル |
| **検閲なし**                   | `venice-uncensored`              | コンテンツ制限なし               |
| **高速 + 低コスト**            | `qwen3-4b`                       | 軽量でありながら十分な性能       |
| **複雑な推論**                 | `deepseek-v3.2`                  | 強力な推論、プライベート         |

## 利用可能なモデル（全 25）

### Private モデル（15）— 完全非公開、ログなし

| モデル ID                        | 名前                     | コンテキスト（トークン） | 機能         |
| -------------------------------- | ------------------------ | ------------------------ | ------------ |
| `llama-3.3-70b`                  | Llama 3.3 70B            | 131k                     | 一般         |
| `llama-3.2-3b`                   | Llama 3.2 3B             | 131k                     | 高速、軽量   |
| `hermes-3-llama-3.1-405b`        | Hermes 3 Llama 3.1 405B  | 131k                     | 複雑なタスク |
| `qwen3-235b-a22b-thinking-2507`  | Qwen3 235B Thinking      | 131k                     | 推論         |
| `qwen3-235b-a22b-instruct-2507`  | Qwen3 235B Instruct      | 131k                     | 一般         |
| `qwen3-coder-480b-a35b-instruct` | Qwen3 Coder 480B         | 262k                     | コード       |
| `qwen3-next-80b`                 | Qwen3 Next 80B           | 262k                     | 一般         |
| `qwen3-vl-235b-a22b`             | Qwen3 VL 235B            | 262k                     | ビジョン     |
| `qwen3-4b`                       | Venice Small（Qwen3 4B） | 32k                      | 高速、推論   |
| `deepseek-v3.2`                  | DeepSeek V3.2            | 163k                     | 推論         |
| `venice-uncensored`              | Venice Uncensored        | 32k                      | 検閲なし     |
| `mistral-31-24b`                 | Venice Medium（Mistral） | 131k                     | ビジョン     |
| `google-gemma-3-27b-it`          | Gemma 3 27B Instruct     | 202k                     | ビジョン     |
| `openai-gpt-oss-120b`            | OpenAI GPT OSS 120B      | 131k                     | 一般         |
| `zai-org-glm-4.7`                | GLM 4.7                  | 202k                     | 推論、多言語 |

### Anonymized モデル（10）— Venice プロキシ経由

| モデル ID                | 元モデル          | コンテキスト（トークン） | 機能           |
| ------------------------ | ----------------- | ------------------------ | -------------- |
| `claude-opus-45`         | Claude Opus 4.5   | 202k                     | 推論、ビジョン |
| `claude-sonnet-45`       | Claude Sonnet 4.5 | 202k                     | 推論、ビジョン |
| `openai-gpt-52`          | GPT-5.2           | 262k                     | 推論           |
| `openai-gpt-52-codex`    | GPT-5.2 Codex     | 262k                     | 推論、ビジョン |
| `gemini-3-pro-preview`   | Gemini 3 Pro      | 202k                     | 推論、ビジョン |
| `gemini-3-flash-preview` | Gemini 3 Flash    | 262k                     | 推論、ビジョン |
| `grok-41-fast`           | Grok 4.1 Fast     | 262k                     | 推論、ビジョン |
| `grok-code-fast-1`       | Grok Code Fast 1  | 262k                     | 推論、コード   |
| `kimi-k2-thinking`       | Kimi K2 Thinking  | 262k                     | 推論           |
| `minimax-m21`            | MiniMax M2.1      | 202k                     | 推論           |

## モデル検出

`VENICE_API_KEY` が設定されている場合、OpenClaw は Venice API からモデルを自動的に検出します。API に到達できない場合は、静的カタログにフォールバックします。

`/models` エンドポイントは公開されています（一覧表示には認証不要）が、推論には有効な API キーが必要です。

## ストリーミング & ツール対応

| 機能               | 対応状況                                                       |
| ------------------ | -------------------------------------------------------------- |
| **ストリーミング** | ✅ すべてのモデル                                              |
| **関数呼び出し**   | ✅ ほとんどのモデル（API の `supportsFunctionCalling` を確認） |
| **ビジョン／画像** | ✅ 「Vision」機能が付与されたモデル                            |
| **JSON モード**    | ✅ `response_format` 経由で対応                                |

## 価格

Venice はクレジットベースのシステムを使用します。最新の料金は [venice.ai/pricing](https://venice.ai/pricing) を確認してください：

- **Private モデル**：一般的に低コスト
- **Anonymized モデル**：直接 API 価格に近い + 小額の Venice 手数料

## 比較：Venice vs 直接 API

| 観点             | Venice（Anonymized）   | 直接 API           |
| ---------------- | ---------------------- | ------------------ |
| **プライバシー** | メタデータ除去、匿名化 | アカウントに紐付け |
| **レイテンシ**   | +10–50ms（プロキシ）   | 直接               |
| **機能**         | ほとんどの機能に対応   | フル機能           |
| **課金**         | Venice クレジット      | プロバイダー課金   |

## 使用例

```bash
# Use default private model
openclaw chat --model venice/llama-3.3-70b

# Use Claude via Venice (anonymized)
openclaw chat --model venice/claude-opus-45

# Use uncensored model
openclaw chat --model venice/venice-uncensored

# Use vision model with image
openclaw chat --model venice/qwen3-vl-235b-a22b

# Use coding model
openclaw chat --model venice/qwen3-coder-480b-a35b-instruct
```

## トラブルシューティング

### API キーが認識されない

```bash
echo $VENICE_API_KEY
openclaw models list | grep venice
```

キーが `vapi_` で始まっていることを確認してください。

### モデルが利用できない

Venice のモデルカタログは動的に更新されます。現在利用可能なモデルを確認するには `openclaw models list` を実行してください。一部のモデルは一時的にオフラインの場合があります。

### 接続の問題

Venice API は `https://api.venice.ai/api/v1` にあります。ネットワークで HTTPS 接続が許可されていることを確認してください。

## 設定ファイル例

```json5
{
  env: { VENICE_API_KEY: "vapi_..." },
  agents: { defaults: { model: { primary: "venice/llama-3.3-70b" } } },
  models: {
    mode: "merge",
    providers: {
      venice: {
        baseUrl: "https://api.venice.ai/api/v1",
        apiKey: "${VENICE_API_KEY}",
        api: "openai-completions",
        models: [
          {
            id: "llama-3.3-70b",
            name: "Llama 3.3 70B",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 131072,
            maxTokens: 8192,
          },
        ],
      },
    },
  },
}
```

## リンク

- [Venice AI](https://venice.ai)
- [API ドキュメント](https://docs.venice.ai)
- [価格](https://venice.ai/pricing)
- [ステータス](https://status.venice.ai)
