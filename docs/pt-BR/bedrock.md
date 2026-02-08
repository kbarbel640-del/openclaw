---
summary: "Use modelos do Amazon Bedrock (API Converse) com o OpenClaw"
read_when:
  - Voce quer usar modelos do Amazon Bedrock com o OpenClaw
  - Voce precisa configurar credenciais/regiao da AWS para chamadas de modelo
title: "Amazon Bedrock"
x-i18n:
  source_path: bedrock.md
  source_hash: d2e02a8c51586219
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:17Z
---

# Amazon Bedrock

O OpenClaw pode usar modelos do **Amazon Bedrock** por meio do provedor de
streaming **Bedrock Converse** do pi‑ai. A autenticacao do Bedrock usa a
**cadeia padrao de credenciais do AWS SDK**, nao uma chave de API.

## O que o pi‑ai suporta

- Provedor: `amazon-bedrock`
- API: `bedrock-converse-stream`
- Autenticacao: credenciais da AWS (variaveis de ambiente, configuracao compartilhada ou funcao da instancia)
- Regiao: `AWS_REGION` ou `AWS_DEFAULT_REGION` (padrao: `us-east-1`)

## Descoberta automatica de modelos

Se credenciais da AWS forem detectadas, o OpenClaw pode descobrir
automaticamente modelos do Bedrock que oferecem **streaming** e **saida de texto**.
A descoberta usa `bedrock:ListFoundationModels` e e armazenada em cache (padrao: 1 hora).

As opcoes de configuracao ficam em `models.bedrockDiscovery`:

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

Observacoes:

- `enabled` usa `true` como padrao quando credenciais da AWS estao presentes.
- `region` usa `AWS_REGION` ou `AWS_DEFAULT_REGION` como padrao, depois `us-east-1`.
- `providerFilter` corresponde aos nomes de provedores do Bedrock (por exemplo `anthropic`).
- `refreshInterval` esta em segundos; defina como `0` para desativar o cache.
- `defaultContextWindow` (padrao: `32000`) e `defaultMaxTokens` (padrao: `4096`)
  sao usados para modelos descobertos (substitua se voce souber os limites do seu modelo).

## Configuracao (manual)

1. Garanta que as credenciais da AWS estejam disponiveis no **host do Gateway**:

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

2. Adicione um provedor Bedrock e um modelo a sua configuracao (nenhum `apiKey` necessario):

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

## Funcoes de instancia do EC2

Ao executar o OpenClaw em uma instancia do EC2 com uma funcao do IAM anexada, o
AWS SDK usara automaticamente o servico de metadados da instancia (IMDS) para
autenticacao. No entanto, a deteccao de credenciais do OpenClaw atualmente so
verifica variaveis de ambiente, nao credenciais do IMDS.

**Contorno:** Defina `AWS_PROFILE=default` para sinalizar que credenciais da AWS estao
disponiveis. A autenticacao real ainda usa a funcao da instancia via IMDS.

```bash
# Add to ~/.bashrc or your shell profile
export AWS_PROFILE=default
export AWS_REGION=us-east-1
```

**Permissoes do IAM necessarias** para a funcao da instancia do EC2:

- `bedrock:InvokeModel`
- `bedrock:InvokeModelWithResponseStream`
- `bedrock:ListFoundationModels` (para descoberta automatica)

Ou anexe a politica gerenciada `AmazonBedrockFullAccess`.

**Configuracao rapida:**

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

## Observacoes

- O Bedrock exige **acesso ao modelo** habilitado na sua conta/regiao da AWS.
- A descoberta automatica requer a permissao `bedrock:ListFoundationModels`.
- Se voce usa perfis, defina `AWS_PROFILE` no host do Gateway.
- O OpenClaw expõe a origem da credencial nesta ordem: `AWS_BEARER_TOKEN_BEDROCK`,
  depois `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY`, depois `AWS_PROFILE`, e por fim a
  cadeia padrao do AWS SDK.
- O suporte a raciocinio depende do modelo; verifique o cartao do modelo do Bedrock
  para as capacidades atuais.
- Se voce preferir um fluxo de chaves gerenciado, voce tambem pode colocar um proxy
  compativel com OpenAI na frente do Bedrock e configura-lo como um provedor OpenAI.
