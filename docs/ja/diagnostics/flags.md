---
summary: "ターゲットを絞ったデバッグログのための診断フラグ"
read_when:
  - グローバルなログレベルを上げずに、ターゲットを絞ったデバッグログが必要な場合
  - サポート向けに、サブシステム固有のログを取得する必要がある場合
title: "診断フラグ"
x-i18n:
  source_path: diagnostics/flags.md
  source_hash: daf0eca0e6bd1cbc
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:19:14Z
---

# 診断フラグ

診断フラグを使用すると、あらゆる場所で詳細ログを有効にすることなく、ターゲットを絞ったデバッグログを有効化できます。フラグはオプトインであり、サブシステム側がそれらを確認しない限り影響はありません。

## 仕組み

- フラグは文字列です（大文字・小文字は区別されません）。
- 設定で、または環境変数によるオーバーライドでフラグを有効化できます。
- ワイルドカードがサポートされています:
  - `telegram.*` は `telegram.http` に一致します
  - `*` はすべてのフラグを有効化します

## 設定で有効化

```json
{
  "diagnostics": {
    "flags": ["telegram.http"]
  }
}
```

複数のフラグ:

```json
{
  "diagnostics": {
    "flags": ["telegram.http", "gateway.*"]
  }
}
```

フラグを変更したら Gateway（ゲートウェイ）を再起動してください。

## 環境変数オーバーライド（一時的）

```bash
OPENCLAW_DIAGNOSTICS=telegram.http,telegram.payload
```

すべてのフラグを無効化:

```bash
OPENCLAW_DIAGNOSTICS=0
```

## ログの出力先

フラグは、標準の診断ログファイルにログを出力します。デフォルトでは:

```
/tmp/openclaw/openclaw-YYYY-MM-DD.log
```

`logging.file` を設定している場合は、代わりにそのパスを使用します。ログは JSONL（1 行あたり 1 つの JSON オブジェクト）です。マスキングは `logging.redactSensitive` に基づいて引き続き適用されます。

## ログの抽出

最新のログファイルを選択します:

```bash
ls -t /tmp/openclaw/openclaw-*.log | head -n 1
```

Telegram HTTP 診断用にフィルタします:

```bash
rg "telegram http error" /tmp/openclaw/openclaw-*.log
```

または、再現しながら tail します:

```bash
tail -f /tmp/openclaw/openclaw-$(date +%F).log | rg "telegram http error"
```

リモートの Gateway（ゲートウェイ）では、`openclaw logs --follow` も使用できます（[/cli/logs](/cli/logs) を参照）。

## 注意事項

- `logging.level` が `warn` より高く設定されている場合、これらのログは抑制される可能性があります。デフォルトの `info` で問題ありません。
- フラグは有効のままにしても安全です。特定のサブシステムのログ量にのみ影響します。
- ログの出力先、レベル、マスキングを変更するには [/logging](/logging) を使用してください。
