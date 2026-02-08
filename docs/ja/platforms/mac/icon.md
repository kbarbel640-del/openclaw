---
summary: "macOS 上の OpenClaw におけるメニューバーアイコンの状態とアニメーション"
read_when:
  - メニューバーアイコンの挙動を変更する場合
title: "メニューバーアイコン"
x-i18n:
  source_path: platforms/mac/icon.md
  source_hash: a67a6e6bbdc2b611
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:23Z
---

# メニューバーアイコンの状態

作成者: steipete · 更新日: 2025-12-06 · 対象範囲: macOS アプリ（`apps/macos`）

- **Idle:** 通常のアイコンアニメーション（点滅、時折の小さな揺れ）です。
- **Paused:** ステータスアイテムは `appearsDisabled` を使用し、動きはありません。
- **Voice trigger（big ears）:** 音声ウェイク検出がウェイクワードを検出すると `AppState.triggerVoiceEars(ttl: nil)` を呼び出し、発話のキャプチャ中は `earBoostActive=true` を維持します。耳は 1.9x にスケールアップし、可読性のために円形の耳穴を持ち、その後、無音が 1 秒続くと `stopVoiceEars()` によって元に戻ります。アプリ内の音声パイプラインからのみ発火されます。
- **Working（agent 実行中）:** `AppState.isWorking=true` が「tail/leg scurry」のマイクロモーションを駆動します。作業が進行中の間、脚の揺れが速くなり、わずかなオフセットが加わります。現在は WebChat エージェント実行の前後で切り替えられています。他の長時間タスクを配線する際にも、同じトグルを追加してください。

配線ポイント

- Voice wake: トリガー時に runtime/tester から `AppState.triggerVoiceEars(ttl: nil)` を呼び出し、キャプチャウィンドウに合わせて無音 1 秒後に `stopVoiceEars()` を呼び出します。
- Agent のアクティビティ: 作業スパンの前後で `AppStateStore.shared.setWorking(true/false)` を設定します（WebChat エージェント呼び出しでは既に対応済みです）。アニメーションが停止したままになるのを防ぐため、スパンは短く保ち、`defer` ブロックでリセットしてください。

形状とサイズ

- ベースアイコンは `CritterIconRenderer.makeIcon(blink:legWiggle:earWiggle:earScale:earHoles:)` で描画されます。
- 耳のスケールは既定で `1.0` です。音声ブーストでは `earScale=1.9` を設定し、全体フレームを変更せずに `earHoles=true` を切り替えます（18×18 pt のテンプレート画像を 36×36 px の Retina バッキングストアにレンダリングします）。
- Scurry は脚の揺れを最大で約 1.0 まで使用し、小さな水平方向のジグルを加えます。既存の Idle の揺れに加算されます。

挙動に関する注意

- 耳／作業中の外部 CLI／ブローカーによるトグルはありません。誤作動によるフラッピングを避けるため、アプリ自身のシグナルに内部的に留めてください。
- ジョブがハングした場合でもアイコンが速やかにベースラインに戻るよう、TTL は短く（10 秒未満）保ってください。
