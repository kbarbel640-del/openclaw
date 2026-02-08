---
summary: "OpenClaw からデバイスフローを使用して GitHub Copilot にサインインします"
read_when:
  - GitHub Copilot をモデルプロバイダーとして使用したい場合
  - `openclaw models auth login-github-copilot` フローが必要な場合
title: "GitHub Copilot"
x-i18n:
  source_path: providers/github-copilot.md
  source_hash: 503e0496d92c921e
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:35Z
---

# GitHub Copilot

## GitHub Copilot とは？

GitHub Copilot は GitHub の AI コーディングアシスタントです。GitHub アカウントとプランに基づいて Copilot モデルへのアクセスを提供します。OpenClaw は、2 つの異なる方法で Copilot をモデルプロバイダーとして使用できます。

## OpenClaw で Copilot を使用する 2 つの方法

### 1) 組み込みの GitHub Copilot プロバイダー（`github-copilot`）

ネイティブのデバイスログインフローを使用して GitHub トークンを取得し、OpenClaw の実行時にそれを Copilot API トークンと交換します。VS Code を必要としないため、**デフォルト**で最も簡単な方法です。

### 2) Copilot Proxy プラグイン（`copilot-proxy`）

**Copilot Proxy** の VS Code 拡張機能をローカルブリッジとして使用します。OpenClaw はプロキシの `/v1` エンドポイントと通信し、そこで設定したモデル一覧を使用します。すでに VS Code で Copilot Proxy を実行している場合や、そこを経由する必要がある場合に選択してください。プラグインを有効にし、VS Code 拡張機能を起動したままにする必要があります。

GitHub Copilot をモデルプロバイダーとして使用します（`github-copilot`）。ログインコマンドは GitHub のデバイスフローを実行し、認証プロファイルを保存し、そのプロファイルを使用するよう設定を更新します。

## CLI セットアップ

```bash
openclaw models auth login-github-copilot
```

URL にアクセスしてワンタイムコードを入力するよう求められます。完了するまでターミナルを開いたままにしてください。

### オプションのフラグ

```bash
openclaw models auth login-github-copilot --profile-id github-copilot:work
openclaw models auth login-github-copilot --yes
```

## 既定のモデルを設定

```bash
openclaw models set github-copilot/gpt-4o
```

### 設定スニペット

```json5
{
  agents: { defaults: { model: { primary: "github-copilot/gpt-4o" } } },
}
```

## 注記

- 対話型の TTY が必要です。ターミナルで直接実行してください。
- Copilot のモデル提供状況はプランに依存します。モデルが拒否された場合は、別の ID を試してください（例：`github-copilot/gpt-4.1`）。
- ログインにより、GitHub トークンが認証プロファイルストアに保存され、OpenClaw の実行時に Copilot API トークンと交換されます。
