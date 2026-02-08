---
title: "Skills の作成"
x-i18n:
  source_path: tools/creating-skills.md
  source_hash: ad801da34fe361ff
  provider: openai
  model: gpt-5.2-pro
  workflow: v1
  generated_at: 2026-02-06T05:11:49Z
---

# カスタム Skills の作成 🛠

OpenClaw は容易に拡張できるように設計されています。「Skills」は、アシスタントに新しい機能を追加するための主要な方法です。

## Skill とは何ですか？

Skill とは、`SKILL.md` ファイル（LLM に対する指示およびツール定義を提供します）と、必要に応じていくつかのスクリプトまたはリソースを含むディレクトリです。

## ステップバイステップ: 最初の Skill

### 1. ディレクトリを作成する

Skills はワークスペース内にあり、通常は `~/.openclaw/workspace/skills/` です。Skill 用の新しいフォルダーを作成します。

```bash
mkdir -p ~/.openclaw/workspace/skills/hello-world
```

### 2. `SKILL.md` を定義する

そのディレクトリに `SKILL.md` ファイルを作成します。このファイルは、メタデータに YAML フロントマターを使用し、指示に Markdown を使用します。

```markdown
---
name: hello_world
description: A simple skill that says hello.
---

# Hello World Skill

When the user asks for a greeting, use the `echo` tool to say "Hello from your custom skill!".
```

### 3. ツールを追加する（任意）

フロントマターでカスタムツールを定義することも、エージェントに既存のシステムツール（`bash` や `browser` など）を使用するよう指示することもできます。

### 4. OpenClaw を更新する

エージェントに「refresh skills」を依頼するか、Gateway（ゲートウェイ）を再起動してください。OpenClaw は新しいディレクトリを検出し、`SKILL.md` をインデックスします。

## ベストプラクティス

- **簡潔にする**: AI としてどう振る舞うかではなく、モデルに _何_ をすべきかを指示してください。
- **安全第一**: Skill が `bash` を使用する場合、信頼できないユーザー入力から任意のコマンドインジェクションを許さないよう、プロンプトが担保していることを確認してください。
- **ローカルでテストする**: テストには `openclaw agent --message "use my new skill"` を使用してください。

## 共有 Skills

[ClawHub](https://clawhub.com) で Skills を閲覧したり、Skills の提供に参加したりすることもできます。
