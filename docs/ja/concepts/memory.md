---
summary: "OpenClaw のメモリの仕組み（ワークスペースファイル + 自動メモリフラッシュ）"
read_when:
  - メモリファイルのレイアウトとワークフローが必要なとき
  - 自動プレコンパクションのメモリフラッシュを調整したいとき
x-i18n:
  source_path: concepts/memory.md
  source_hash: 5fe705d89fb30998
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:09:15Z
---

# メモリ

OpenClaw のメモリは、**エージェントのワークスペース内にあるプレーンな Markdown** です。ファイルが信頼できる唯一の情報源であり、モデルはディスクに書き込まれた内容だけを「記憶」します。

メモリ検索ツールは、有効なメモリプラグイン（デフォルト: `memory-core`）によって提供されます。メモリプラグインは `plugins.slots.memory = "none"` で無効化できます。

## メモリファイル（Markdown）

デフォルトのワークスペースレイアウトでは、2 つのメモリレイヤーを使用します。

- `memory/YYYY-MM-DD.md`
  - 日次ログ（追記のみ）。
  - セッション開始時に今日分 + 昨日分を読み込みます。
- `MEMORY.md`（任意）
  - キュレーションされた長期メモリ。
  - **メインのプライベートセッションでのみ読み込みます**（グループ文脈では読み込みません）。

これらのファイルはワークスペース（`agents.defaults.workspace`、デフォルトは `~/.openclaw/workspace`）配下にあります。全体のレイアウトは [エージェントワークスペース](/concepts/agent-workspace) を参照してください。

## メモリを書き込むタイミング

- 意思決定、好み、長期的に有効な事実は `MEMORY.md` に書き込みます。
- 日々のメモや継続中の文脈は `memory/YYYY-MM-DD.md` に書き込みます。
- 誰かが「これを覚えておいて」と言ったら、書き留めます（RAM に保持しません）。
- この領域はまだ進化中です。モデルにメモリを保存するよう促すと役立ちます。モデルは何をすべきか理解しています。
- 何かを定着させたい場合は、**ボットにメモリへ書き込むよう依頼**してください。

## 自動メモリフラッシュ（コンパクション前 ping）

セッションが **自動コンパクションに近づく**と、OpenClaw は **ユーザーに見えないエージェント的ターン**をトリガーし、文脈が圧縮される **前**に永続メモリを書き込むようモデルに促します。デフォルトのプロンプトでは、モデルは _返信してもよい_ と明示されていますが、通常はユーザーがこのターンを目にしないよう `NO_REPLY` が正しい応答です。

これは `agents.defaults.compaction.memoryFlush` で制御されます。

```json5
{
  agents: {
    defaults: {
      compaction: {
        reserveTokensFloor: 20000,
        memoryFlush: {
          enabled: true,
          softThresholdTokens: 4000,
          systemPrompt: "Session nearing compaction. Store durable memories now.",
          prompt: "Write any lasting notes to memory/YYYY-MM-DD.md; reply with NO_REPLY if nothing to store.",
        },
      },
    },
  },
}
```

詳細:

- **ソフトしきい値**: セッションのトークン推定が `contextWindow - reserveTokensFloor - softThresholdTokens` を超えるとフラッシュがトリガーされます。
- デフォルトは **サイレント**: プロンプトに `NO_REPLY` を含めるため、何も配信されません。
- **2 つのプロンプト**: ユーザープロンプト + システムプロンプトがリマインダーを付加します。
- **コンパクションサイクルあたり 1 回のフラッシュ**（`sessions.json` で追跡）。
- **ワークスペースが書き込み可能である必要があります**: セッションが `workspaceAccess: "ro"` または `"none"` でサンドボックス化されて実行されている場合、フラッシュはスキップされます。

コンパクションのライフサイクル全体については、[セッション管理 + コンパクション](/reference/session-management-compaction) を参照してください。

## ベクトルメモリ検索

OpenClaw は `MEMORY.md` と `memory/*.md` に対して小さなベクトルインデックスを構築できるため、表現が異なっていてもセマンティックなクエリで関連するメモを見つけられます。

デフォルト:

- デフォルトで有効です。
- メモリファイルの変更を監視します（デバウンスあり）。
- デフォルトではリモート埋め込みを使用します。`memorySearch.provider` が設定されていない場合、OpenClaw は自動選択します:
  1. `memorySearch.local.modelPath` が設定され、ファイルが存在する場合は `local`。
  2. OpenAI のキーを解決できる場合は `openai`。
  3. Gemini のキーを解決できる場合は `gemini`。
  4. それ以外の場合、設定されるまでメモリ検索は無効のままです。
- ローカルモードは node-llama-cpp を使用し、`pnpm approve-builds` が必要になる場合があります。
- 利用可能な場合は sqlite-vec を使い、SQLite 内のベクトル検索を高速化します。

リモート埋め込みは、埋め込みプロバイダーの API キーが **必須**です。OpenClaw は認証プロファイル、`models.providers.*.apiKey`、または環境変数からキーを解決します。Codex OAuth は chat/completions のみをカバーし、メモリ検索の埋め込み要件は **満たしません**。Gemini では `GEMINI_API_KEY` または `models.providers.google.apiKey` を使用してください。カスタムの OpenAI 互換エンドポイントを使用する場合は、`memorySearch.remote.apiKey`（および任意で `memorySearch.remote.headers`）を設定します。

### QMD バックエンド（実験的）

組み込みの SQLite インデクサーを [QMD](https://github.com/tobi/qmd) に置き換えるには `memory.backend = "qmd"` を設定します。QMD は BM25 + ベクトル + 再ランキングを組み合わせる local-first の検索サイドカーです。Markdown は信頼できる唯一の情報源のままで、OpenClaw は取得のために QMD を外部呼び出しします。要点:

**前提条件**

- デフォルトでは無効です。設定単位でオプトインします（`memory.backend = "qmd"`）。
- QMD CLI は別途インストール（`bun install -g github.com/tobi/qmd` またはリリースを取得）し、`qmd` バイナリが Gateway（ゲートウェイ）の `PATH` 上にあることを確認してください。
- QMD は拡張を許可する SQLite ビルドを必要とします（macOS では `brew install sqlite`）。
- QMD は Bun + `node-llama-cpp` により完全にローカルで動作し、初回利用時に HuggingFace から GGUF モデルを自動ダウンロードします（別途 Ollama デーモンは不要）。
- Gateway（ゲートウェイ）は `XDG_CONFIG_HOME` と `XDG_CACHE_HOME` を設定し、`~/.openclaw/agents/<agentId>/qmd/` 配下の自己完結した XDG home で QMD を実行します。
- OS 対応: macOS と Linux は Bun + SQLite をインストールすればそのまま動作します。Windows は WSL2 経由が最もよくサポートされます。

**サイドカーの実行方法**

- Gateway（ゲートウェイ）は `~/.openclaw/agents/<agentId>/qmd/` 配下に自己完結した QMD home（config + cache + sqlite DB）を書き込みます。
- コレクションは `memory.qmd.paths`（およびデフォルトのワークスペースメモリファイル）から `index.yml` に再書き込みされ、その後 `qmd update` + `qmd embed` が起動時と設定可能な間隔（`memory.qmd.update.interval`、デフォルト 5 m）で実行されます。
- 検索は `qmd query --json` 経由で実行されます。QMD が失敗するかバイナリが見つからない場合、OpenClaw は自動的に組み込みの SQLite マネージャーへフォールバックし、メモリツールが動作し続けるようにします。
- **初回検索は遅い場合があります**: 初回の `qmd query` 実行時に、QMD がローカルの GGUF モデル（リランカー／クエリ拡張）をダウンロードする可能性があります。
  - OpenClaw は QMD 実行時に `XDG_CONFIG_HOME`/`XDG_CACHE_HOME` を自動設定します。
  - 手動でモデルを事前ダウンロード（および OpenClaw が使用する同じインデックスをウォームアップ）したい場合は、エージェントの XDG ディレクトリで一度だけクエリを実行してください。

    OpenClaw の QMD 状態は **state dir**（デフォルトは `~/.openclaw`）配下にあります。OpenClaw が使用する同じ XDG 変数をエクスポートすることで、`qmd` をまったく同じインデックスに向けられます。

    ```bash
    # Pick the same state dir OpenClaw uses
    STATE_DIR="${OPENCLAW_STATE_DIR:-$HOME/.openclaw}"
    if [ -d "$HOME/.moltbot" ] && [ ! -d "$HOME/.openclaw" ] \
      && [ -z "${OPENCLAW_STATE_DIR:-}" ]; then
      STATE_DIR="$HOME/.moltbot"
    fi

    export XDG_CONFIG_HOME="$STATE_DIR/agents/main/qmd/xdg-config"
    export XDG_CACHE_HOME="$STATE_DIR/agents/main/qmd/xdg-cache"

    # (Optional) force an index refresh + embeddings
    qmd update
    qmd embed

    # Warm up / trigger first-time model downloads
    qmd query "test" -c memory-root --json >/dev/null 2>&1
    ```

**設定サーフェス（`memory.qmd.*`）**

- `command`（デフォルト `qmd`）: 実行ファイルパスを上書きします。
- `includeDefaultMemory`（デフォルト `true`）: `MEMORY.md` + `memory/**/*.md` を自動インデックス化します。
- `paths[]`: 追加のディレクトリ／ファイルを追加します（`path`、任意の `pattern`、任意の安定 `name`）。
- `sessions`: セッション JSONL のインデックス化にオプトインします（`enabled`、`retentionDays`、`exportDir`）。
- `update`: 更新間隔を制御します（`interval`、`debounceMs`、`onBoot`、`embedInterval`）。
- `limits`: リコールのペイロードをクランプします（`maxResults`、`maxSnippetChars`、`maxInjectedChars`、`timeoutMs`）。
- `scope`: [`session.sendPolicy`](/gateway/configuration#session) と同じスキーマです。デフォルトは DM のみ（`deny` は全て、`allow` はダイレクトチャット）です。グループ／チャンネルで QMD のヒットを表示するには緩めます。
- ワークスペース外から取得したスニペットは、`memory_search` の結果で `qmd/<collection>/<relative-path>` として表示されます。`memory_get` はそのプレフィックスを解釈し、設定された QMD コレクションルートから読み込みます。
- `memory.qmd.sessions.enabled = true` の場合、OpenClaw はサニタイズされたセッショントランスクリプト（User/Assistant のターン）を `~/.openclaw/agents/<id>/qmd/sessions/` 配下の専用 QMD コレクションへエクスポートし、組み込みの SQLite インデックスに触れずに `memory_search` が最近の会話をリコールできるようにします。
- `memory.citations` が `auto`/`on` の場合、`memory_search` のスニペットに `Source: <path#line>` フッターが付くようになりました。`memory.citations = "off"` を設定するとパスのメタデータを内部に保持できます（エージェントは `memory_get` のためにパスを受け取りますが、スニペット本文からはフッターが省かれ、システムプロンプトでエージェントに引用しないよう警告されます）。

**例**

```json5
memory: {
  backend: "qmd",
  citations: "auto",
  qmd: {
    includeDefaultMemory: true,
    update: { interval: "5m", debounceMs: 15000 },
    limits: { maxResults: 6, timeoutMs: 4000 },
    scope: {
      default: "deny",
      rules: [{ action: "allow", match: { chatType: "direct" } }]
    },
    paths: [
      { name: "docs", path: "~/notes", pattern: "**/*.md" }
    ]
  }
}
```

**引用とフォールバック**

- `memory.citations` はバックエンド（`auto`/`on`/`off`）に関係なく適用されます。
- `qmd` が動作する際、診断でどのエンジンが結果を返したかを示すために `status().backend = "qmd"` をタグ付けします。QMD のサブプロセスが終了するか JSON 出力を解析できない場合、検索マネージャーは警告をログに記録し、QMD が回復するまで組み込みプロバイダー（既存の Markdown 埋め込み）を返します。

### 追加のメモリパス

デフォルトのワークスペースレイアウト外の Markdown ファイルをインデックス化したい場合は、明示的なパスを追加します。

```json5
agents: {
  defaults: {
    memorySearch: {
      extraPaths: ["../team-docs", "/srv/shared-notes/overview.md"]
    }
  }
}
```

注記:

- パスは絶対パスまたはワークスペース相対パスにできます。
- ディレクトリは `.md` ファイルを再帰的にスキャンします。
- インデックス化されるのは Markdown ファイルのみです。
- シンボリックリンク（ファイル／ディレクトリ）は無視されます。

### Gemini 埋め込み（ネイティブ）

Gemini の埋め込み API を直接使用するには、プロバイダーを `gemini` に設定します。

```json5
agents: {
  defaults: {
    memorySearch: {
      provider: "gemini",
      model: "gemini-embedding-001",
      remote: {
        apiKey: "YOUR_GEMINI_API_KEY"
      }
    }
  }
}
```

注記:

- `remote.baseUrl` は任意です（デフォルトは Gemini API の base URL）。
- `remote.headers` で、必要に応じて追加ヘッダーを追加できます。
- デフォルトモデル: `gemini-embedding-001`。

**カスタム OpenAI 互換エンドポイント**（OpenRouter、vLLM、またはプロキシ）を使用したい場合は、OpenAI プロバイダーで `remote` 設定を使用できます。

```json5
agents: {
  defaults: {
    memorySearch: {
      provider: "openai",
      model: "text-embedding-3-small",
      remote: {
        baseUrl: "https://api.example.com/v1/",
        apiKey: "YOUR_OPENAI_COMPAT_API_KEY",
        headers: { "X-Custom-Header": "value" }
      }
    }
  }
}
```

API キーを設定したくない場合は、`memorySearch.provider = "local"` を使用するか `memorySearch.fallback = "none"` を設定します。

フォールバック:

- `memorySearch.fallback` は `openai`、`gemini`、`local`、または `none` にできます。
- フォールバックプロバイダーは、プライマリの埋め込みプロバイダーが失敗した場合にのみ使用されます。

バッチインデックス化（OpenAI + Gemini）:

- OpenAI と Gemini の埋め込みではデフォルトで有効です。無効化するには `agents.defaults.memorySearch.remote.batch.enabled = false` を設定します。
- デフォルトの挙動ではバッチ完了を待ちます。必要に応じて `remote.batch.wait`、`remote.batch.pollIntervalMs`、`remote.batch.timeoutMinutes` を調整してください。
- 並列に送信するバッチジョブ数を制御するには `remote.batch.concurrency` を設定します（デフォルト: 2）。
- バッチモードは `memorySearch.provider = "openai"` または `"gemini"` の場合に適用され、対応する API キーを使用します。
- Gemini のバッチジョブは async embeddings のバッチエンドポイントを使用し、Gemini Batch API の提供状況が必要です。

OpenAI のバッチが高速 + 低コストな理由:

- 大規模なバックフィルでは、多数の埋め込みリクエストを 1 つのバッチジョブにまとめて送信し、OpenAI 側で非同期に処理できるため、OpenAI が通常は最速の選択肢になります。
- OpenAI は Batch API のワークロードに割引価格を提供しているため、大規模なインデックス化は同一リクエストを同期送信するより安価になることが一般的です。
- 詳細は OpenAI Batch API のドキュメントと価格表を参照してください:
  - https://platform.openai.com/docs/api-reference/batch
  - https://platform.openai.com/pricing

設定例:

```json5
agents: {
  defaults: {
    memorySearch: {
      provider: "openai",
      model: "text-embedding-3-small",
      fallback: "openai",
      remote: {
        batch: { enabled: true, concurrency: 2 }
      },
      sync: { watch: true }
    }
  }
}
```

ツール:

- `memory_search` — ファイル + 行範囲付きでスニペットを返します。
- `memory_get` — パスでメモリファイルの内容を読み込みます。

ローカルモード:

- `agents.defaults.memorySearch.provider = "local"` を設定します。
- `agents.defaults.memorySearch.local.modelPath`（GGUF または `hf:` URI）を指定します。
- 任意: リモートフォールバックを避けるには `agents.defaults.memorySearch.fallback = "none"` を設定します。

### メモリツールの動作

- `memory_search` は、`MEMORY.md` + `memory/**/*.md` から Markdown チャンク（目標 ~400 トークン、80 トークンのオーバーラップ）をセマンティック検索します。スニペット本文（~700 文字で上限）、ファイルパス、行範囲、スコア、プロバイダー／モデル、ローカル → リモート埋め込みにフォールバックしたかどうかを返します。ファイル全体のペイロードは返しません。
- `memory_get` は、特定のメモリ Markdown ファイル（ワークスペース相対）を読み込みます。開始行と N 行分を任意で指定できます。`MEMORY.md` / `memory/` の外側のパスは拒否されます。
- どちらのツールも、エージェントに対して `memorySearch.enabled` が true と解決された場合にのみ有効です。

### 何が（いつ）インデックス化されるか

- ファイル種別: Markdown のみ（`MEMORY.md`、`memory/**/*.md`）。
- インデックス保存先: エージェントごとの SQLite を `~/.openclaw/memory/<agentId>.sqlite` に保存（`agents.defaults.memorySearch.store.path` で設定可能、`{agentId}` トークンに対応）。
- 鮮度: `MEMORY.md` + `memory/` のウォッチャーがインデックスを dirty にします（デバウンス 1.5 s）。同期はセッション開始時、検索時、または一定間隔でスケジュールされ、非同期で実行されます。セッショントランスクリプトはデルタしきい値を使ってバックグラウンド同期をトリガーします。
- 再インデックスのトリガー: インデックスは埋め込みの **プロバイダー／モデル + エンドポイントのフィンガープリント + チャンク化パラメータ** を保持します。これらのいずれかが変わると、OpenClaw は自動的にストア全体をリセットして再インデックス化します。

### ハイブリッド検索（BM25 + ベクトル）

有効化すると、OpenClaw は次を組み合わせます。

- **ベクトル類似度**（セマンティック一致、言い回しが異なってもよい）
- **BM25 のキーワード関連度**（ID、環境変数、コードシンボルのような正確なトークン）

プラットフォームで全文検索が利用できない場合、OpenClaw はベクトルのみの検索にフォールバックします。

#### なぜハイブリッドなのか

ベクトル検索は「同じ意味である」に強いです:

- 「Mac Studio gateway host」vs「gateway を動かしているマシン」
- 「debounce file updates」vs「毎回の書き込みでインデックス化しない」

一方で、厳密でシグナルの強いトークンには弱いことがあります:

- ID（`a828e60`、`b3b9895a…`）
- コードシンボル（`memorySearch.query.hybrid`）
- エラー文字列（「sqlite-vec unavailable」）

BM25（全文検索）はその逆で、厳密なトークンに強く、言い換えには弱いです。ハイブリッド検索は実用的な中間解です。**両方の取得シグナルを使う**ことで、「自然言語」クエリと「干し草の山から針を探す」クエリの両方で良い結果を得られます。

#### 結果をマージする方法（現行デザイン）

実装スケッチ:

1. 両方から候補プールを取得します:

- **ベクトル**: コサイン類似度の上位 `maxResults * candidateMultiplier`。
- **BM25**: FTS5 の BM25 ランクの上位 `maxResults * candidateMultiplier`（低いほど良い）。

2. BM25 ランクを 0..1 風のスコアに変換します:

- `textScore = 1 / (1 + max(0, bm25Rank))`

3. チャンク ID で候補を和集合にし、重み付きスコアを計算します:

- `finalScore = vectorWeight * vectorScore + textWeight * textScore`

注記:

- `vectorWeight` + `textWeight` は設定解決時に 1.0 へ正規化されるため、重みは割合として振る舞います。
- 埋め込みが利用できない場合（またはプロバイダーがゼロベクトルを返す場合）でも、BM25 を実行してキーワード一致を返します。
- FTS5 を作成できない場合は、ベクトルのみの検索を継続します（ハード失敗しません）。

これは「IR 理論として完璧」ではありませんが、シンプルで高速であり、実際のメモでは再現率／適合率が向上する傾向があります。将来的に凝るなら、次の一般的なステップは Reciprocal Rank Fusion（RRF）や、混合前のスコア正規化（min/max または z-score）です。

設定:

```json5
agents: {
  defaults: {
    memorySearch: {
      query: {
        hybrid: {
          enabled: true,
          vectorWeight: 0.7,
          textWeight: 0.3,
          candidateMultiplier: 4
        }
      }
    }
  }
}
```

### 埋め込みキャッシュ

OpenClaw は SQLite に **チャンク埋め込み**をキャッシュできるため、再インデックス化や頻繁な更新（特にセッショントランスクリプト）で、変更されていないテキストを再埋め込みしません。

設定:

```json5
agents: {
  defaults: {
    memorySearch: {
      cache: {
        enabled: true,
        maxEntries: 50000
      }
    }
  }
}
```

### セッションメモリ検索（実験的）

任意で **セッショントランスクリプト**をインデックス化し、`memory_search` 経由で表示できます。これは実験フラグの背後にあります。

```json5
agents: {
  defaults: {
    memorySearch: {
      experimental: { sessionMemory: true },
      sources: ["memory", "sessions"]
    }
  }
}
```

注記:

- セッションのインデックス化は **オプトイン**です（デフォルトはオフ）。
- セッション更新はデバウンスされ、デルタしきい値を超えたら **非同期でインデックス化**されます（ベストエフォート）。
- `memory_search` はインデックス化を待ってブロックしません。バックグラウンド同期が完了するまで結果がやや古い場合があります。
- 結果は引き続きスニペットのみを含みます。`memory_get` は引き続きメモリファイルに限定されます。
- セッションのインデックス化はエージェントごとに分離されます（そのエージェントのセッションログのみがインデックス化されます）。
- セッションログはディスク上にあります（`~/.openclaw/agents/<agentId>/sessions/*.jsonl`）。ファイルシステムアクセス権を持つプロセス／ユーザーは読み取れるため、信頼境界はディスクアクセスとして扱ってください。より厳密に分離するには、OS ユーザーまたはホストを分けてエージェントを実行してください。

デルタしきい値（デフォルト値を表示）:

```json5
agents: {
  defaults: {
    memorySearch: {
      sync: {
        sessions: {
          deltaBytes: 100000,   // ~100 KB
          deltaMessages: 50     // JSONL lines
        }
      }
    }
  }
}
```

### SQLite のベクトル高速化（sqlite-vec）

sqlite-vec 拡張が利用可能な場合、OpenClaw は埋め込みを SQLite の仮想テーブル（`vec0`）に保存し、ベクトル距離クエリをデータベース内で実行します。これにより、すべての埋め込みを JS に読み込まずに検索を高速化できます。

設定（任意）:

```json5
agents: {
  defaults: {
    memorySearch: {
      store: {
        vector: {
          enabled: true,
          extensionPath: "/path/to/sqlite-vec"
        }
      }
    }
  }
}
```

注記:

- `enabled` はデフォルトで true です。無効化すると、検索は保存された埋め込みに対するプロセス内のコサイン類似度にフォールバックします。
- sqlite-vec 拡張が見つからない、または読み込みに失敗した場合、OpenClaw はエラーをログに記録し、JS のフォールバック（ベクトルテーブルなし）で継続します。
- `extensionPath` はバンドルされた sqlite-vec パスを上書きします（カスタムビルドや非標準のインストール場所で有用です）。

### ローカル埋め込みの自動ダウンロード

- デフォルトのローカル埋め込みモデル: `hf:ggml-org/embeddinggemma-300M-GGUF/embeddinggemma-300M-Q8_0.gguf`（約 0.6 GB）。
- `memorySearch.provider = "local"` の場合、`node-llama-cpp` は `modelPath` に解決されます。GGUF が見つからない場合は、キャッシュ（または `local.modelCacheDir` が設定されていればそこ）へ **自動ダウンロード**してから読み込みます。ダウンロードはリトライ時に再開されます。
- ネイティブビルド要件: `pnpm approve-builds` を実行し、`node-llama-cpp` を選択してから、`pnpm rebuild node-llama-cpp` を実行します。
- フォールバック: ローカル設定に失敗し、かつ `memorySearch.fallback = "openai"` の場合、リモート埋め込み（上書きがなければ `openai/text-embedding-3-small`）へ自動的に切り替え、理由を記録します。

### カスタム OpenAI 互換エンドポイントの例

```json5
agents: {
  defaults: {
    memorySearch: {
      provider: "openai",
      model: "text-embedding-3-small",
      remote: {
        baseUrl: "https://api.example.com/v1/",
        apiKey: "YOUR_REMOTE_API_KEY",
        headers: {
          "X-Organization": "org-id",
          "X-Project": "project-id"
        }
      }
    }
  }
}
```

注記:

- `remote.*` は `models.providers.openai.*` より優先されます。
- `remote.headers` は OpenAI ヘッダーとマージされ、キー競合時はリモート側が勝ちます。OpenAI のデフォルトを使うには `remote.headers` を省略してください。
