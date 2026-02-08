---
summary: "macOS における Gateway のライフサイクル（launchd）"
read_when:
  - Gateway のライフサイクルに mac アプリを統合する場合
title: "Gateway のライフサイクル"
x-i18n:
  source_path: platforms/mac/child-process.md
  source_hash: 9b910f574b723bc1
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:21Z
---

# macOS における Gateway のライフサイクル

macOS アプリは、デフォルトで **launchd を介して Gateway（ゲートウェイ）を管理** しており、
Gateway を子プロセスとして起動しません。まず、設定されたポート上ですでに実行中の
Gateway への接続を試みます。到達可能なものがない場合は、外部の `openclaw` CLI
（埋め込みランタイムなし）を介して launchd サービスを有効化します。
これにより、ログイン時の確実な自動起動と、クラッシュ時の再起動が実現されます。

子プロセスモード（アプリが Gateway を直接起動する方式）は、現在 **使用されていません**。
UI とのより密接な結合が必要な場合は、ターミナルで Gateway を手動起動してください。

## デフォルトの挙動（launchd）

- アプリは、ユーザーごとの LaunchAgent を `bot.molt.gateway` というラベルでインストールします
  （`--profile`/`OPENCLAW_PROFILE` を使用する場合は `bot.molt.<profile>`。
  レガシーの `com.openclaw.*` もサポートされています）。
- ローカルモードが有効な場合、アプリは LaunchAgent がロードされていることを保証し、
  必要に応じて Gateway を起動します。
- ログは launchd の Gateway ログパスに書き込まれます
  （デバッグ設定から確認できます）。

よく使うコマンド:

```bash
launchctl kickstart -k gui/$UID/bot.molt.gateway
launchctl bootout gui/$UID/bot.molt.gateway
```

名前付きプロファイルを実行する場合は、ラベルを `bot.molt.<profile>` に置き換えてください。

## 署名なしの開発ビルド

`scripts/restart-mac.sh --no-sign` は、署名キーを持っていない場合の高速なローカルビルド向けです。
launchd が署名されていないリレーバイナリを指さないようにするため、次を行います。

- `~/.openclaw/disable-launchagent` を書き込みます。

`scripts/restart-mac.sh` の署名付き実行では、このマーカーが存在する場合に
このオーバーライドを解除します。手動でリセットするには次を実行してください。

```bash
rm ~/.openclaw/disable-launchagent
```

## アタッチ専用モード

macOS アプリが **launchd を一切インストールまたは管理しない** よう強制するには、
`--attach-only`（または `--no-launchd`）を付けて起動します。
これにより `~/.openclaw/disable-launchagent` が設定され、アプリはすでに実行中の
Gateway にのみアタッチします。同じ挙動はデバッグ設定から切り替えることもできます。

## リモートモード

リモートモードでは、ローカルの Gateway を起動しません。
アプリはリモートホストへの SSH トンネルを使用し、そのトンネル経由で接続します。

## launchd を優先する理由

- ログイン時の自動起動。
- 再起動や KeepAlive のセマンティクスが組み込みで提供されている点。
- 予測可能なログと監視。

真の子プロセスモードが将来的に再び必要になった場合は、
開発専用の明示的なモードとして別途ドキュメント化されるべきです。
