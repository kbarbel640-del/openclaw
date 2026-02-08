---
summary: "Status de suporte do app Google Chat, capacidades e configuracao"
read_when:
  - Trabalhando em recursos do canal Google Chat
title: "Google Chat"
x-i18n:
  source_path: channels/googlechat.md
  source_hash: 3b2bb116cdd12614
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:30Z
---

# Google Chat (Chat API)

Status: pronto para Mensagens diretas + espacos via webhooks da Google Chat API (somente HTTP).

## Inicio Rapido (iniciante)

1. Crie um projeto no Google Cloud e ative a **Google Chat API**.
   - Va para: [Credenciais da Google Chat API](https://console.cloud.google.com/apis/api/chat.googleapis.com/credentials)
   - Ative a API se ainda nao estiver ativada.
2. Crie uma **Conta de Servico**:
   - Clique em **Create Credentials** > **Service Account**.
   - Dê o nome que quiser (ex.: `openclaw-chat`).
   - Deixe as permissoes em branco (clique em **Continue**).
   - Deixe os principais com acesso em branco (clique em **Done**).
3. Crie e baixe a **Chave JSON**:
   - Na lista de contas de servico, clique na que voce acabou de criar.
   - Va para a aba **Keys**.
   - Clique em **Add Key** > **Create new key**.
   - Selecione **JSON** e clique em **Create**.
4. Armazene o arquivo JSON baixado no host do seu Gateway (ex.: `~/.openclaw/googlechat-service-account.json`).
5. Crie um app do Google Chat na [Configuracao do Chat no Google Cloud Console](https://console.cloud.google.com/apis/api/chat.googleapis.com/hangouts-chat):
   - Preencha as **Informacoes do aplicativo**:
     - **App name**: (ex.: `OpenClaw`)
     - **Avatar URL**: (ex.: `https://openclaw.ai/logo.png`)
     - **Description**: (ex.: `Personal AI Assistant`)
   - Ative **Interactive features**.
   - Em **Functionality**, marque **Join spaces and group conversations**.
   - Em **Connection settings**, selecione **HTTP endpoint URL**.
   - Em **Triggers**, selecione **Use a common HTTP endpoint URL for all triggers** e defina como a URL publica do seu Gateway seguida de `/googlechat`.
     - _Dica: Execute `openclaw status` para descobrir a URL publica do seu Gateway._
   - Em **Visibility**, marque **Make this Chat app available to specific people and groups in &lt;Your Domain&gt;**.
   - Insira seu endereco de email (ex.: `user@example.com`) na caixa de texto.
   - Clique em **Save** na parte inferior.
6. **Ative o status do aplicativo**:
   - Depois de salvar, **atualize a pagina**.
   - Procure a secao **App status** (geralmente perto do topo ou do final apos salvar).
   - Altere o status para **Live - available to users**.
   - Clique em **Save** novamente.
7. Configure o OpenClaw com o caminho da conta de servico + audience do webhook:
   - Env: `GOOGLE_CHAT_SERVICE_ACCOUNT_FILE=/path/to/service-account.json`
   - Ou config: `channels.googlechat.serviceAccountFile: "/path/to/service-account.json"`.
8. Defina o tipo e o valor do audience do webhook (corresponde a configuracao do seu app do Chat).
9. Inicie o Gateway. O Google Chat fara POST para o caminho do seu webhook.

## Adicionar ao Google Chat

Quando o Gateway estiver em execucao e seu email estiver adicionado a lista de visibilidade:

1. Va para [Google Chat](https://chat.google.com/).
2. Clique no icone **+** (mais) ao lado de **Direct Messages**.
3. Na barra de busca (onde voce normalmente adiciona pessoas), digite o **App name** que voce configurou no Google Cloud Console.
   - **Nota**: O bot _nao_ aparecera na lista de navegacao do "Marketplace" porque e um app privado. Voce deve procura-lo pelo nome.
4. Selecione seu bot nos resultados.
5. Clique em **Add** ou **Chat** para iniciar uma conversa 1:1.
6. Envie "Hello" para acionar o assistente!

## URL publica (somente webhook)

Os webhooks do Google Chat exigem um endpoint HTTPS publico. Por seguranca, **exponha apenas o caminho `/googlechat`** para a internet. Mantenha o painel do OpenClaw e outros endpoints sensiveis na sua rede privada.

### Opcao A: Tailscale Funnel (Recomendado)

Use o Tailscale Serve para o painel privado e o Funnel para o caminho publico do webhook. Isso mantem `/` privado enquanto expoe apenas `/googlechat`.

1. **Verifique em qual endereco seu Gateway esta vinculado:**

   ```bash
   ss -tlnp | grep 18789
   ```

   Anote o endereco IP (ex.: `127.0.0.1`, `0.0.0.0` ou seu IP do Tailscale como `100.x.x.x`).

2. **Exponha o painel apenas para a tailnet (porta 8443):**

   ```bash
   # If bound to localhost (127.0.0.1 or 0.0.0.0):
   tailscale serve --bg --https 8443 http://127.0.0.1:18789

   # If bound to Tailscale IP only (e.g., 100.106.161.80):
   tailscale serve --bg --https 8443 http://100.106.161.80:18789
   ```

3. **Exponha publicamente apenas o caminho do webhook:**

   ```bash
   # If bound to localhost (127.0.0.1 or 0.0.0.0):
   tailscale funnel --bg --set-path /googlechat http://127.0.0.1:18789/googlechat

   # If bound to Tailscale IP only (e.g., 100.106.161.80):
   tailscale funnel --bg --set-path /googlechat http://100.106.161.80:18789/googlechat
   ```

4. **Autorize o no para acesso ao Funnel:**
   Se solicitado, visite a URL de autorizacao exibida na saida para habilitar o Funnel para este no na politica da sua tailnet.

5. **Verifique a configuracao:**
   ```bash
   tailscale serve status
   tailscale funnel status
   ```

Sua URL publica de webhook sera:
`https://<node-name>.<tailnet>.ts.net/googlechat`

Seu painel privado permanece apenas na tailnet:
`https://<node-name>.<tailnet>.ts.net:8443/`

Use a URL publica (sem `:8443`) na configuracao do app do Google Chat.

> Nota: Esta configuracao persiste entre reinicializacoes. Para remove-la posteriormente, execute `tailscale funnel reset` e `tailscale serve reset`.

### Opcao B: Proxy reverso (Caddy)

Se voce usar um proxy reverso como o Caddy, faça proxy apenas do caminho especifico:

```caddy
your-domain.com {
    reverse_proxy /googlechat* localhost:18789
}
```

Com essa configuracao, qualquer requisicao para `your-domain.com/` sera ignorada ou retornara 404, enquanto `your-domain.com/googlechat` e roteado com seguranca para o OpenClaw.

### Opcao C: Cloudflare Tunnel

Configure as regras de ingresso do seu tunnel para rotear apenas o caminho do webhook:

- **Path**: `/googlechat` -> `http://localhost:18789/googlechat`
- **Default Rule**: HTTP 404 (Not Found)

## Como funciona

1. O Google Chat envia POSTs de webhook para o Gateway. Cada requisicao inclui um header `Authorization: Bearer <token>`.
2. O OpenClaw verifica o token em relacao ao `audienceType` + `audience` configurados:
   - `audienceType: "app-url"` → o audience e a URL HTTPS do seu webhook.
   - `audienceType: "project-number"` → o audience e o numero do projeto no Cloud.
3. As mensagens sao roteadas por espaco:
   - Mensagens diretas usam a chave de sessao `agent:<agentId>:googlechat:dm:<spaceId>`.
   - Espacos usam a chave de sessao `agent:<agentId>:googlechat:group:<spaceId>`.
4. O acesso por Mensagem direta e pareamento por padrao. Remetentes desconhecidos recebem um codigo de pareamento; aprove com:
   - `openclaw pairing approve googlechat <code>`
5. Espacos em grupo exigem @-mention por padrao. Use `botUser` se a deteccao de mencao precisar do nome de usuario do app.

## Destinos

Use estes identificadores para entrega e allowlists:

- Mensagens diretas: `users/<userId>` ou `users/<email>` (enderecos de email sao aceitos).
- Espacos: `spaces/<spaceId>`.

## Destaques de configuracao

```json5
{
  channels: {
    googlechat: {
      enabled: true,
      serviceAccountFile: "/path/to/service-account.json",
      audienceType: "app-url",
      audience: "https://gateway.example.com/googlechat",
      webhookPath: "/googlechat",
      botUser: "users/1234567890", // optional; helps mention detection
      dm: {
        policy: "pairing",
        allowFrom: ["users/1234567890", "name@example.com"],
      },
      groupPolicy: "allowlist",
      groups: {
        "spaces/AAAA": {
          allow: true,
          requireMention: true,
          users: ["users/1234567890"],
          systemPrompt: "Short answers only.",
        },
      },
      actions: { reactions: true },
      typingIndicator: "message",
      mediaMaxMb: 20,
    },
  },
}
```

Notas:

- As credenciais da conta de servico tambem podem ser passadas inline com `serviceAccount` (string JSON).
- O caminho padrao do webhook e `/googlechat` se `webhookPath` nao estiver definido.
- Reacoes estao disponiveis por meio da ferramenta `reactions` e de `channels action` quando `actions.reactions` estiver habilitado.
- `typingIndicator` oferece suporte a `none`, `message` (padrao) e `reaction` (reacao requer OAuth do usuario).
- Anexos sao baixados pela Chat API e armazenados no pipeline de midia (tamanho limitado por `mediaMaxMb`).

## Solucao de problemas

### 405 Method Not Allowed

Se o Google Cloud Logs Explorer mostrar erros como:

```
status code: 405, reason phrase: HTTP error response: HTTP/1.1 405 Method Not Allowed
```

Isso significa que o handler do webhook nao esta registrado. Causas comuns:

1. **Canal nao configurado**: A secao `channels.googlechat` esta ausente da sua configuracao. Verifique com:

   ```bash
   openclaw config get channels.googlechat
   ```

   Se retornar "Config path not found", adicione a configuracao (veja [Destaques de configuracao](#config-highlights)).

2. **Plugin nao habilitado**: Verifique o status do plugin:

   ```bash
   openclaw plugins list | grep googlechat
   ```

   Se mostrar "disabled", adicione `plugins.entries.googlechat.enabled: true` a sua configuracao.

3. **Gateway nao reiniciado**: Apos adicionar a configuracao, reinicie o Gateway:
   ```bash
   openclaw gateway restart
   ```

Verifique se o canal esta em execucao:

```bash
openclaw channels status
# Should show: Google Chat default: enabled, configured, ...
```

### Outros problemas

- Verifique `openclaw channels status --probe` para erros de autenticacao ou audience ausente.
- Se nenhuma mensagem chegar, confirme a URL do webhook + as inscricoes de eventos do app do Chat.
- Se o bloqueio por mencao impedir respostas, defina `botUser` como o nome do recurso de usuario do app e verifique `requireMention`.
- Use `openclaw logs --follow` ao enviar uma mensagem de teste para ver se as requisicoes chegam ao Gateway.

Documentacao relacionada:

- [Configuracao do Gateway](/gateway/configuration)
- [Seguranca](/gateway/security)
- [Reacoes](/tools/reactions)
