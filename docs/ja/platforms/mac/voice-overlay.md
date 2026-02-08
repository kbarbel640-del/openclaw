---
summary: "ウェイクワードとプッシュトゥトークが重なった場合のボイスオーバーレイのライフサイクル"
read_when:
  - ボイスオーバーレイの挙動を調整する場合
title: "ボイスオーバーレイ"
x-i18n:
  source_path: platforms/mac/voice-overlay.md
  source_hash: 3be1a60aa7940b23
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:34Z
---

# ボイスオーバーレイのライフサイクル（macOS）

対象読者：macOS アプリのコントリビューター。目的：ウェイクワードとプッシュトゥトークが重なった際に、ボイスオーバーレイを予測可能に保つこと。

### 現在の意図

- ウェイクワードによりオーバーレイが既に表示されている状態でユーザーがホットキーを押した場合、ホットキーのセッションは既存のテキストを _採用_ し、リセットしません。ホットキーが押されている間はオーバーレイが表示されたままになります。ユーザーが離したとき、トリム後のテキストがあれば送信し、なければ閉じます。
- ウェイクワードのみの場合は無音で自動送信されます。プッシュトゥトークは離した時点で即座に送信されます。

### 実装済み（2025 年 12 月 9 日）

- オーバーレイのセッションは、キャプチャ（ウェイクワードまたはプッシュトゥトーク）ごとにトークンを保持します。トークンが一致しない場合、partial/final/send/dismiss/level の更新は破棄され、古いコールバックを回避します。
- プッシュトゥトークは、表示中のオーバーレイテキストを接頭辞として採用します（ウェイクのオーバーレイが表示中にホットキーを押すと、テキストを保持したまま新しい発話を追加します）。最終トランスクリプトを最大 1.5 秒待機し、それまでに得られない場合は現在のテキストにフォールバックします。
- チャイム／オーバーレイのログは `info` に、カテゴリ `voicewake.overlay`、`voicewake.ptt`、`voicewake.chime`（セッション開始、partial、final、送信、閉じる、チャイム理由）として出力されます。

### 次のステップ

1. **VoiceSessionCoordinator（actor）**
   - 同時に正確に 1 つの `VoiceSession` を所有します。
   - API（トークンベース）：`beginWakeCapture`、`beginPushToTalk`、`updatePartial`、`endCapture`、`cancel`、`applyCooldown`。
   - 古いトークンを持つコールバックを破棄します（古い認識器がオーバーレイを再度開くことを防止）。
2. **VoiceSession（モデル）**
   - フィールド：`token`、`source`（wakeWord|pushToTalk）、コミット済み／揮発テキスト、チャイムフラグ、タイマー（自動送信、アイドル）、`overlayMode`（display|editing|sending）、クールダウン期限。
3. **オーバーレイのバインディング**
   - `VoiceSessionPublisher`（`ObservableObject`）がアクティブなセッションを SwiftUI にミラーします。
   - `VoiceWakeOverlayView` はパブリッシャー経由でのみ描画し、グローバルシングルトンを直接変更しません。
   - オーバーレイのユーザー操作（`sendNow`、`dismiss`、`edit`）は、セッショントークンを添えてコーディネーターへコールバックします。
4. **統合された送信パス**
   - `endCapture` 時：トリム後のテキストが空なら閉じる。そうでなければ `performSend(session:)`（送信チャイムを 1 回再生し、転送して閉じる）。
   - プッシュトゥトーク：遅延なし。ウェイクワード：自動送信のための任意の遅延。
   - プッシュトゥトーク終了後、ウェイクランタイムに短いクールダウンを適用し、ウェイクワードが直ちに再トリガーされないようにします。
5. **ログ**
   - コーディネーターは、サブシステム `bot.molt`、カテゴリ `voicewake.overlay` および `voicewake.chime` に `.info` ログを出力します。
   - 主要イベント：`session_started`、`adopted_by_push_to_talk`、`partial`、`finalized`、`send`、`dismiss`、`cancel`、`cooldown`。

### デバッグチェックリスト

- 固着したオーバーレイを再現しながらログをストリームします：

  ```bash
  sudo log stream --predicate 'subsystem == "bot.molt" AND category CONTAINS "voicewake"' --level info --style compact
  ```

- アクティブなセッショントークンが 1 つだけであることを確認します。古いコールバックはコーディネーターにより破棄されるはずです。
- プッシュトゥトークのリリースが常に、アクティブなトークンで `endCapture` を呼び出していることを確認します。テキストが空の場合、チャイムや送信なしで `dismiss` が発生することを期待します。

### 移行手順（推奨）

1. `VoiceSessionCoordinator`、`VoiceSession`、`VoiceSessionPublisher` を追加します。
2. `VoiceWakeRuntime` をリファクタリングし、`VoiceWakeOverlayController` を直接操作するのではなく、セッションの作成／更新／終了を行うようにします。
3. `VoicePushToTalk` をリファクタリングして既存セッションを採用し、リリース時に `endCapture` を呼び出します。ランタイムのクールダウンを適用します。
4. `VoiceWakeOverlayController` をパブリッシャーに接続し、ランタイム／PTT からの直接呼び出しを削除します。
5. セッション採用、クールダウン、空テキストの閉じ処理に対する統合テストを追加します。
