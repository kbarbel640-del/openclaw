---
summary: "オンボーディングウィザードと設定スキーマの RPC プロトコルメモ"
read_when: "オンボーディングウィザードの手順または設定スキーマのエンドポイントを変更する場合"
title: "オンボーディングと設定プロトコル"
x-i18n:
  source_path: experiments/onboarding-config-protocol.md
  source_hash: 55163b3ee029c024
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:19:03Z
---

# オンボーディング + 設定プロトコル

目的: CLI、macOS アプリ、Web UI 全体で共有されるオンボーディング + 設定サーフェスです。

## コンポーネント

- ウィザードエンジン（共有セッション + プロンプト + オンボーディング状態）。
- CLI のオンボーディングは、UI クライアントと同じウィザードフローを使用します。
- Gateway（ゲートウェイ）の RPC は、ウィザード + 設定スキーマのエンドポイントを公開します。
- macOS のオンボーディングは、ウィザードのステップモデルを使用します。
- Web UI は、JSON Schema + UI ヒントから設定フォームをレンダリングします。

## Gateway（ゲートウェイ） RPC

- `wizard.start` パラメータ: `{ mode?: "local"|"remote", workspace?: string }`
- `wizard.next` パラメータ: `{ sessionId, answer?: { stepId, value? } }`
- `wizard.cancel` パラメータ: `{ sessionId }`
- `wizard.status` パラメータ: `{ sessionId }`
- `config.schema` パラメータ: `{}`

レスポンス（形状）

- ウィザード: `{ sessionId, done, step?, status?, error? }`
- 設定スキーマ: `{ schema, uiHints, version, generatedAt }`

## UI ヒント

- パスでキー付けされた `uiHints`。任意のメタデータ（label/help/group/order/advanced/sensitive/placeholder）。
- センシティブなフィールドはパスワード入力としてレンダリングされます。マスキング用のレイヤーはありません。
- サポートされていないスキーマノードは、生の JSON エディタにフォールバックします。

## 注記

- このドキュメントは、オンボーディング/設定に関するプロトコルのリファクタリングを追跡するための単一の場所です。
