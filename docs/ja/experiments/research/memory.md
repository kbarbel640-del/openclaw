---
summary: "研究メモ: Clawd ワークスペース向けオフラインメモリシステム（Markdown を単一の正本とし、派生インデックスを生成）"
read_when:
  - 日次 Markdown ログを超えたワークスペースメモリ（~/.openclaw/workspace）を設計しているとき
  - 単体 CLI と OpenClaw への深い統合のどちらにするか決めるとき
  - オフラインのリコール + リフレクション（retain/recall/reflect）を追加するとき
title: "ワークスペースメモリ研究"
x-i18n:
  source_path: experiments/research/memory.md
  source_hash: 1753c8ee6284999f
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:21:56Z
---

# ワークスペースメモリ v2（オフライン）: 研究メモ

対象: Clawd 風ワークスペース（`agents.defaults.workspace`、デフォルト `~/.openclaw/workspace`）で、「メモリ」が 1 日につき 1 つの Markdown ファイル（`memory/YYYY-MM-DD.md`）+ 少数の安定ファイル（例: `memory.md`、`SOUL.md`）として保存されているものです。

本ドキュメントは、Markdown をレビュー可能な正本（単一の信頼できる情報源）として維持しつつ、派生インデックスによって **構造化リコール**（検索、エンティティ要約、信頼度更新）を追加する **オフラインファースト** のメモリアーキテクチャを提案します。

## なぜ変更するのですか？

現状（1 日 1 ファイル）は、次に対して非常に優れています:

- 「追記のみ」のジャーナリング
- 人間による編集
- git による耐久性 + 監査性
- 低摩擦な記録（「とりあえず書いておく」）

一方で、次に弱いです:

- 高い再現率の検索（「X について何を決めた？」「前回 Y を試したのは？」）
- 多数のファイルを読み直さずに行うエンティティ中心の回答（「Alice / The Castle / warelay について教えて」）
- 意見/嗜好の安定性（および変化したときの根拠）
- 時間制約（「2025 年 11 月に正しかったことは？」）と衝突解決

## 設計目標

- **オフライン**: ネットワーク不要で動作します。ノート PC / Castle で実行でき、クラウド依存はありません。
- **説明可能**: 取得結果は（ファイル + 位置）により帰属可能であり、推論と分離できるべきです。
- **低儀式**: 日次ログは Markdown のままで、重いスキーマ作業は不要です。
- **段階的**: v1 は FTS のみでも有用です。セマンティック/ベクトルやグラフは任意のアップグレードです。
- **エージェントフレンドリー**: 「トークン予算内でのリコール」を容易にします（小さな事実の束を返します）。

## ノーススター・モデル（Hindsight × Letta）

ブレンドする 2 つの要素:

1. **Letta/MemGPT 風の制御ループ**

- 小さな「コア」を常にコンテキスト内に保持します（ペルソナ + ユーザーの重要事実）
- それ以外はすべてコンテキスト外で、ツール経由で取得します
- メモリ書き込みは明示的なツール呼び出し（append/replace/insert）で行い、永続化してから次ターンで再注入します

2. **Hindsight 風のメモリ基盤**

- 観測されたこと vs 信じていること vs 要約したことを分離します
- retain/recall/reflect をサポートします
- 証拠により進化し得る、信頼度を持つ意見
- エンティティ対応の検索 + 時間クエリ（完全なナレッジグラフがなくても）

## 提案アーキテクチャ（Markdown を正本とし、派生インデックスを生成）

### 正本ストア（git フレンドリー）

`~/.openclaw/workspace` を人間可読な正本メモリとして維持します。

推奨ワークスペース構成:

```
~/.openclaw/workspace/
  memory.md                    # small: durable facts + preferences (core-ish)
  memory/
    YYYY-MM-DD.md              # daily log (append; narrative)
  bank/                        # “typed” memory pages (stable, reviewable)
    world.md                   # objective facts about the world
    experience.md              # what the agent did (first-person)
    opinions.md                # subjective prefs/judgments + confidence + evidence pointers
    entities/
      Peter.md
      The-Castle.md
      warelay.md
      ...
```

注記:

- **デイリーログはデイリーログのまま**です。JSON にする必要はありません。
- `bank/` ファイルは **キュレーション済み**で、リフレクションジョブによって生成されますが、手で編集することもできます。
- `memory.md` は「小さく + コア寄り」のままです。つまり、Clawd に毎セッション見せたい内容です。

### 派生ストア（機械リコール）

ワークスペース配下に派生インデックスを追加します（必ずしも git 管理しません）:

```
~/.openclaw/workspace/.memory/index.sqlite
```

バックエンドは次で構成します:

- 事実 + エンティティリンク + 意見メタデータ用の SQLite スキーマ
- 字句リコール向け SQLite **FTS5**（高速・小型・オフライン）
- セマンティックリコール用の埋め込みテーブル（任意、ただしオフライン）

インデックスは常に **Markdown から再構築可能**です。

## Retain / Recall / Reflect（運用ループ）

### Retain: 日次ログを「事実」に正規化する

ここで重要な Hindsight の洞察は、極小スニペットではなく、**物語的で自己完結した事実**を保存することです。

`memory/YYYY-MM-DD.md` の実用ルール:

- 1 日の終わり（または途中）に、`## Retain` セクションを 2〜5 個の箇条書きで追加します。各箇条書きは:
  - 物語的（複数ターンの文脈を保持）
  - 自己完結（後で単体で読んでも意味が通る）
  - 型 + エンティティ言及でタグ付けされている

例:

```
## Retain
- W @Peter: Currently in Marrakech (Nov 27–Dec 1, 2025) for Andy’s birthday.
- B @warelay: I fixed the Baileys WS crash by wrapping connection.update handlers in try/catch (see memory/2025-11-27.md).
- O(c=0.95) @Peter: Prefers concise replies (&lt;1500 chars) on WhatsApp; long content goes into files.
```

最小パース:

- 型プレフィックス: `W`（world）、`B`（experience/biographical）、`O`（opinion）、`S`（observation/summary。通常は生成）
- エンティティ: `@Peter`、`@warelay` など（スラッグが `bank/entities/*.md` にマップ）
- 意見の信頼度: `O(c=0.0..1.0)` は任意

書き手に考えさせたくない場合: reflect ジョブがログの残りからこれらの箇条書きを推定できますが、明示的な `## Retain` セクションを持つことが最も簡単な「品質レバー」です。

### Recall: 派生インデックスへのクエリ

Recall がサポートすべきもの:

- **字句**: 「厳密な用語 / 名前 / コマンドを探す」（FTS5）
- **エンティティ**: 「X について教えて」（エンティティページ + エンティティ紐付け済み事実）
- **時系列**: 「11/27 前後に何があった？」/「先週以降」
- **意見**: 「Peter は何を好む？」（信頼度 + 根拠付き）

返却形式はエージェントフレンドリーで、ソースを引用すべきです:

- `kind`（`world|experience|opinion|observation`）
- `timestamp`（ソース日付、または存在する場合は抽出された時間範囲）
- `entities`（`["Peter","warelay"]`）
- `content`（物語的な事実）
- `source`（`memory/2025-11-27.md#L12` など）

### Reflect: 安定ページを生成し、信念を更新する

Reflection はスケジュールされたジョブ（毎日、またはハートビート `ultrathink`）であり、次を行います:

- 直近の事実から `bank/entities/*.md`（エンティティ要約）を更新します
- 強化/矛盾に基づいて `bank/opinions.md` の信頼度を更新します
- 任意で `memory.md`（「コア寄り」の耐久的事実）への編集を提案します

意見の進化（シンプルで説明可能）:

- 各意見は次を持ちます:
  - 文
  - 信頼度 `c ∈ [0,1]`
  - last_updated
  - 根拠リンク（支持 + 反証の事実 ID）
- 新しい事実が到着したら:
  - エンティティの重なり + 類似度で候補意見を見つけます（まず FTS、埋め込みは後）
  - 小さな増減で信頼度を更新します。大きなジャンプには強い反証 + 繰り返しの証拠が必要です

## CLI 統合: 単体 vs 深い統合

推奨: **OpenClaw への深い統合**。ただし、分離可能なコアライブラリは維持します。

### なぜ OpenClaw に統合するのですか？

- OpenClaw はすでに次を把握しています:
  - ワークスペースパス（`agents.defaults.workspace`）
  - セッションモデル + ハートビート
  - ログ + トラブルシューティングのパターン
- エージェント自身にツールを呼ばせたいです:
  - `openclaw memory recall "…" --k 25 --since 30d`
  - `openclaw memory reflect --since 7d`

### なぜそれでもライブラリを分離するのですか？

- Gateway（ゲートウェイ）/ ランタイムなしでもメモリロジックをテスト可能にします
- 他コンテキスト（ローカルスクリプト、将来のデスクトップアプリなど）から再利用します

形:
メモリツールは小さな CLI + ライブラリ層であることを意図していますが、これは探索的なものに過ぎません。

## 「S-Collide」/ SuCo: いつ使うべきか（研究）

「S-Collide」が **SuCo（Subspace Collision）** を指すのであれば、サブスペース内の学習/構造化された衝突を用いて、再現率/レイテンシの強いトレードオフを狙う ANN 検索手法です（論文: arXiv 2411.14754、2024）。

`~/.openclaw/workspace` に対する実務的な見解:

- SuCo から **始めないでください**。
- SQLite FTS +（任意で）単純な埋め込みから始めてください。すぐに UX 改善の大半が得られます。
- SuCo/HNSW/ScaNN 系を検討するのは、次を満たしてからです:
  - コーパスが大きい（チャンクが数万〜数十万）
  - 総当たりの埋め込み検索が遅すぎる
  - 再現率の品質が字句検索により実質的にボトルネックになっている

オフラインフレンドリーな代替（複雑さが増える順）:

- SQLite FTS5 + メタデータフィルタ（ML ゼロ）
- 埋め込み + 総当たり（チャンク数が少なければ驚くほど先まで行けます）
- HNSW インデックス（一般的で堅牢。ライブラリバインディングが必要）
- SuCo（研究グレード。組み込み可能な堅い実装があれば魅力的）

未解決の問い:

- あなたのマシン（ノート PC + デスクトップ）で「パーソナルアシスタントのメモリ」に最適なオフライン埋め込みモデルは何ですか？
  - すでに Ollama があるならローカルモデルで埋め込みを行います。そうでなければ、ツールチェーンに小さな埋め込みモデルを同梱します。

## 最小の有用パイロット

最小で、それでも有用なバージョンが欲しい場合:

- `bank/` のエンティティページと、日次ログ内の `## Retain` セクションを追加します。
- 引用（パス + 行番号）付きで SQLite FTS を用いてリコールします。
- リコール品質または規模が必要とする場合にのみ、埋め込みを追加します。

## 参考文献

- Letta / MemGPT の概念: 「core memory blocks」+「archival memory」+ ツール駆動の自己編集メモリ。
- Hindsight Technical Report: 「retain / recall / reflect」、4 ネットワークメモリ、物語的事実抽出、意見信頼度の進化。
- SuCo: arXiv 2411.14754（2024）: 「Subspace Collision」近似最近傍検索。
