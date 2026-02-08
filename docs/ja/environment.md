---
summary: "OpenClaw が環境変数を読み込む場所と優先順位"
read_when:
  - どの環境変数が読み込まれ、どの順序で適用されるかを知る必要がある場合
  - Gateway（ゲートウェイ）で API キーが見つからない問題をデバッグしている場合
  - プロバイダー認証やデプロイ環境をドキュメント化している場合
title: "環境変数"
x-i18n:
  source_path: environment.md
  source_hash: b49ae50e5d306612
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:18:58Z
---

# 環境変数

OpenClaw は複数のソースから環境変数を取り込みます。ルールは **既存の値を上書きしない** ことです。

## 優先順位（高 → 低）

1. **プロセス環境**（Gateway（ゲートウェイ）プロセスが親シェル／デーモンからすでに受け取っているもの）。
2. **現在の作業ディレクトリにある `.env`**（dotenv のデフォルト。上書きしません）。
3. `~/.openclaw/.env` にある **グローバル `.env`**（別名 `$OPENCLAW_STATE_DIR/.env`。上書きしません）。
4. `~/.openclaw/openclaw.json` 内の **設定 `env` ブロック**（不足している場合にのみ適用）。
5. **任意の login-shell インポート**（`env.shellEnv.enabled` または `OPENCLAW_LOAD_SHELL_ENV=1`）。期待されるキーのうち不足しているものにのみ適用されます。

設定ファイルが完全に存在しない場合は手順 4 がスキップされます。シェルインポートは、有効になっていれば引き続き実行されます。

## 設定 `env` ブロック

インラインの環境変数を設定する同等の 2 つの方法（どちらも上書きしません）:

```json5
{
  env: {
    OPENROUTER_API_KEY: "sk-or-...",
    vars: {
      GROQ_API_KEY: "gsk-...",
    },
  },
}
```

## シェル環境変数のインポート

`env.shellEnv` は login shell を実行し、**不足している** 期待されるキーのみをインポートします:

```json5
{
  env: {
    shellEnv: {
      enabled: true,
      timeoutMs: 15000,
    },
  },
}
```

環境変数としての同等指定:

- `OPENCLAW_LOAD_SHELL_ENV=1`
- `OPENCLAW_SHELL_ENV_TIMEOUT_MS=15000`

## 設定内の環境変数置換

`${VAR_NAME}` 構文を使用すると、設定の文字列値で環境変数を直接参照できます:

```json5
{
  models: {
    providers: {
      "vercel-gateway": {
        apiKey: "${VERCEL_GATEWAY_API_KEY}",
      },
    },
  },
}
```

詳細はこちら: [Configuration: Env var substitution](/gateway/configuration#env-var-substitution-in-config)

## 関連

- [Gateway 設定](/gateway/configuration)
- [よくある質問: 環境変数と .env の読み込み](/help/faq#env-vars-and-env-loading)
- [モデル概要](/concepts/models)
