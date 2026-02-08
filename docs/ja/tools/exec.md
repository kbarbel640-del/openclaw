---
summary: "Exec ツールの使い方、stdin モード、および TTY サポート"
read_when:
  - Exec ツールを使用または変更する場合
  - stdin または TTY の挙動をデバッグする場合
title: "Exec ツール"
x-i18n:
  source_path: tools/exec.md
  source_hash: 3b32238dd8dce93d
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:12:59Z
---

# Exec ツール

ワークスペースでシェルコマンドを実行します。`process` によるフォアグラウンド + バックグラウンド実行をサポートします。
`process` が許可されていない場合、`exec` は同期的に実行され、`yieldMs`/`background` は無視されます。
バックグラウンドセッションはエージェント単位でスコープされます。`process` は同じエージェントのセッションのみを参照します。

## パラメーター

- `command`（必須）
- `workdir`（デフォルトは cwd）
- `env`（キー/値の上書き）
- `yieldMs`（デフォルト 10000）: 遅延後に自動バックグラウンド化
- `background`（bool）: 直ちにバックグラウンド化
- `timeout`（秒、デフォルト 1800）: 期限切れで kill
- `pty`（bool）: 利用可能な場合に疑似端末で実行します（TTY のみの CLI、コーディングエージェント、ターミナル UI）
- `host`（`sandbox | gateway | node`）: 実行場所
- `security`（`deny | allowlist | full`）: `gateway`/`node` の強制モード
- `ask`（`off | on-miss | always`）: `gateway`/`node` の承認プロンプト
- `node`（string）: `host=node` のノード id/name
- `elevated`（bool）: 昇格モード（gateway host）を要求します。昇格が `full` に解決された場合にのみ `security=full` が強制されます

注記:

- `host` のデフォルトは `sandbox` です。
- サンドボックス化がオフの場合、`elevated` は無視されます（exec はすでにホスト上で実行されます）。
- `gateway`/`node` の承認は `~/.openclaw/exec-approvals.json` により制御されます。
- `node` にはペアリング済みノード（コンパニオンアプリまたはヘッドレスノードホスト）が必要です。
- 複数ノードが利用可能な場合、`exec.node` または `tools.exec.node` を設定して 1 つを選択します。
- Windows 以外のホストでは、設定されている場合 exec は `SHELL` を使用します。`SHELL` が `fish` の場合、fish 非互換スクリプトを避けるために `PATH` から `bash`（または `sh`）を優先し、どちらも存在しない場合は `SHELL` にフォールバックします。
- ホスト実行（`gateway`/`node`）では、バイナリのハイジャックや注入コードを防ぐため、`env.PATH` とローダー上書き（`LD_*`/`DYLD_*`）を拒否します。
- 重要: サンドボックス化は **デフォルトでオフ** です。サンドボックス化がオフの場合、`host=sandbox` は gateway host 上で直接（コンテナなしで）実行され、**承認は不要** です。承認を必須にするには、`host=gateway` で実行し、exec 承認を設定してください（またはサンドボックス化を有効にしてください）。

## 設定

- `tools.exec.notifyOnExit`（デフォルト: true）: true の場合、バックグラウンド化された exec セッションはシステムイベントをキューに入れ、終了時にハートビートを要求します。
- `tools.exec.approvalRunningNoticeMs`（デフォルト: 10000）: 承認ゲート付き exec がこれより長く実行された場合に、単一の「実行中」通知を送出します（0 で無効）。
- `tools.exec.host`（デフォルト: `sandbox`）
- `tools.exec.security`（デフォルト: サンドボックスでは `deny`、未設定時は gateway + node では `allowlist`）
- `tools.exec.ask`（デフォルト: `on-miss`）
- `tools.exec.node`（デフォルト: 未設定）
- `tools.exec.pathPrepend`: exec 実行時に `PATH` の先頭に追加するディレクトリのリスト。
- `tools.exec.safeBins`: stdin のみで安全なバイナリで、明示的な許可リスト（allowlist）エントリなしでも実行できます。

例:

```json5
{
  tools: {
    exec: {
      pathPrepend: ["~/bin", "/opt/oss/bin"],
    },
  },
}
```

### PATH の取り扱い

- `host=gateway`: ログインシェルの `PATH` を exec 環境にマージします。ホスト実行では `env.PATH` の上書きは拒否されます。デーモン自体は引き続き最小限の `PATH` で動作します:
  - macOS: `/opt/homebrew/bin`、`/usr/local/bin`、`/usr/bin`、`/bin`
  - Linux: `/usr/local/bin`、`/usr/bin`、`/bin`
- `host=sandbox`: コンテナ内で `sh -lc`（ログインシェル）を実行するため、`/etc/profile` が `PATH` をリセットする場合があります。
  OpenClaw は内部環境変数（シェル補間なし）により、プロファイル読み込み後に `env.PATH` を先頭に追加します。
  `tools.exec.pathPrepend` もここに適用されます。
- `host=node`: あなたが渡したブロックされていない env 上書きのみがノードに送られます。ホスト実行では `env.PATH` の上書きは拒否されます。ヘッドレスノードホストは、それがノードホストの PATH を先頭に追加する場合（置換ではない場合）に限り `PATH` を受け入れます。macOS ノードは `PATH` の上書きを完全に破棄します。

エージェントごとのノードバインディング（設定ではエージェント一覧のインデックスを使用します）:

```bash
openclaw config get agents.list
openclaw config set agents.list[0].tools.exec.node "node-id-or-name"
```

コントロール UI: Nodes タブには、同じ設定のための小さな「Exec node binding」パネルがあります。

## セッション上書き（`/exec`）

`/exec` を使用して、`host`、`security`、`ask`、および `node` の **セッションごと** のデフォルトを設定します。
引数なしで `/exec` を送信すると、現在の値を表示します。

例:

```
/exec host=gateway security=allowlist ask=on-miss node=mac-1
```

## 認可モデル

`/exec` は **認可された送信者**（チャンネル allowlist/ペアリング + `commands.useAccessGroups`）に対してのみ尊重されます。
これは **セッション状態のみ** を更新し、設定は書き込みません。exec を強制的に無効化するには、ツール
ポリシー（`tools.deny: ["exec"]` またはエージェントごと）で拒否してください。ホスト承認は、`security=full` と `ask=off` を明示的に設定しない限り引き続き適用されます。

## Exec 承認（コンパニオンアプリ / ノードホスト）

サンドボックス化されたエージェントは、`exec` が gateway またはノードホスト上で実行される前に、リクエストごとの承認を必須にできます。
ポリシー、allowlist、および UI フローについては [Exec approvals](/tools/exec-approvals) を参照してください。

承認が必須の場合、exec ツールは即座に
`status: "approval-pending"` と承認 id を返します。承認（または拒否 / タイムアウト）されると、
Gateway（ゲートウェイ）はシステムイベント（`Exec finished` / `Exec denied`）を送出します。コマンドが `tools.exec.approvalRunningNoticeMs` 後も
実行中の場合、単一の `Exec running` 通知が送出されます。

## Allowlist + safe bins

Allowlist の強制は、**解決済みバイナリパスのみ** に一致します（ベース名一致はありません）。
`security=allowlist` の場合、シェルコマンドは、パイプラインの各セグメントがすべて
allowlist にあるか safe bin である場合にのみ自動許可されます。連結（`;`、`&&`、`||`）とリダイレクトは
allowlist モードでは拒否されます。

## 例

フォアグラウンド:

```json
{ "tool": "exec", "command": "ls -la" }
```

バックグラウンド + ポーリング:

```json
{"tool":"exec","command":"npm run build","yieldMs":1000}
{"tool":"process","action":"poll","sessionId":"<id>"}
```

キー送信（tmux 形式）:

```json
{"tool":"process","action":"send-keys","sessionId":"<id>","keys":["Enter"]}
{"tool":"process","action":"send-keys","sessionId":"<id>","keys":["C-c"]}
{"tool":"process","action":"send-keys","sessionId":"<id>","keys":["Up","Up","Enter"]}
```

送信（CR のみ送信）:

```json
{ "tool": "process", "action": "submit", "sessionId": "<id>" }
```

貼り付け（デフォルトはブラケット付き）:

```json
{ "tool": "process", "action": "paste", "sessionId": "<id>", "text": "line1\nline2\n" }
```

## apply_patch（experimental）

`apply_patch` は、構造化された複数ファイル編集のための `exec` のサブツールです。
明示的に有効化してください:

```json5
{
  tools: {
    exec: {
      applyPatch: { enabled: true, allowModels: ["gpt-5.2"] },
    },
  },
}
```

注記:

- OpenAI/OpenAI Codex モデルでのみ利用可能です。
- ツールポリシーは引き続き適用されます。`allow: ["exec"]` は暗黙的に `apply_patch` を許可します。
- 設定は `tools.exec.applyPatch` 配下にあります。
