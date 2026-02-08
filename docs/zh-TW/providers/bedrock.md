---
summary: 「使用 Amazon Bedrock（Converse API）模型搭配 OpenClaw」
read_when:
  - 您想要使用 Amazon Bedrock 模型搭配 OpenClaw
  - 您需要為模型呼叫設定 AWS 憑證／區域
title: 「Amazon Bedrock」
x-i18n:
  source_path: providers/bedrock.md
  source_hash: d2e02a8c51586219
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:15:07Z
---

# Amazon Bedrock

OpenClaw 可以透過 pi‑ai 的 **Bedrock Converse** 串流提供者使用 **Amazon Bedrock** 模型。Bedrock 的驗證使用 **AWS SDK 預設憑證鏈**，而非 API 金鑰。

## pi‑ai 支援內容

- 提供者：`amazon-bedrock`
- API：`bedrock-converse-stream`
- 驗證：AWS 憑證（環境變數、共用設定，或執行個體角色）
- 區域：`AWS_REGION` 或 `AWS_DEFAULT_REGION`（預設：`us-east-1`）

## 自動模型探索

若偵測到 AWS 憑證，OpenClaw 會自動探索支援 **串流** 與 **文字輸出** 的 Bedrock 模型。探索使用 `bedrock:ListFoundationModels`，並會快取（預設：1 小時）。

設定選項位於 `models.bedrockDiscovery` 之下：

```json5
{
  models: {
    bedrockDiscovery: {
      enabled: true,
      region: "us-east-1",
      providerFilter: ["anthropic", "amazon"],
      refreshInterval: 3600,
      defaultContextWindow: 32000,
      defaultMaxTokens: 4096,
    },
  },
}
```

備註：

- 當存在 AWS 憑證時，`enabled` 預設為 `true`。
- `region` 預設為 `AWS_REGION` 或 `AWS_DEFAULT_REGION`，接著為 `us-east-1`。
- `providerFilter` 需符合 Bedrock 提供者名稱（例如 `anthropic`）。
- `refreshInterval` 以秒為單位；設定為 `0` 可停用快取。
- `defaultContextWindow`（預設：`32000`）與 `defaultMaxTokens`（預設：`4096`）
  會用於已探索的模型（若您知道模型限制，請覆寫）。

## 設定（手動）

1. 確保 **Gateway 閘道器 主機** 上可取得 AWS 憑證：

```bash
export AWS_ACCESS_KEY_ID="AKIA..."
export AWS_SECRET_ACCESS_KEY="..."
export AWS_REGION="us-east-1"
# Optional:
export AWS_SESSION_TOKEN="..."
export AWS_PROFILE="your-profile"
# Optional (Bedrock API key/bearer token):
export AWS_BEARER_TOKEN_BEDROCK="..."
```

2. 在您的設定中新增 Bedrock 提供者與模型（不需要 `apiKey`）：

```json5
{
  models: {
    providers: {
      "amazon-bedrock": {
        baseUrl: "https://bedrock-runtime.us-east-1.amazonaws.com",
        api: "bedrock-converse-stream",
        auth: "aws-sdk",
        models: [
          {
            id: "us.anthropic.claude-opus-4-6-v1:0",
            name: "Claude Opus 4.6 (Bedrock)",
            reasoning: true,
            input: ["text", "image"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 200000,
            maxTokens: 8192,
          },
        ],
      },
    },
  },
  agents: {
    defaults: {
      model: { primary: "amazon-bedrock/us.anthropic.claude-opus-4-6-v1:0" },
    },
  },
}
```

## EC2 執行個體角色

當 OpenClaw 在已附加 IAM 角色的 EC2 執行個體上執行時，AWS SDK 會自動使用執行個體中繼資料服務（IMDS）進行驗證。然而，OpenClaw 目前的憑證偵測只檢查環境變數，並不檢查 IMDS 憑證。

**因應方式：** 設定 `AWS_PROFILE=default` 以表示 AWS 憑證可用。實際的驗證仍會透過 IMDS 使用執行個體角色。

```bash
# Add to ~/.bashrc or your shell profile
export AWS_PROFILE=default
export AWS_REGION=us-east-1
```

EC2 執行個體角色所需的 **IAM 權限**：

- `bedrock:InvokeModel`
- `bedrock:InvokeModelWithResponseStream`
- `bedrock:ListFoundationModels`（用於自動探索）

或附加受管政策 `AmazonBedrockFullAccess`。

**快速設定：**

```bash
# 1. Create IAM role and instance profile
aws iam create-role --role-name EC2-Bedrock-Access \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "ec2.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }'

aws iam attach-role-policy --role-name EC2-Bedrock-Access \
  --policy-arn arn:aws:iam::aws:policy/AmazonBedrockFullAccess

aws iam create-instance-profile --instance-profile-name EC2-Bedrock-Access
aws iam add-role-to-instance-profile \
  --instance-profile-name EC2-Bedrock-Access \
  --role-name EC2-Bedrock-Access

# 2. Attach to your EC2 instance
aws ec2 associate-iam-instance-profile \
  --instance-id i-xxxxx \
  --iam-instance-profile Name=EC2-Bedrock-Access

# 3. On the EC2 instance, enable discovery
openclaw config set models.bedrockDiscovery.enabled true
openclaw config set models.bedrockDiscovery.region us-east-1

# 4. Set the workaround env vars
echo 'export AWS_PROFILE=default' >> ~/.bashrc
echo 'export AWS_REGION=us-east-1' >> ~/.bashrc
source ~/.bashrc

# 5. Verify models are discovered
openclaw models list
```

## 備註

- Bedrock 需要在您的 AWS 帳戶／區域中啟用 **模型存取**。
- 自動探索需要 `bedrock:ListFoundationModels` 權限。
- 若您使用設定檔，請在 Gateway 閘道器 主機上設定 `AWS_PROFILE`。
- OpenClaw 會依下列順序呈現憑證來源：`AWS_BEARER_TOKEN_BEDROCK`，
  接著是 `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY`，然後是 `AWS_PROFILE`，最後是
  AWS SDK 的預設憑證鏈。
- 推理支援取決於模型；請查看 Bedrock 模型卡以了解目前能力。
- 若您偏好受管金鑰流程，也可以在 Bedrock 前方放置 OpenAI 相容的代理，並改以 OpenAI 提供者進行設定。
