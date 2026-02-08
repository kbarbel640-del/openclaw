---
summary: "OpenClaw のサンドボックス化の仕組み：モード、スコープ、ワークスペースアクセス、イメージ"
title: サンドボックス化
read_when: "サンドボックス化の専用説明が必要な場合、または agents.defaults.sandbox を調整する必要がある場合。"
status: active
x-i18n:
  source_path: gateway/sandboxing.md
  source_hash: 184fc53001fc6b28
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:31:55Z
---

# サンドボックス化

OpenClaw は、**Docker コンテナ内でツールを実行**して影響範囲（blast radius）を低減できます。
これは**任意**であり、設定（`agents.defaults.sandbox` または
`agents.list[].sandbox`）によって制御されます。サンドボックス化がオフの場合、ツールはホスト上で実行されます。
Gateway（ゲートウェイ）はホスト上に常駐し、ツール実行は有効化時に隔離されたサンドボックス内で行われます。

これは完全なセキュリティ境界ではありませんが、モデルが不適切な操作を行った場合でも、ファイルシステムやプロセスへのアクセスを実質的に制限します。

## 何がサンドボックス化されるか

- ツール実行（`exec`、`read`、`write`、`edit`、`apply_patch`、`process` など）。
- 任意のサンドボックス化されたブラウザ（`agents.defaults.sandbox.browser`）。
  - 既定では、ブラウザツールが必要とする際にサンドボックスブラウザが自動起動します（CDP が到達可能であることを保証）。
    `agents.defaults.sandbox.browser.autoStart` および `agents.defaults.sandbox.browser.autoStartTimeoutMs` で設定します。
  - `agents.defaults.sandbox.browser.allowHostControl` により、サンドボックス化されたセッションが明示的にホストブラウザを対象にできます。
  - 任意の allowlist により `target: "custom"` をゲートします：`allowedControlUrls`、`allowedControlHosts`、`allowedControlPorts`。

サンドボックス化されないもの：

- Gateway（ゲートウェイ）プロセス自体。
- 明示的にホストでの実行が許可されたツール（例：`tools.elevated`）。
  - **昇格 exec はホスト上で実行され、サンドボックス化をバイパスします。**
  - サンドボックス化がオフの場合、`tools.elevated` は実行方法を変更しません（既にホスト上）。[Elevated Mode](/tools/elevated) を参照してください。

## モード

`agents.defaults.sandbox.mode` は、サンドボックス化を**いつ**使用するかを制御します：

- `"off"`：サンドボックス化なし。
- `"non-main"`：**非メイン**セッションのみサンドボックス化（通常のチャットをホストで行いたい場合の既定）。
- `"all"`：すべてのセッションをサンドボックスで実行。
  注：`"non-main"` はエージェント id ではなく `session.mainKey`（既定は `"main"`）に基づきます。
  グループ／チャンネルのセッションは独自のキーを使用するため、非メインとして扱われ、サンドボックス化されます。

## スコープ

`agents.defaults.sandbox.scope` は、作成される**コンテナ数**を制御します：

- `"session"`（既定）：セッションごとに 1 コンテナ。
- `"agent"`：エージェントごとに 1 コンテナ。
- `"shared"`：すべてのサンドボックス化セッションで 1 コンテナを共有。

## ワークスペースアクセス

`agents.defaults.sandbox.workspaceAccess` は、サンドボックスが**何を参照できるか**を制御します：

- `"none"`（既定）：ツールは `~/.openclaw/sandboxes` 配下のサンドボックスワークスペースを参照します。
- `"ro"`：エージェントワークスペースを `/agent` に読み取り専用でマウントします（`write`/`edit`/`apply_patch` を無効化）。
- `"rw"`：エージェントワークスペースを `/workspace` に読み書き可能でマウントします。

受信メディアは、アクティブなサンドボックスワークスペース（`media/inbound/*`）にコピーされます。
Skills に関する注記：`read` ツールはサンドボックスルートです。`workspaceAccess: "none"` を有効にすると、
OpenClaw は対象となる Skills をサンドボックスワークスペース（`.../skills`）にミラーし、
読み取り可能にします。`"rw"` では、ワークスペース Skills は
`/workspace/skills` から読み取れます。

## カスタム bind マウント

`agents.defaults.sandbox.docker.binds` は、追加のホストディレクトリをコンテナにマウントします。
形式：`host:container:mode`（例：`"/home/user/source:/source:rw"`）。

グローバルおよびエージェント単位の bind は**マージ**されます（置き換えではありません）。
`scope: "shared"` の下では、エージェント単位の bind は無視されます。

例（読み取り専用ソース + Docker ソケット）：

```json5
{
  agents: {
    defaults: {
      sandbox: {
        docker: {
          binds: ["/home/user/source:/source:ro", "/var/run/docker.sock:/var/run/docker.sock"],
        },
      },
    },
    list: [
      {
        id: "build",
        sandbox: {
          docker: {
            binds: ["/mnt/cache:/cache:rw"],
          },
        },
      },
    ],
  },
}
```

セキュリティ上の注意：

- bind はサンドボックスのファイルシステムをバイパスします。設定したモード（`:ro` または `:rw`）でホストパスを公開します。
- 機密性の高いマウント（例：`docker.sock`、シークレット、SSH キー）は、絶対に必要でない限り `:ro` にしてください。
- ワークスペースへの読み取り専用アクセスのみが必要な場合は `workspaceAccess: "ro"` と併用してください。bind のモードは独立して維持されます。
- bind がツールポリシーや昇格 exec とどのように相互作用するかは、[Sandbox vs Tool Policy vs Elevated](/gateway/sandbox-vs-tool-policy-vs-elevated) を参照してください。

## イメージ + セットアップ

既定のイメージ：`openclaw-sandbox:bookworm-slim`

一度ビルドします：

```bash
scripts/sandbox-setup.sh
```

注：既定のイメージには **Node** が含まれていません。Skill が Node（または
他のランタイム）を必要とする場合は、カスタムイメージを作成するか、
`sandbox.docker.setupCommand` でインストールしてください（ネットワーク egress + 書き込み可能な root +
root ユーザーが必要）。

サンドボックス化されたブラウザのイメージ：

```bash
scripts/sandbox-browser-setup.sh
```

既定では、サンドボックスコンテナは **ネットワークなし** で実行されます。
`agents.defaults.sandbox.docker.network` で上書きできます。

Docker のインストールおよびコンテナ化された Gateway（ゲートウェイ）は以下にあります：
[Docker](/install/docker)

## setupCommand（コンテナの一回限りのセットアップ）

`setupCommand` は、サンドボックスコンテナの作成後に **一度だけ** 実行されます（毎回の実行ではありません）。
`sh -lc` 経由でコンテナ内で実行されます。

パス：

- グローバル：`agents.defaults.sandbox.docker.setupCommand`
- エージェント単位：`agents.list[].sandbox.docker.setupCommand`

よくある落とし穴：

- 既定の `docker.network` は `"none"`（egress なし）のため、パッケージのインストールは失敗します。
- `readOnlyRoot: true` は書き込みを防止します。`readOnlyRoot: false` を設定するか、カスタムイメージを作成してください。
- パッケージのインストールには `user` が root である必要があります（`user` を省略するか、`user: "0:0"` を設定）。
- サンドボックス exec はホストの `process.env` を**継承しません**。
  Skill の API キーには `agents.defaults.sandbox.docker.env`（またはカスタムイメージ）を使用してください。

## ツールポリシー + エスケープハッチ

ツールの allow/deny ポリシーは、サンドボックス規則より前に適用されます。
ツールがグローバルまたはエージェント単位で拒否されている場合、サンドボックス化で復活することはありません。

`tools.elevated` は、ホスト上で `exec` を実行する明示的なエスケープハッチです。
`/exec` ディレクティブは認可された送信者にのみ適用され、セッションごとに持続します。
`exec` を完全に無効化するには、ツールポリシーの deny を使用してください
（[Sandbox vs Tool Policy vs Elevated](/gateway/sandbox-vs-tool-policy-vs-elevated) を参照）。

デバッグ：

- `openclaw sandbox explain` を使用して、有効なサンドボックスモード、ツールポリシー、修正用の設定キーを確認します。
- 「なぜブロックされるのか？」の思考モデルについては [Sandbox vs Tool Policy vs Elevated](/gateway/sandbox-vs-tool-policy-vs-elevated) を参照してください。
  ロックダウンを維持してください。

## マルチエージェントの上書き

各エージェントは、サンドボックス + ツールを上書きできます：
`agents.list[].sandbox` および `agents.list[].tools`（サンドボックス用ツールポリシーとして `agents.list[].tools.sandbox.tools`）。
優先順位については [Multi-Agent Sandbox & Tools](/multi-agent-sandbox-tools) を参照してください。

## 最小有効化の例

```json5
{
  agents: {
    defaults: {
      sandbox: {
        mode: "non-main",
        scope: "session",
        workspaceAccess: "none",
      },
    },
  },
}
```

## 関連ドキュメント

- [Sandbox Configuration](/gateway/configuration#agentsdefaults-sandbox)
- [Multi-Agent Sandbox & Tools](/multi-agent-sandbox-tools)
- [Security](/gateway/security)
