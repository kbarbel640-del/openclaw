---
summary: "WebSocket リスナーのバインドを使用した Gateway（ゲートウェイ）のシングルトンガード"
read_when:
  - Gateway（ゲートウェイ）プロセスを実行またはデバッグしているとき
  - 単一インスタンスの強制について調査しているとき
title: "Gateway（ゲートウェイ）ロック"
x-i18n:
  source_path: gateway/gateway-lock.md
  source_hash: 15fdfa066d1925da
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:31:41Z
---

# Gateway（ゲートウェイ）ロック

最終更新日: 2025-12-11

## 目的

- 同一ホスト上で、同一のベースポートにつき 1 つの Gateway（ゲートウェイ）インスタンスのみが実行されることを保証します。追加の Gateway（ゲートウェイ）は、分離されたプロファイルと一意のポートを使用する必要があります。
- クラッシュや SIGKILL が発生しても、古いロックファイルを残さずに動作し続けます。
- コントロールポートがすでに使用中の場合、明確なエラーで迅速に失敗します。

## 仕組み

- Gateway（ゲートウェイ）は起動直後に、排他的な TCP リスナーを使用して WebSocket リスナー（デフォルトは `ws://127.0.0.1:18789`）をバインドします。
- バインドが `EADDRINUSE` で失敗した場合、起動時に `GatewayLockError("another gateway instance is already listening on ws://127.0.0.1:<port>")` がスローされます。
- OS は、クラッシュや SIGKILL を含むあらゆるプロセス終了時にリスナーを自動的に解放します。個別のロックファイルやクリーンアップ手順は不要です。
- シャットダウン時には、Gateway（ゲートウェイ）が WebSocket サーバーと基盤となる HTTP サーバーを閉じ、ポートを速やかに解放します。

## エラーの表出

- 別のプロセスがポートを保持している場合、起動時に `GatewayLockError("another gateway instance is already listening on ws://127.0.0.1:<port>")` がスローされます。
- その他のバインド失敗は `GatewayLockError("failed to bind gateway socket on ws://127.0.0.1:<port>: …")` として表出します。

## 運用上の注意

- ポートが「別の」プロセスによって占有されている場合でも、エラーは同じです。ポートを解放するか、`openclaw gateway --port <port>` を使用して別のポートを選択してください。
- macOS アプリは、Gateway（ゲートウェイ）を起動する前に独自の軽量な PID ガードを引き続き維持しますが、実行時のロックは WebSocket のバインドによって強制されます。
