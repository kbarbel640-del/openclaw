---
summary: "Dev エージェントツールに関するメモ（C-3PO）"
read_when:
  - dev ゲートウェイテンプレートを使用しているとき
  - デフォルトの dev エージェント ID を更新するとき
x-i18n:
  source_path: reference/templates/TOOLS.dev.md
  source_hash: 3d41097967c98116
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:46Z
---

# TOOLS.md - ユーザーツールノート（編集可能）

このファイルは、外部ツールや規約に関する「あなた自身」のメモ用です。  
どのツールが存在するかを定義するものではありません。OpenClaw は内部的に組み込みツールを提供します。

## 例

### imsg

- iMessage／SMS を送信する場合：誰に／何を送るかを説明し、送信前に確認します。
- 短いメッセージを優先し、機密情報の送信は避けます。

### sag

- テキスト読み上げ：音声、対象のスピーカー／部屋、ストリーミングの有無を指定します。

アシスタントにあなたのローカルツールチェーンについて知っておいてほしいことを、自由に追加してください。
