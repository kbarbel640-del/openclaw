---
summary: "OpenClaw のシステムプロンプトに含まれる内容と、その組み立て方法"
read_when:
  - システムプロンプト文言、ツール一覧、または時刻/ハートビートセクションを編集する場合
  - ワークスペースのブートストラップまたは Skills 注入の挙動を変更する場合
title: "システムプロンプト"
x-i18n:
  source_path: concepts/system-prompt.md
  source_hash: bef4b2674ba0414c
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:12:13Z
---

# システムプロンプト

OpenClaw は、各エージェント実行ごとにカスタムのシステムプロンプトを構築します。このプロンプトは **OpenClaw が所有**しており、p-coding-agent のデフォルトプロンプトは使用しません。

プロンプトは OpenClaw によって組み立てられ、各エージェント実行に注入されます。

## 構造

プロンプトは意図的にコンパクトで、固定セクションを使用します。

- **Tooling**: 現在のツール一覧 + 簡単な説明。
- **Safety**: 権力追求的な振る舞い、または監督の回避を避けるための短いガードレールのリマインダー。
- **Skills**（利用可能な場合）: 必要に応じて Skills の指示をオンデマンドで読み込む方法をモデルに伝えます。
- **OpenClaw Self-Update**: `config.apply` と `update.run` の実行方法。
- **Workspace**: 作業ディレクトリ（`agents.defaults.workspace`）。
- **Documentation**: OpenClaw ドキュメント（リポジトリまたは npm パッケージ）のローカルパスと、いつ読むべきか。
- **Workspace Files (injected)**: ブートストラップファイルが下に含まれていることを示します。
- **Sandbox**（有効時）: サンドボックス化されたランタイム、サンドボックスパス、昇格 exec が利用可能かどうかを示します。
- **Current Date & Time**: ユーザーのローカル時刻、タイムゾーン、時刻フォーマット。
- **Reply Tags**: サポートされるプロバイダー向けの任意の返信タグ構文。
- **Heartbeats**: ハートビートのプロンプトと ack の挙動。
- **Runtime**: ホスト、OS、node、モデル、リポジトリルート（検出時）、思考レベル（1 行）。
- **Reasoning**: 現在の可視性レベル + /reasoning 切り替えのヒント。

システムプロンプト内の Safety ガードレールは助言的なものです。モデルの挙動を導きますが、ポリシーを強制しません。強制には、ツールポリシー、exec 承認、サンドボックス化、チャンネル許可リストを使用してください。オペレーターは設計上これらを無効化できます。

## プロンプトモード

OpenClaw は、サブエージェント向けにより小さいシステムプロンプトをレンダリングできます。ランタイムは実行ごとに
`promptMode` を設定します（ユーザー向けの設定ではありません）。

- `full`（デフォルト）: 上記のすべてのセクションを含みます。
- `minimal`: サブエージェントに使用されます。**Skills**、**Memory Recall**、**OpenClaw
  Self-Update**、**Model Aliases**、**User Identity**、**Reply Tags**、
  **Messaging**、**Silent Replies**、および **Heartbeats** を省きます。Tooling、**Safety**、
  Workspace、Sandbox、Current Date & Time（既知の場合）、Runtime、および注入された
  コンテキストは利用可能なままです。
- `none`: ベースのアイデンティティ行のみを返します。

`promptMode=minimal` の場合、追加で注入されるプロンプトは **Group Chat Context** ではなく **Subagent
Context** としてラベル付けされます。

## ワークスペースのブートストラップ注入

ブートストラップファイルはトリミングされ、**Project Context** の下に追記されます。これにより、モデルは明示的に読み取らなくてもアイデンティティとプロファイルのコンテキストを把握できます。

- `AGENTS.md`
- `SOUL.md`
- `TOOLS.md`
- `IDENTITY.md`
- `USER.md`
- `HEARTBEAT.md`
- `BOOTSTRAP.md`（新品のワークスペースでのみ）

大きなファイルはマーカー付きで切り詰められます。ファイルごとの最大サイズは
`agents.defaults.bootstrapMaxChars`（デフォルト: 20000）で制御されます。欠落しているファイルは、
短い欠落ファイルマーカーを注入します。

内部フックは `agent:bootstrap` を介してこのステップをインターセプトし、注入されるブートストラップファイルを変更または置換できます（例: `SOUL.md` を別のペルソナに差し替える）。

注入された各ファイルの寄与量（raw vs injected、切り詰め、ツールスキーマのオーバーヘッドを含む）を確認するには、`/context list` または `/context detail` を使用してください。[Context](/concepts/context) を参照してください。

## 時刻の取り扱い

ユーザーのタイムゾーンが既知の場合、システムプロンプトには専用の **Current Date & Time** セクションが含まれます。プロンプトのキャッシュ安定性を保つため、現在は **time zone**（動的な時計や時刻フォーマットなし）のみを含めます。

エージェントが現在時刻を必要とする場合は `session_status` を使用します。ステータスカードにはタイムスタンプ行が含まれます。

設定は以下です。

- `agents.defaults.userTimezone`
- `agents.defaults.timeFormat`（`auto` | `12` | `24`）

挙動の詳細は [Date & Time](/date-time) を参照してください。

## Skills

適格な Skills が存在する場合、OpenClaw はコンパクトな **利用可能なスキル一覧**
（`formatSkillsForPrompt`）を注入し、各スキルの **ファイルパス** を含めます。プロンプトは、一覧に記載された場所（ワークスペース、管理対象、またはバンドル）にある SKILL.md を読み込むために `read` を使用するよう、モデルに指示します。適格な Skills がない場合、Skills セクションは省略されます。

```
<available_skills>
  <skill>
    <name>...</name>
    <description>...</description>
    <location>...</location>
  </skill>
</available_skills>
```

これにより、ベースプロンプトを小さく保ちつつ、狙いを定めたスキル利用を可能にします。

## Documentation

利用可能な場合、システムプロンプトには **Documentation** セクションが含まれ、ローカルの OpenClaw ドキュメントディレクトリ（ワークスペース内のリポジトリでは `docs/`、またはバンドルされた npm パッケージのドキュメント）を指し示します。また、公開ミラー、ソースリポジトリ、コミュニティ Discord、Skills 検索のための ClawHub（https://clawhub.com）についても記します。プロンプトは、OpenClaw の挙動、コマンド、設定、またはアーキテクチャについてはまずローカルドキュメントを参照し、可能であれば `openclaw status` を自身で実行するようモデルに指示します（アクセスできない場合にのみユーザーへ問い合わせます）。
