---
summary: "Status de suporte do bot do Microsoft Teams, capacidades e configuracao"
read_when:
  - Trabalhando em recursos do canal MS Teams
title: "Microsoft Teams"
x-i18n:
  source_path: channels/msteams.md
  source_hash: 2046cb8fa3dd349f
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:17Z
---

# Microsoft Teams (plugin)

> "Abandonai toda a esperanca, vós que entrais aqui."

Atualizado: 2026-01-21

Status: texto + anexos em Mensagem direta são suportados; envio de arquivos em canais/grupos requer `sharePointSiteId` + permissoes do Graph (veja [Enviando arquivos em chats de grupo](#sending-files-in-group-chats)). Enquetes são enviadas via Adaptive Cards.

## Plugin necessario

O Microsoft Teams é distribuído como um plugin e não vem incluído na instalação principal.

**Mudanca incompatível (2026.1.15):** MS Teams foi removido do core. Se voce usa, precisa instalar o plugin.

Explicacao: mantém as instalações do core mais leves e permite que as dependências do MS Teams sejam atualizadas de forma independente.

Instale via CLI (registro npm):

```bash
openclaw plugins install @openclaw/msteams
```

Checkout local (quando executando a partir de um repo git):

```bash
openclaw plugins install ./extensions/msteams
```

Se voce escolher Teams durante a configuracao/integracao inicial e um checkout git for detectado,
o OpenClaw oferecerá automaticamente o caminho de instalação local.

Detalhes: [Plugins](/plugin)

## Inicio rapido (iniciante)

1. Instale o plugin do Microsoft Teams.
2. Crie um **Azure Bot** (App ID + client secret + tenant ID).
3. Configure o OpenClaw com essas credenciais.
4. Exponha `/api/messages` (porta 3978 por padrão) via uma URL pública ou túnel.
5. Instale o pacote do app do Teams e inicie o gateway.

Configuracao mínima:

```json5
{
  channels: {
    msteams: {
      enabled: true,
      appId: "<APP_ID>",
      appPassword: "<APP_PASSWORD>",
      tenantId: "<TENANT_ID>",
      webhook: { port: 3978, path: "/api/messages" },
    },
  },
}
```

Nota: chats de grupo são bloqueados por padrão (`channels.msteams.groupPolicy: "allowlist"`). Para permitir respostas em grupo, defina `channels.msteams.groupAllowFrom` (ou use `groupPolicy: "open"` para permitir qualquer membro, com gate por menção).

## Objetivos

- Falar com o OpenClaw via Mensagens diretas do Teams, chats de grupo ou canais.
- Manter o roteamento determinístico: respostas sempre retornam ao canal de onde chegaram.
- Usar comportamento seguro por padrão em canais (menções obrigatórias, a menos que configurado de outra forma).

## Escritas de configuracao

Por padrão, o Microsoft Teams pode escrever atualizações de configuracao acionadas por `/config set|unset` (requer `commands.config: true`).

Desative com:

```json5
{
  channels: { msteams: { configWrites: false } },
}
```

## Controle de acesso (DMs + grupos)

**Acesso por Mensagem direta**

- Padrão: `channels.msteams.dmPolicy = "pairing"`. Remetentes desconhecidos são ignorados até aprovação.
- `channels.msteams.allowFrom` aceita IDs de objeto AAD, UPNs ou nomes de exibicao. O assistente resolve nomes para IDs via Microsoft Graph quando as credenciais permitem.

**Acesso a grupos**

- Padrão: `channels.msteams.groupPolicy = "allowlist"` (bloqueado a menos que voce adicione `groupAllowFrom`). Use `channels.defaults.groupPolicy` para substituir o padrão quando não definido.
- `channels.msteams.groupAllowFrom` controla quais remetentes podem acionar em chats de grupo/canais (retorna para `channels.msteams.allowFrom`).
- Defina `groupPolicy: "open"` para permitir qualquer membro (ainda com gate por menção por padrão).
- Para permitir **nenhum canal**, defina `channels.msteams.groupPolicy: "disabled"`.

Exemplo:

```json5
{
  channels: {
    msteams: {
      groupPolicy: "allowlist",
      groupAllowFrom: ["user@org.com"],
    },
  },
}
```

**Teams + allowlist de canais**

- Limite respostas de grupo/canal listando equipes e canais em `channels.msteams.teams`.
- As chaves podem ser IDs ou nomes de equipes; chaves de canal podem ser IDs de conversa ou nomes.
- Quando `groupPolicy="allowlist"` e uma allowlist de equipes estiver presente, apenas as equipes/canais listados são aceitos (com gate por menção).
- O assistente de configuracao aceita entradas `Team/Channel` e as armazena para voce.
- Na inicializacao, o OpenClaw resolve nomes de equipes/canais e allowlists de usuários para IDs (quando as permissoes do Graph permitem)
  e registra o mapeamento; entradas não resolvidas são mantidas como digitadas.

Exemplo:

```json5
{
  channels: {
    msteams: {
      groupPolicy: "allowlist",
      teams: {
        "My Team": {
          channels: {
            General: { requireMention: true },
          },
        },
      },
    },
  },
}
```

## Como funciona

1. Instale o plugin do Microsoft Teams.
2. Crie um **Azure Bot** (App ID + secret + tenant ID).
3. Crie um **pacote de app do Teams** que referencie o bot e inclua as permissoes RSC abaixo.
4. Envie/instale o app do Teams em uma equipe (ou escopo pessoal para Mensagens diretas).
5. Configure `msteams` em `~/.openclaw/openclaw.json` (ou variaveis de ambiente) e inicie o gateway.
6. O gateway escuta tráfego de webhook do Bot Framework em `/api/messages` por padrão.

## Configuracao do Azure Bot (Pré-requisitos)

Antes de configurar o OpenClaw, voce precisa criar um recurso Azure Bot.

### Passo 1: Criar Azure Bot

1. Vá para [Create Azure Bot](https://portal.azure.com/#create/Microsoft.AzureBot)
2. Preencha a aba **Basics**:

   | Campo              | Valor                                                             |
   | ------------------ | ----------------------------------------------------------------- |
   | **Bot handle**     | Nome do seu bot, por exemplo, `openclaw-msteams` (deve ser único) |
   | **Subscription**   | Selecione sua assinatura Azure                                    |
   | **Resource group** | Criar novo ou usar existente                                      |
   | **Pricing tier**   | **Free** para dev/testes                                          |
   | **Type of App**    | **Single Tenant** (recomendado - veja nota abaixo)                |
   | **Creation type**  | **Create new Microsoft App ID**                                   |

> **Aviso de descontinuacao:** A criacao de novos bots multi-tenant foi descontinuada após 2025-07-31. Use **Single Tenant** para novos bots.

3. Clique em **Review + create** → **Create** (aguarde ~1-2 minutos)

### Passo 2: Obter credenciais

1. Vá para o recurso Azure Bot → **Configuration**
2. Copie **Microsoft App ID** → este é o seu `appId`
3. Clique em **Manage Password** → vá para o App Registration
4. Em **Certificates & secrets** → **New client secret** → copie o **Value** → este é o seu `appPassword`
5. Vá para **Overview** → copie **Directory (tenant) ID** → este é o seu `tenantId`

### Passo 3: Configurar Messaging Endpoint

1. No Azure Bot → **Configuration**
2. Defina **Messaging endpoint** para a sua URL de webhook:
   - Producao: `https://your-domain.com/api/messages`
   - Dev local: use um túnel (veja [Desenvolvimento local](#local-development-tunneling) abaixo)

### Passo 4: Ativar o canal Teams

1. No Azure Bot → **Channels**
2. Clique em **Microsoft Teams** → Configure → Save
3. Aceite os Termos de Serviço

## Desenvolvimento local (Tunelamento)

O Teams não consegue alcançar `localhost`. Use um túnel para desenvolvimento local:

**Opcao A: ngrok**

```bash
ngrok http 3978
# Copy the https URL, e.g., https://abc123.ngrok.io
# Set messaging endpoint to: https://abc123.ngrok.io/api/messages
```

**Opcao B: Tailscale Funnel**

```bash
tailscale funnel 3978
# Use your Tailscale funnel URL as the messaging endpoint
```

## Teams Developer Portal (Alternativa)

Em vez de criar manualmente um ZIP de manifesto, voce pode usar o [Teams Developer Portal](https://dev.teams.microsoft.com/apps):

1. Clique em **+ New app**
2. Preencha as informacoes básicas (nome, descricao, informacoes do desenvolvedor)
3. Vá para **App features** → **Bot**
4. Selecione **Enter a bot ID manually** e cole seu Azure Bot App ID
5. Marque os escopos: **Personal**, **Team**, **Group Chat**
6. Clique em **Distribute** → **Download app package**
7. No Teams: **Apps** → **Manage your apps** → **Upload a custom app** → selecione o ZIP

Isso costuma ser mais fácil do que editar manifestos JSON à mão.

## Testando o bot

**Opcao A: Azure Web Chat (verifique o webhook primeiro)**

1. No Azure Portal → seu recurso Azure Bot → **Test in Web Chat**
2. Envie uma mensagem - voce deve ver uma resposta
3. Isso confirma que seu endpoint de webhook funciona antes da configuracao do Teams

**Opcao B: Teams (após a instalacao do app)**

1. Instale o app do Teams (sideload ou catálogo da organizacao)
2. Encontre o bot no Teams e envie uma Mensagem direta
3. Verifique os logs do gateway para atividade de entrada

## Configuracao (mínima, somente texto)

1. **Instalar o plugin do Microsoft Teams**
   - Do npm: `openclaw plugins install @openclaw/msteams`
   - De um checkout local: `openclaw plugins install ./extensions/msteams`

2. **Registro do bot**
   - Crie um Azure Bot (veja acima) e anote:
     - App ID
     - Client secret (senha do app)
     - Tenant ID (single-tenant)

3. **Manifesto do app do Teams**
   - Inclua uma entrada `bot` com `botId = <App ID>`.
   - Escopos: `personal`, `team`, `groupChat`.
   - `supportsFiles: true` (obrigatorio para manipulacao de arquivos no escopo pessoal).
   - Adicione permissoes RSC (abaixo).
   - Crie ícones: `outline.png` (32x32) e `color.png` (192x192).
   - Compacte os três arquivos juntos: `manifest.json`, `outline.png`, `color.png`.

4. **Configurar o OpenClaw**

   ```json
   {
     "msteams": {
       "enabled": true,
       "appId": "<APP_ID>",
       "appPassword": "<APP_PASSWORD>",
       "tenantId": "<TENANT_ID>",
       "webhook": { "port": 3978, "path": "/api/messages" }
     }
   }
   ```

   Voce também pode usar variaveis de ambiente em vez de chaves de configuracao:
   - `MSTEAMS_APP_ID`
   - `MSTEAMS_APP_PASSWORD`
   - `MSTEAMS_TENANT_ID`

5. **Endpoint do bot**
   - Defina o Messaging Endpoint do Azure Bot para:
     - `https://<host>:3978/api/messages` (ou o caminho/porta escolhidos).

6. **Executar o gateway**
   - O canal do Teams inicia automaticamente quando o plugin está instalado e a configuracao `msteams` existe com credenciais.

## Contexto de histórico

- `channels.msteams.historyLimit` controla quantas mensagens recentes de canal/grupo são incluídas no prompt.
- Retorna para `messages.groupChat.historyLimit`. Defina `0` para desativar (padrão 50).
- O histórico de Mensagens diretas pode ser limitado com `channels.msteams.dmHistoryLimit` (turnos do usuário). Substituicoes por usuário: `channels.msteams.dms["<user_id>"].historyLimit`.

## Permissoes RSC atuais do Teams (Manifesto)

Estas são as **permissoes resourceSpecific existentes** no manifesto do nosso app do Teams. Elas se aplicam apenas dentro da equipe/chat onde o app está instalado.

**Para canais (escopo de equipe):**

- `ChannelMessage.Read.Group` (Application) - receber todas as mensagens do canal sem @mention
- `ChannelMessage.Send.Group` (Application)
- `Member.Read.Group` (Application)
- `Owner.Read.Group` (Application)
- `ChannelSettings.Read.Group` (Application)
- `TeamMember.Read.Group` (Application)
- `TeamSettings.Read.Group` (Application)

**Para chats de grupo:**

- `ChatMessage.Read.Chat` (Application) - receber todas as mensagens de chat de grupo sem @mention

## Exemplo de manifesto do Teams (redigido)

Exemplo mínimo e válido com os campos obrigatórios. Substitua IDs e URLs.

```json
{
  "$schema": "https://developer.microsoft.com/en-us/json-schemas/teams/v1.23/MicrosoftTeams.schema.json",
  "manifestVersion": "1.23",
  "version": "1.0.0",
  "id": "00000000-0000-0000-0000-000000000000",
  "name": { "short": "OpenClaw" },
  "developer": {
    "name": "Your Org",
    "websiteUrl": "https://example.com",
    "privacyUrl": "https://example.com/privacy",
    "termsOfUseUrl": "https://example.com/terms"
  },
  "description": { "short": "OpenClaw in Teams", "full": "OpenClaw in Teams" },
  "icons": { "outline": "outline.png", "color": "color.png" },
  "accentColor": "#5B6DEF",
  "bots": [
    {
      "botId": "11111111-1111-1111-1111-111111111111",
      "scopes": ["personal", "team", "groupChat"],
      "isNotificationOnly": false,
      "supportsCalling": false,
      "supportsVideo": false,
      "supportsFiles": true
    }
  ],
  "webApplicationInfo": {
    "id": "11111111-1111-1111-1111-111111111111"
  },
  "authorization": {
    "permissions": {
      "resourceSpecific": [
        { "name": "ChannelMessage.Read.Group", "type": "Application" },
        { "name": "ChannelMessage.Send.Group", "type": "Application" },
        { "name": "Member.Read.Group", "type": "Application" },
        { "name": "Owner.Read.Group", "type": "Application" },
        { "name": "ChannelSettings.Read.Group", "type": "Application" },
        { "name": "TeamMember.Read.Group", "type": "Application" },
        { "name": "TeamSettings.Read.Group", "type": "Application" },
        { "name": "ChatMessage.Read.Chat", "type": "Application" }
      ]
    }
  }
}
```

### Observacoes do manifesto (campos obrigatorios)

- `bots[].botId` **deve** corresponder ao Azure Bot App ID.
- `webApplicationInfo.id` **deve** corresponder ao Azure Bot App ID.
- `bots[].scopes` deve incluir as superfícies que voce planeja usar (`personal`, `team`, `groupChat`).
- `bots[].supportsFiles: true` é obrigatório para manipulacao de arquivos no escopo pessoal.
- `authorization.permissions.resourceSpecific` deve incluir leitura/envio de canal se voce quiser tráfego de canal.

### Atualizando um app existente

Para atualizar um app do Teams já instalado (por exemplo, para adicionar permissoes RSC):

1. Atualize seu `manifest.json` com as novas configuracoes
2. **Incremente o campo `version`** (por exemplo, `1.0.0` → `1.1.0`)
3. **Recompacte** o manifesto com os ícones (`manifest.json`, `outline.png`, `color.png`)
4. Envie o novo zip:
   - **Opcao A (Teams Admin Center):** Teams Admin Center → Teams apps → Manage apps → encontre seu app → Upload new version
   - **Opcao B (Sideload):** No Teams → Apps → Manage your apps → Upload a custom app
5. **Para canais de equipe:** Reinstale o app em cada equipe para que as novas permissoes entrem em vigor
6. **Feche completamente e reabra o Teams** (não apenas feche a janela) para limpar o cache de metadados do app

## Capacidades: somente RSC vs Graph

### Com **apenas Teams RSC** (app instalado, sem permissoes da API Graph)

Funciona:

- Ler conteúdo de **texto** de mensagens de canal.
- Enviar conteúdo de **texto** para canais.
- Receber anexos de arquivos **pessoais (Mensagem direta)**.

Não funciona:

- **Imagens ou conteúdos de arquivos** de canal/grupo (o payload inclui apenas um stub HTML).
- Download de anexos armazenados no SharePoint/OneDrive.
- Leitura de histórico de mensagens (além do evento de webhook ao vivo).

### Com **Teams RSC + permissoes de Aplicacao do Microsoft Graph**

Adiciona:

- Download de conteúdos hospedados (imagens coladas em mensagens).
- Download de anexos armazenados no SharePoint/OneDrive.
- Leitura do histórico de mensagens de canal/chat via Graph.

### RSC vs API Graph

| Capacidade                  | Permissoes RSC               | API Graph                                   |
| --------------------------- | ---------------------------- | ------------------------------------------- |
| **Mensagens em tempo real** | Sim (via webhook)            | Não (apenas polling)                        |
| **Mensagens historicas**    | Não                          | Sim (pode consultar histórico)              |
| **Complexidade de setup**   | Apenas manifesto do app      | Requer consentimento admin + fluxo de token |
| **Funciona offline**        | Não (deve estar em execucao) | Sim (consulta a qualquer momento)           |

**Conclusao:** RSC é para escuta em tempo real; API Graph é para acesso histórico. Para recuperar mensagens perdidas enquanto offline, voce precisa da API Graph com `ChannelMessage.Read.All` (requer consentimento admin).

## Midia + histórico habilitados por Graph (obrigatorio para canais)

Se voce precisa de imagens/arquivos em **canais** ou quer buscar **histórico de mensagens**, deve habilitar permissoes do Microsoft Graph e conceder consentimento admin.

1. No Entra ID (Azure AD) **App Registration**, adicione permissoes de **Application** do Microsoft Graph:
   - `ChannelMessage.Read.All` (anexos de canal + histórico)
   - `Chat.Read.All` ou `ChatMessage.Read.All` (chats de grupo)
2. **Conceda consentimento admin** para o tenant.
3. Aumente a **versao do manifesto** do app do Teams, reenvie e **reinstale o app no Teams**.
4. **Feche completamente e reabra o Teams** para limpar o cache de metadados do app.

## Limitacoes conhecidas

### Timeouts de webhook

O Teams entrega mensagens via webhook HTTP. Se o processamento demorar muito (por exemplo, respostas lentas do LLM), voce pode ver:

- Timeouts do gateway
- O Teams reenviando a mensagem (causando duplicatas)
- Respostas descartadas

O OpenClaw lida com isso retornando rapidamente e enviando respostas de forma proativa, mas respostas muito lentas ainda podem causar problemas.

### Formatacao

O markdown do Teams é mais limitado do que Slack ou Discord:

- Formatacao básica funciona: **negrito**, _itálico_, `code`, links
- Markdown complexo (tabelas, listas aninhadas) pode não renderizar corretamente
- Adaptive Cards são suportados para enquetes e envios arbitrários de cards (veja abaixo)

## Configuracao

Principais configuracoes (veja `/gateway/configuration` para padrões compartilhados de canais):

- `channels.msteams.enabled`: habilitar/desabilitar o canal.
- `channels.msteams.appId`, `channels.msteams.appPassword`, `channels.msteams.tenantId`: credenciais do bot.
- `channels.msteams.webhook.port` (padrão `3978`)
- `channels.msteams.webhook.path` (padrão `/api/messages`)
- `channels.msteams.dmPolicy`: `pairing | allowlist | open | disabled` (padrão: pairing)
- `channels.msteams.allowFrom`: allowlist para Mensagens diretas (IDs de objeto AAD, UPNs ou nomes de exibicao). O assistente resolve nomes para IDs durante a configuracao quando o acesso ao Graph está disponível.
- `channels.msteams.textChunkLimit`: tamanho de fragmento de texto de saída.
- `channels.msteams.chunkMode`: `length` (padrão) ou `newline` para dividir em linhas em branco (limites de parágrafo) antes do fracionamento por comprimento.
- `channels.msteams.mediaAllowHosts`: allowlist de hosts de anexos de entrada (padrão domínios Microsoft/Teams).
- `channels.msteams.mediaAuthAllowHosts`: allowlist para anexar headers de Authorization em tentativas de midia (padrão hosts do Graph + Bot Framework).
- `channels.msteams.requireMention`: exigir @mention em canais/grupos (padrão true).
- `channels.msteams.replyStyle`: `thread | top-level` (veja [Estilo de resposta](#reply-style-threads-vs-posts)).
- `channels.msteams.teams.<teamId>.replyStyle`: substituicao por equipe.
- `channels.msteams.teams.<teamId>.requireMention`: substituicao por equipe.
- `channels.msteams.teams.<teamId>.tools`: substituicoes padrão por equipe de política de ferramentas (`allow`/`deny`/`alsoAllow`) usadas quando uma substituicao por canal estiver ausente.
- `channels.msteams.teams.<teamId>.toolsBySender`: substituicoes padrão por equipe e por remetente de política de ferramentas (curinga `"*"` suportado).
- `channels.msteams.teams.<teamId>.channels.<conversationId>.replyStyle`: substituicao por canal.
- `channels.msteams.teams.<teamId>.channels.<conversationId>.requireMention`: substituicao por canal.
- `channels.msteams.teams.<teamId>.channels.<conversationId>.tools`: substituicoes de política de ferramentas por canal (`allow`/`deny`/`alsoAllow`).
- `channels.msteams.teams.<teamId>.channels.<conversationId>.toolsBySender`: substituicoes por canal e por remetente de política de ferramentas (curinga `"*"` suportado).
- `channels.msteams.sharePointSiteId`: ID do site do SharePoint para uploads de arquivos em chats de grupo/canais (veja [Enviando arquivos em chats de grupo](#sending-files-in-group-chats)).

## Roteamento & Sessoes

- Chaves de sessao seguem o formato padrão de agente (veja [/concepts/session](/concepts/session)):
  - Mensagens diretas compartilham a sessao principal (`agent:<agentId>:<mainKey>`).
  - Mensagens de canal/grupo usam o id da conversa:
    - `agent:<agentId>:msteams:channel:<conversationId>`
    - `agent:<agentId>:msteams:group:<conversationId>`

## Estilo de resposta: Threads vs Posts

O Teams introduziu recentemente dois estilos de UI de canal sobre o mesmo modelo de dados subjacente:

| Estilo                     | Descricao                                                    | `replyStyle` recomendado |
| -------------------------- | ------------------------------------------------------------ | ------------------------ |
| **Posts** (clássico)       | Mensagens aparecem como cards com respostas em thread abaixo | `thread` (padrão)        |
| **Threads** (estilo Slack) | Mensagens fluem linearmente, mais como o Slack               | `top-level`              |

**O problema:** A API do Teams não expõe qual estilo de UI um canal usa. Se voce usar o `replyStyle` errado:

- `thread` em um canal estilo Threads → respostas aparecem aninhadas de forma estranha
- `top-level` em um canal estilo Posts → respostas aparecem como posts de nível superior separados, em vez de na thread

**Solucao:** Configure `replyStyle` por canal com base em como o canal está configurado:

```json
{
  "msteams": {
    "replyStyle": "thread",
    "teams": {
      "19:abc...@thread.tacv2": {
        "channels": {
          "19:xyz...@thread.tacv2": {
            "replyStyle": "top-level"
          }
        }
      }
    }
  }
}
```

## Anexos & Imagens

**Limitacoes atuais:**

- **Mensagens diretas:** Imagens e anexos de arquivos funcionam via APIs de arquivos de bot do Teams.
- **Canais/grupos:** Anexos ficam no armazenamento M365 (SharePoint/OneDrive). O payload do webhook inclui apenas um stub HTML, não os bytes reais do arquivo. **Permissoes da API Graph são obrigatorias** para baixar anexos de canal.

Sem permissoes do Graph, mensagens de canal com imagens serão recebidas apenas como texto (o conteúdo da imagem não fica acessível ao bot).
Por padrão, o OpenClaw só baixa midia de hostnames Microsoft/Teams. Substitua com `channels.msteams.mediaAllowHosts` (use `["*"]` para permitir qualquer host).
Headers de Authorization só são anexados para hosts em `channels.msteams.mediaAuthAllowHosts` (padrão hosts do Graph + Bot Framework). Mantenha essa lista restrita (evite sufixos multi-tenant).

## Enviando arquivos em chats de grupo

Bots podem enviar arquivos em Mensagens diretas usando o fluxo FileConsentCard (embutido). No entanto, **enviar arquivos em chats de grupo/canais** requer configuracao adicional:

| Contexto                        | Como os arquivos são enviados                   | Setup necessario                                |
| ------------------------------- | ----------------------------------------------- | ----------------------------------------------- |
| **Mensagens diretas**           | FileConsentCard → usuário aceita → bot envia    | Funciona imediatamente                          |
| **Chats de grupo/canais**       | Upload no SharePoint → link de compartilhamento | Requer `sharePointSiteId` + permissoes do Graph |
| **Imagens (qualquer contexto)** | Inline codificado em Base64                     | Funciona imediatamente                          |

### Por que chats de grupo precisam de SharePoint

Bots não têm um drive pessoal do OneDrive (o endpoint da API Graph `/me/drive` não funciona para identidades de aplicacao). Para enviar arquivos em chats de grupo/canais, o bot faz upload para um **site do SharePoint** e cria um link de compartilhamento.

### Setup

1. **Adicionar permissoes da API Graph** no Entra ID (Azure AD) → App Registration:
   - `Sites.ReadWrite.All` (Application) - upload de arquivos no SharePoint
   - `Chat.Read.All` (Application) - opcional, habilita links de compartilhamento por usuário

2. **Conceder consentimento admin** para o tenant.

3. **Obter o ID do site do SharePoint:**

   ```bash
   # Via Graph Explorer or curl with a valid token:
   curl -H "Authorization: Bearer $TOKEN" \
     "https://graph.microsoft.com/v1.0/sites/{hostname}:/{site-path}"

   # Example: for a site at "contoso.sharepoint.com/sites/BotFiles"
   curl -H "Authorization: Bearer $TOKEN" \
     "https://graph.microsoft.com/v1.0/sites/contoso.sharepoint.com:/sites/BotFiles"

   # Response includes: "id": "contoso.sharepoint.com,guid1,guid2"
   ```

4. **Configurar o OpenClaw:**
   ```json5
   {
     channels: {
       msteams: {
         // ... other config ...
         sharePointSiteId: "contoso.sharepoint.com,guid1,guid2",
       },
     },
   }
   ```

### Comportamento de compartilhamento

| Permissao                               | Comportamento de compartilhamento                                                    |
| --------------------------------------- | ------------------------------------------------------------------------------------ |
| `Sites.ReadWrite.All` apenas            | Link de compartilhamento em toda a organizacao (qualquer pessoa da org pode acessar) |
| `Sites.ReadWrite.All` + `Chat.Read.All` | Link de compartilhamento por usuário (apenas membros do chat podem acessar)          |

O compartilhamento por usuário é mais seguro, pois apenas os participantes do chat podem acessar o arquivo. Se a permissao `Chat.Read.All` estiver ausente, o bot recorre ao compartilhamento em toda a organizacao.

### Comportamento de fallback

| Cenario                                                  | Resultado                                                    |
| -------------------------------------------------------- | ------------------------------------------------------------ |
| Chat de grupo + arquivo + `sharePointSiteId` configurado | Upload no SharePoint, envio do link de compartilhamento      |
| Chat de grupo + arquivo + sem `sharePointSiteId`         | Tentar upload no OneDrive (pode falhar), enviar apenas texto |
| Chat pessoal + arquivo                                   | Fluxo FileConsentCard (funciona sem SharePoint)              |
| Qualquer contexto + imagem                               | Inline codificado em Base64 (funciona sem SharePoint)        |

### Local de armazenamento dos arquivos

Os arquivos enviados são armazenados em uma pasta `/OpenClawShared/` na biblioteca de documentos padrão do site do SharePoint configurado.

## Enquetes (Adaptive Cards)

O OpenClaw envia enquetes do Teams como Adaptive Cards (não há API nativa de enquetes do Teams).

- CLI: `openclaw message poll --channel msteams --target conversation:<id> ...`
- Votos são registrados pelo gateway em `~/.openclaw/msteams-polls.json`.
- O gateway deve permanecer online para registrar votos.
- As enquetes ainda não publicam automaticamente resumos de resultados (inspecione o arquivo de armazenamento se necessário).

## Adaptive Cards (arbitrarios)

Envie qualquer JSON de Adaptive Card para usuários ou conversas do Teams usando a ferramenta ou CLI `message`.

O parametro `card` aceita um objeto JSON de Adaptive Card. Quando `card` é fornecido, o texto da mensagem é opcional.

**Ferramenta do agente:**

```json
{
  "action": "send",
  "channel": "msteams",
  "target": "user:<id>",
  "card": {
    "type": "AdaptiveCard",
    "version": "1.5",
    "body": [{ "type": "TextBlock", "text": "Hello!" }]
  }
}
```

**CLI:**

```bash
openclaw message send --channel msteams \
  --target "conversation:19:abc...@thread.tacv2" \
  --card '{"type":"AdaptiveCard","version":"1.5","body":[{"type":"TextBlock","text":"Hello!"}]}'
```

Veja a [documentacao de Adaptive Cards](https://adaptivecards.io/) para esquema e exemplos de cards. Para detalhes de formato de destino, veja [Formatos de destino](#target-formats) abaixo.

## Formatos de destino

Alvos do MSTeams usam prefixos para distinguir entre usuários e conversas:

| Tipo de destino    | Formato                          | Exemplo                                             |
| ------------------ | -------------------------------- | --------------------------------------------------- |
| Usuário (por ID)   | `user:<aad-object-id>`           | `user:40a1a0ed-4ff2-4164-a219-55518990c197`         |
| Usuário (por nome) | `user:<display-name>`            | `user:John Smith` (requer API Graph)                |
| Grupo/canal        | `conversation:<conversation-id>` | `conversation:19:abc123...@thread.tacv2`            |
| Grupo/canal (raw)  | `<conversation-id>`              | `19:abc123...@thread.tacv2` (se contiver `@thread`) |

**Exemplos de CLI:**

```bash
# Send to a user by ID
openclaw message send --channel msteams --target "user:40a1a0ed-..." --message "Hello"

# Send to a user by display name (triggers Graph API lookup)
openclaw message send --channel msteams --target "user:John Smith" --message "Hello"

# Send to a group chat or channel
openclaw message send --channel msteams --target "conversation:19:abc...@thread.tacv2" --message "Hello"

# Send an Adaptive Card to a conversation
openclaw message send --channel msteams --target "conversation:19:abc...@thread.tacv2" \
  --card '{"type":"AdaptiveCard","version":"1.5","body":[{"type":"TextBlock","text":"Hello"}]}'
```

**Exemplos de ferramenta do agente:**

```json
{
  "action": "send",
  "channel": "msteams",
  "target": "user:John Smith",
  "message": "Hello!"
}
```

```json
{
  "action": "send",
  "channel": "msteams",
  "target": "conversation:19:abc...@thread.tacv2",
  "card": {
    "type": "AdaptiveCard",
    "version": "1.5",
    "body": [{ "type": "TextBlock", "text": "Hello" }]
  }
}
```

Nota: Sem o prefixo `user:`, nomes assumem resolucao padrão de grupo/equipe. Sempre use `user:` ao direcionar pessoas pelo nome de exibicao.

## Mensagens proativas

- Mensagens proativas só são possíveis **após** um usuário interagir, pois armazenamos referencias de conversa nesse ponto.
- Veja `/gateway/configuration` para `dmPolicy` e gating por allowlist.

## IDs de Equipe e Canal (Pegadinha comum)

O parametro de consulta `groupId` em URLs do Teams **NÃO** é o ID da equipe usado para configuracao. Extraia IDs do caminho da URL:

**URL da equipe:**

```
https://teams.microsoft.com/l/team/19%3ABk4j...%40thread.tacv2/conversations?groupId=...
                                    └────────────────────────────┘
                                    Team ID (URL-decode this)
```

**URL do canal:**

```
https://teams.microsoft.com/l/channel/19%3A15bc...%40thread.tacv2/ChannelName?groupId=...
                                      └─────────────────────────┘
                                      Channel ID (URL-decode this)
```

**Para configuracao:**

- ID da equipe = segmento do caminho após `/team/` (decodificado da URL, por exemplo, `19:Bk4j...@thread.tacv2`)
- ID do canal = segmento do caminho após `/channel/` (decodificado da URL)
- **Ignore** o parametro de consulta `groupId`

## Canais privados

Bots têm suporte limitado em canais privados:

| Recurso                           | Canais padrão | Canais privados             |
| --------------------------------- | ------------- | --------------------------- |
| Instalacao do bot                 | Sim           | Limitado                    |
| Mensagens em tempo real (webhook) | Sim           | Pode não funcionar          |
| Permissoes RSC                    | Sim           | Pode se comportar diferente |
| @mentions                         | Sim           | Se o bot estiver acessível  |
| Histórico via API Graph           | Sim           | Sim (com permissoes)        |

**Alternativas se canais privados não funcionarem:**

1. Use canais padrão para interacoes com o bot
2. Use Mensagens diretas - usuários sempre podem falar diretamente com o bot
3. Use a API Graph para acesso histórico (requer `ChannelMessage.Read.All`)

## Solucao de problemas

### Problemas comuns

- **Imagens não aparecem em canais:** Permissoes do Graph ou consentimento admin ausentes. Reinstale o app do Teams e feche/reabra completamente o Teams.
- **Sem respostas no canal:** menções são obrigatorias por padrão; defina `channels.msteams.requireMention=false` ou configure por equipe/canal.
- **Incompatibilidade de versao (Teams ainda mostra manifesto antigo):** remova e adicione novamente o app e feche completamente o Teams para atualizar.
- **401 Unauthorized do webhook:** Esperado ao testar manualmente sem JWT do Azure - significa que o endpoint é alcançável, mas a autenticacao falhou. Use o Azure Web Chat para testar corretamente.

### Erros de upload do manifesto

- **"Icon file cannot be empty":** O manifesto referencia ícones com 0 bytes. Crie ícones PNG válidos (32x32 para `outline.png`, 192x192 para `color.png`).
- **"webApplicationInfo.Id already in use":** O app ainda está instalado em outra equipe/chat. Encontre e desinstale primeiro, ou aguarde 5-10 minutos para propagacao.
- **"Something went wrong" no upload:** Faça upload via https://admin.teams.microsoft.com, abra as DevTools do navegador (F12) → aba Network, e verifique o corpo da resposta para o erro real.
- **Falha no sideload:** Tente "Upload an app to your org's app catalog" em vez de "Upload a custom app" - isso geralmente contorna restricoes de sideload.

### Permissoes RSC não funcionam

1. Verifique se `webApplicationInfo.id` corresponde exatamente ao App ID do seu bot
2. Reenvie o app e reinstale na equipe/chat
3. Verifique se o admin da sua org bloqueou permissoes RSC
4. Confirme que voce está usando o escopo correto: `ChannelMessage.Read.Group` para equipes, `ChatMessage.Read.Chat` para chats de grupo

## Referencias

- [Create Azure Bot](https://learn.microsoft.com/en-us/azure/bot-service/bot-service-quickstart-registration) - guia de configuracao do Azure Bot
- [Teams Developer Portal](https://dev.teams.microsoft.com/apps) - criar/gerenciar apps do Teams
- [Teams app manifest schema](https://learn.microsoft.com/en-us/microsoftteams/platform/resources/schema/manifest-schema)
- [Receive channel messages with RSC](https://learn.microsoft.com/en-us/microsoftteams/platform/bots/how-to/conversations/channel-messages-with-rsc)
- [RSC permissions reference](https://learn.microsoft.com/en-us/microsoftteams/platform/graph-api/rsc/resource-specific-consent)
- [Teams bot file handling](https://learn.microsoft.com/en-us/microsoftteams/platform/bots/how-to/bots-filesv4) (canal/grupo requer Graph)
- [Proactive messaging](https://learn.microsoft.com/en-us/microsoftteams/platform/bots/how-to/conversations/send-proactive-messages)
