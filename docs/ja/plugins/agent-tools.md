---
summary: "プラグインでエージェントツールを作成する（スキーマ、オプションツール、許可リスト）"
read_when:
  - プラグインで新しいエージェントツールを追加したいとき
  - 許可リストによってツールをオプトインにする必要があるとき
title: "プラグインのエージェントツール"
x-i18n:
  source_path: plugins/agent-tools.md
  source_hash: 4479462e9d8b17b6
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:34:29Z
---

# プラグインのエージェントツール

OpenClaw プラグインは、エージェント実行中に LLM に公開される **エージェントツール**（JSON‑schema 関数）を登録できます。ツールは **必須**（常に利用可能）または **オプション**（オプトイン）にできます。

エージェントツールは、メイン設定の `tools`、またはエージェントごとの `agents.list[].tools` 配下で設定します。許可リスト／拒否リストのポリシーにより、エージェントが呼び出せるツールが制御されます。

## 基本的なツール

```ts
import { Type } from "@sinclair/typebox";

export default function (api) {
  api.registerTool({
    name: "my_tool",
    description: "Do a thing",
    parameters: Type.Object({
      input: Type.String(),
    }),
    async execute(_id, params) {
      return { content: [{ type: "text", text: params.input }] };
    },
  });
}
```

## オプションツール（オプトイン）

オプションツールは **自動で有効化されることはありません**。ユーザーがエージェントの許可リストに追加する必要があります。

```ts
export default function (api) {
  api.registerTool(
    {
      name: "workflow_tool",
      description: "Run a local workflow",
      parameters: {
        type: "object",
        properties: {
          pipeline: { type: "string" },
        },
        required: ["pipeline"],
      },
      async execute(_id, params) {
        return { content: [{ type: "text", text: params.pipeline }] };
      },
    },
    { optional: true },
  );
}
```

`agents.list[].tools.allow`（またはグローバルな `tools.allow`）でオプションツールを有効化します。

```json5
{
  agents: {
    list: [
      {
        id: "main",
        tools: {
          allow: [
            "workflow_tool", // specific tool name
            "workflow", // plugin id (enables all tools from that plugin)
            "group:plugins", // all plugin tools
          ],
        },
      },
    ],
  },
}
```

ツールの可用性に影響するその他の設定項目は次のとおりです。

- プラグインツールのみを名前指定した許可リストは、プラグインのオプトインとして扱われます。コアツールは、許可リストにコアツールやグループを含めない限り、有効のままです。
- `tools.profile` / `agents.list[].tools.profile`（ベース許可リスト）
- `tools.byProvider` / `agents.list[].tools.byProvider`（プロバイダー固有の許可／拒否）
- `tools.sandbox.tools.*`（サンドボックス化されている場合のサンドボックスツールポリシー）

## ルールとヒント

- ツール名はコアツール名と **競合してはいけません**。競合するツールはスキップされます。
- 許可リストで使用するプラグイン ID は、コアツール名と競合してはいけません。
- 副作用を引き起こす、または追加のバイナリや認証情報を必要とするツールには、`optional: true` を優先して使用してください。
