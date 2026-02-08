---
summary: "macOS の権限の永続性（TCC）と署名要件"
read_when:
  - macOS の権限プロンプトが表示されない、または停止している問題のデバッグ時
  - macOS アプリのパッケージングまたは署名時
  - バンドル ID やアプリのインストールパスを変更する場合
title: "macOS の権限"
x-i18n:
  source_path: platforms/mac/permissions.md
  source_hash: d012589c0583dd0b
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:24Z
---

# macOS の権限（TCC）

macOS の権限付与は壊れやすいです。TCC は、権限付与をアプリのコード署名、バンドル識別子、ディスク上のパスに関連付けます。これらのいずれかが変更されると、macOS はそのアプリを新しいものとして扱い、プロンプトを削除したり非表示にしたりする場合があります。

## 権限を安定させるための要件

- 同一のパス: アプリを固定の場所から実行します（OpenClaw の場合は、`dist/OpenClaw.app`）。
- 同一のバンドル識別子: バンドル ID を変更すると、新しい権限アイデンティティが作成されます。
- 署名されたアプリ: 未署名または ad-hoc 署名のビルドでは、権限は永続化されません。
- 一貫した署名: 実際の Apple Development または Developer ID 証明書を使用し、再ビルド間で署名が安定するようにします。

Ad-hoc 署名は、ビルドのたびに新しいアイデンティティを生成します。macOS は以前の付与を忘れ、古いエントリがクリアされるまでプロンプトが完全に表示されなくなることがあります。

## プロンプトが消えた場合の復旧チェックリスト

1. アプリを終了します。
2. 「システム設定」→「プライバシーとセキュリティ」でアプリのエントリを削除します。
3. 同じパスからアプリを再起動し、権限を再度付与します。
4. それでもプロンプトが表示されない場合は、`tccutil` で TCC エントリをリセットし、再試行します。
5. 一部の権限は、macOS を完全に再起動した後でのみ再表示されます。

リセットの例（必要に応じてバンドル ID を置き換えてください）:

```bash
sudo tccutil reset Accessibility bot.molt.mac
sudo tccutil reset ScreenCapture bot.molt.mac
sudo tccutil reset AppleEvents
```

権限をテストする場合は、必ず実際の証明書で署名してください。Ad-hoc ビルドは、権限が重要でない短時間のローカル実行にのみ適しています。
