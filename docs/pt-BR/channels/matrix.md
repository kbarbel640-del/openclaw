---
summary: "Status de suporte do Matrix, capacidades e configuracao"
read_when:
  - Trabalhando em recursos do canal Matrix
title: "Matrix"
x-i18n:
  source_path: channels/matrix.md
  source_hash: 923ff717cf14d01c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:34Z
---

# Matrix (plugin)

Matrix é um protocolo de mensagens aberto e descentralizado. O OpenClaw se conecta como um **usuário** Matrix
em qualquer homeserver, então você precisa de uma conta Matrix para o bot. Depois que estiver autenticado, você pode enviar
Mensagem direta para o bot ou convidá-lo para salas (os “grupos” do Matrix). O Beeper também é uma opção válida de cliente,
mas exige que o E2EE esteja habilitado.

Status: suportado via plugin (@vector-im/matrix-bot-sdk). Mensagens diretas, salas, threads, mídia, reações,
enquetes (envio + início de enquete como texto), localização e E2EE (com suporte a cripto).

## Plugin necessário

O Matrix é distribuído como um plugin e não vem incluído na instalação principal.

Instale via CLI (registro npm):

```bash
openclaw plugins install @openclaw/matrix
```

Checkout local (ao executar a partir de um repositório git):

```bash
openclaw plugins install ./extensions/matrix
```

Se você escolher Matrix durante a configuracao/integracao inicial e um checkout git for detectado,
o OpenClaw oferecerá automaticamente o caminho de instalação local.

Detalhes: [Plugins](/plugin)

## Configuracao

1. Instale o plugin Matrix:
   - Do npm: `openclaw plugins install @openclaw/matrix`
   - De um checkout local: `openclaw plugins install ./extensions/matrix`
2. Crie uma conta Matrix em um homeserver:
   - Veja opções de hospedagem em [https://matrix.org/ecosystem/hosting/](https://matrix.org/ecosystem/hosting/)
   - Ou hospede você mesmo.
3. Obtenha um token de acesso para a conta do bot:
   - Use a API de login do Matrix com `curl` no seu homeserver:

   ```bash
   curl --request POST \
     --url https://matrix.example.org/_matrix/client/v3/login \
     --header 'Content-Type: application/json' \
     --data '{
     "type": "m.login.password",
     "identifier": {
       "type": "m.id.user",
       "user": "your-user-name"
     },
     "password": "your-password"
   }'
   ```

   - Substitua `matrix.example.org` pela URL do seu homeserver.
   - Ou defina `channels.matrix.userId` + `channels.matrix.password`: o OpenClaw chama o mesmo
     endpoint de login, armazena o token de acesso em `~/.openclaw/credentials/matrix/credentials.json`,
     e o reutiliza na próxima inicializacao.

4. Configure as credenciais:
   - Env: `MATRIX_HOMESERVER`, `MATRIX_ACCESS_TOKEN` (ou `MATRIX_USER_ID` + `MATRIX_PASSWORD`)
   - Ou config: `channels.matrix.*`
   - Se ambos estiverem definidos, a config tem precedência.
   - Com token de acesso: o ID do usuário é obtido automaticamente via `/whoami`.
   - Quando definido, `channels.matrix.userId` deve ser o ID Matrix completo (exemplo: `@bot:example.org`).
5. Reinicie o Gateway (ou conclua a integracao inicial).
6. Inicie uma Mensagem direta com o bot ou convide-o para uma sala a partir de qualquer cliente Matrix
   (Element, Beeper, etc.; veja https://matrix.org/ecosystem/clients/). O Beeper exige E2EE,
   então defina `channels.matrix.encryption: true` e verifique o dispositivo.

Configuracao mínima (token de acesso, ID do usuário obtido automaticamente):

```json5
{
  channels: {
    matrix: {
      enabled: true,
      homeserver: "https://matrix.example.org",
      accessToken: "syt_***",
      dm: { policy: "pairing" },
    },
  },
}
```

Configuracao de E2EE (criptografia de ponta a ponta habilitada):

```json5
{
  channels: {
    matrix: {
      enabled: true,
      homeserver: "https://matrix.example.org",
      accessToken: "syt_***",
      encryption: true,
      dm: { policy: "pairing" },
    },
  },
}
```

## Criptografia (E2EE)

A criptografia de ponta a ponta é **suportada** via o SDK de cripto em Rust.

Habilite com `channels.matrix.encryption: true`:

- Se o módulo de cripto carregar, salas criptografadas são descriptografadas automaticamente.
- Mídia de saída é criptografada ao enviar para salas criptografadas.
- Na primeira conexao, o OpenClaw solicita verificacao de dispositivo às suas outras sessoes.
- Verifique o dispositivo em outro cliente Matrix (Element, etc.) para habilitar o compartilhamento de chaves.
- Se o módulo de cripto não puder ser carregado, o E2EE é desativado e salas criptografadas não serão descriptografadas;
  o OpenClaw registra um aviso.
- Se você vir erros de módulo de cripto ausente (por exemplo, `@matrix-org/matrix-sdk-crypto-nodejs-*`),
  permita scripts de build para `@matrix-org/matrix-sdk-crypto-nodejs` e execute
  `pnpm rebuild @matrix-org/matrix-sdk-crypto-nodejs` ou obtenha o binário com
  `node node_modules/@matrix-org/matrix-sdk-crypto-nodejs/download-lib.js`.

O estado de cripto é armazenado por conta + token de acesso em
`~/.openclaw/matrix/accounts/<account>/<homeserver>__<user>/<token-hash>/crypto/`
(banco de dados SQLite). O estado de sincronizacao fica ao lado em `bot-storage.json`.
Se o token de acesso (dispositivo) mudar, um novo armazenamento é criado e o bot precisa ser
reverificado para salas criptografadas.

**Verificacao de dispositivo:**
Quando o E2EE está habilitado, o bot solicitará verificacao das suas outras sessoes na inicializacao.
Abra o Element (ou outro cliente) e aprove a solicitacao de verificacao para estabelecer confiança.
Depois de verificado, o bot pode descriptografar mensagens em salas criptografadas.

## Modelo de roteamento

- As respostas sempre retornam para o Matrix.
- Mensagens diretas compartilham a sessao principal do agente; salas mapeiam para sessoes de grupo.

## Controle de acesso (Mensagens diretas)

- Padrão: `channels.matrix.dm.policy = "pairing"`. Remetentes desconhecidos recebem um código de pareamento.
- Aprovar via:
  - `openclaw pairing list matrix`
  - `openclaw pairing approve matrix <CODE>`
- Mensagens diretas públicas: `channels.matrix.dm.policy="open"` mais `channels.matrix.dm.allowFrom=["*"]`.
- `channels.matrix.dm.allowFrom` aceita IDs completos de usuário Matrix (exemplo: `@user:server`). O assistente resolve nomes de exibição para IDs quando a busca no diretório encontra uma única correspondência exata.

## Salas (grupos)

- Padrão: `channels.matrix.groupPolicy = "allowlist"` (bloqueado por menção). Use `channels.defaults.groupPolicy` para sobrescrever o padrão quando não definido.
- Permita salas via allowlist com `channels.matrix.groups` (IDs de sala ou aliases; nomes são resolvidos para IDs quando a busca no diretório encontra uma única correspondência exata):

```json5
{
  channels: {
    matrix: {
      groupPolicy: "allowlist",
      groups: {
        "!roomId:example.org": { allow: true },
        "#alias:example.org": { allow: true },
      },
      groupAllowFrom: ["@owner:example.org"],
    },
  },
}
```

- `requireMention: false` habilita resposta automática nessa sala.
- `groups."*"` pode definir padrões de bloqueio por menção entre salas.
- `groupAllowFrom` restringe quais remetentes podem acionar o bot em salas (IDs completos de usuário Matrix).
- Allowlists por sala em `users` podem restringir ainda mais os remetentes dentro de uma sala específica (use IDs completos de usuário Matrix).
- O assistente de configuracao solicita allowlists de salas (IDs de sala, aliases ou nomes) e resolve nomes apenas em correspondência exata e única.
- Na inicializacao, o OpenClaw resolve nomes de salas/usuários nas allowlists para IDs e registra o mapeamento; entradas não resolvidas são ignoradas na correspondência da allowlist.
- Convites são aceitos automaticamente por padrão; controle com `channels.matrix.autoJoin` e `channels.matrix.autoJoinAllowlist`.
- Para não permitir **nenhuma sala**, defina `channels.matrix.groupPolicy: "disabled"` (ou mantenha uma allowlist vazia).
- Chave legada: `channels.matrix.rooms` (mesma estrutura que `groups`).

## Threads

- Respostas em threads são suportadas.
- `channels.matrix.threadReplies` controla se as respostas permanecem em threads:
  - `off`, `inbound` (padrão), `always`
- `channels.matrix.replyToMode` controla os metadados de resposta quando não se responde em uma thread:
  - `off` (padrão), `first`, `all`

## Capacidades

| Recurso           | Status                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------ |
| Mensagens diretas | ✅ Suportado                                                                                           |
| Salas             | ✅ Suportado                                                                                           |
| Threads           | ✅ Suportado                                                                                           |
| Mídia             | ✅ Suportado                                                                                           |
| E2EE              | ✅ Suportado (módulo de cripto necessário)                                                             |
| Reações           | ✅ Suportado (enviar/ler via ferramentas)                                                              |
| Enquetes          | ✅ Envio suportado; inícios de enquete recebidos são convertidos em texto (respostas/finais ignorados) |
| Localização       | ✅ Suportado (URI geo; altitude ignorada)                                                              |
| Comandos nativos  | ✅ Suportado                                                                                           |

## Referência de configuracao (Matrix)

Configuracao completa: [Configuration](/gateway/configuration)

Opções do provedor:

- `channels.matrix.enabled`: habilitar/desabilitar a inicializacao do canal.
- `channels.matrix.homeserver`: URL do homeserver.
- `channels.matrix.userId`: ID do usuário Matrix (opcional com token de acesso).
- `channels.matrix.accessToken`: token de acesso.
- `channels.matrix.password`: senha para login (token armazenado).
- `channels.matrix.deviceName`: nome de exibição do dispositivo.
- `channels.matrix.encryption`: habilitar E2EE (padrão: false).
- `channels.matrix.initialSyncLimit`: limite inicial de sincronizacao.
- `channels.matrix.threadReplies`: `off | inbound | always` (padrão: inbound).
- `channels.matrix.textChunkLimit`: tamanho do bloco de texto de saída (chars).
- `channels.matrix.chunkMode`: `length` (padrão) ou `newline` para dividir por linhas em branco (limites de parágrafo) antes da divisão por comprimento.
- `channels.matrix.dm.policy`: `pairing | allowlist | open | disabled` (padrão: pareamento).
- `channels.matrix.dm.allowFrom`: allowlist de Mensagens diretas (IDs completos de usuário Matrix). `open` requer `"*"`. O assistente resolve nomes para IDs quando possível.
- `channels.matrix.groupPolicy`: `allowlist | open | disabled` (padrão: allowlist).
- `channels.matrix.groupAllowFrom`: remetentes permitidos para mensagens de grupo (IDs completos de usuário Matrix).
- `channels.matrix.allowlistOnly`: forçar regras de allowlist para Mensagens diretas + salas.
- `channels.matrix.groups`: allowlist de grupos + mapa de configuracoes por sala.
- `channels.matrix.rooms`: allowlist/configuracao de grupos legada.
- `channels.matrix.replyToMode`: modo de resposta para threads/tags.
- `channels.matrix.mediaMaxMb`: limite de mídia de entrada/saída (MB).
- `channels.matrix.autoJoin`: tratamento de convites (`always | allowlist | off`, padrão: sempre).
- `channels.matrix.autoJoinAllowlist`: IDs/aliases de salas permitidos para entrada automática.
- `channels.matrix.actions`: controle de ferramentas por ação (reacoes/mensagens/pins/memberInfo/channelInfo).
