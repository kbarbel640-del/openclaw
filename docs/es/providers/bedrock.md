---
summary: "Use modelos de Amazon Bedrock (API Converse) con OpenClaw"
read_when:
  - Quiere usar modelos de Amazon Bedrock con OpenClaw
  - Necesita la configuracion de credenciales y region de AWS para llamadas a modelos
title: "Amazon Bedrock"
x-i18n:
  source_path: providers/bedrock.md
  source_hash: d2e02a8c51586219
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:15:30Z
---

# Amazon Bedrock

OpenClaw puede usar modelos de **Amazon Bedrock** a traves del proveedor de
streaming **Bedrock Converse** de pi‑ai. La autenticacion de Bedrock utiliza la
**cadena de credenciales predeterminada del SDK de AWS**, no una clave de API.

## Lo que pi‑ai soporta

- Proveedor: `amazon-bedrock`
- API: `bedrock-converse-stream`
- Autenticacion: credenciales de AWS (variables de entorno, configuracion compartida o rol de instancia)
- Region: `AWS_REGION` o `AWS_DEFAULT_REGION` (predeterminado: `us-east-1`)

## Descubrimiento automatico de modelos

Si se detectan credenciales de AWS, OpenClaw puede descubrir automaticamente
modelos de Bedrock que soporten **streaming** y **salida de texto**. El
descubrimiento usa `bedrock:ListFoundationModels` y se almacena en cache (predeterminado: 1 hora).

Las opciones de configuracion viven bajo `models.bedrockDiscovery`:

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

Notas:

- `enabled` se establece de forma predeterminada en `true` cuando hay credenciales de AWS presentes.
- `region` se establece de forma predeterminada en `AWS_REGION` o `AWS_DEFAULT_REGION`, luego `us-east-1`.
- `providerFilter` coincide con los nombres de proveedor de Bedrock (por ejemplo `anthropic`).
- `refreshInterval` esta en segundos; establezca `0` para desactivar el cache.
- `defaultContextWindow` (predeterminado: `32000`) y `defaultMaxTokens` (predeterminado: `4096`)
  se usan para los modelos descubiertos (anule si conoce los limites de su modelo).

## Configuracion (manual)

1. Asegurese de que las credenciales de AWS esten disponibles en el **host del Gateway**:

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

2. Agregue un proveedor y un modelo de Bedrock a su configuracion (no se requiere `apiKey`):

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

## Roles de Instancia EC2

Cuando se ejecuta OpenClaw en una instancia EC2 con un rol de IAM adjunto, el SDK
de AWS utilizara automaticamente el servicio de metadatos de la instancia (IMDS)
para la autenticacion. Sin embargo, la deteccion de credenciales de OpenClaw
actualmente solo verifica variables de entorno, no credenciales de IMDS.

**Solucion alternativa:** Establezca `AWS_PROFILE=default` para indicar que las
credenciales de AWS estan disponibles. La autenticacion real sigue usando el rol
de la instancia via IMDS.

```bash
# Add to ~/.bashrc or your shell profile
export AWS_PROFILE=default
export AWS_REGION=us-east-1
```

**Permisos de IAM requeridos** para el rol de instancia EC2:

- `bedrock:InvokeModel`
- `bedrock:InvokeModelWithResponseStream`
- `bedrock:ListFoundationModels` (para descubrimiento automatico)

O adjunte la politica administrada `AmazonBedrockFullAccess`.

**Configuracion rapida:**

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

## Notas

- Bedrock requiere que el **acceso a modelos** este habilitado en su cuenta y region de AWS.
- El descubrimiento automatico necesita el permiso `bedrock:ListFoundationModels`.
- Si usa perfiles, establezca `AWS_PROFILE` en el host del Gateway.
- OpenClaw expone la fuente de credenciales en este orden: `AWS_BEARER_TOKEN_BEDROCK`,
  luego `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY`, luego `AWS_PROFILE`, y luego la
  cadena predeterminada del SDK de AWS.
- El soporte de razonamiento depende del modelo; revise la ficha del modelo de
  Bedrock para conocer las capacidades actuales.
- Si prefiere un flujo de claves administradas, tambien puede colocar un proxy
  compatible con OpenAI delante de Bedrock y configurarlo como un proveedor de OpenAI.
