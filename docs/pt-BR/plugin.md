---
summary: "Plugins/extensões do OpenClaw: descoberta, configuracao e seguranca"
read_when:
  - Ao adicionar ou modificar plugins/extensões
  - Ao documentar regras de instalacao ou carregamento de plugins
title: "Plugins"
x-i18n:
  source_path: plugin.md
  source_hash: b36ca6b90ca03eaa
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:33Z
---

# Plugins (Extensões)

## Inicio rapido (novo em plugins?)

Um plugin é apenas um **pequeno modulo de codigo** que estende o OpenClaw com
recursos extras (comandos, ferramentas e RPC do Gateway).

Na maioria das vezes, você usará plugins quando quiser um recurso que ainda não
está embutido no OpenClaw principal (ou quando quiser manter recursos opcionais
fora da sua instalacao principal).

Caminho rapido:

1. Veja o que já está carregado:

```bash
openclaw plugins list
```

2. Instale um plugin oficial (exemplo: Voice Call):

```bash
openclaw plugins install @openclaw/voice-call
```

3. Reinicie o Gateway e, em seguida, configure em `plugins.entries.<id>.config`.

Veja [Voice Call](/plugins/voice-call) para um exemplo concreto de plugin.

## Plugins disponiveis (oficiais)

- Microsoft Teams é apenas via plugin desde 2026.1.15; instale `@openclaw/msteams` se você usa Teams.
- Memory (Core) — plugin de busca de memoria empacotado (ativado por padrao via `plugins.slots.memory`)
- Memory (LanceDB) — plugin de memoria de longo prazo empacotado (auto-recall/capture; defina `plugins.slots.memory = "memory-lancedb"`)
- [Voice Call](/plugins/voice-call) — `@openclaw/voice-call`
- [Zalo Personal](/plugins/zalouser) — `@openclaw/zalouser`
- [Matrix](/channels/matrix) — `@openclaw/matrix`
- [Nostr](/channels/nostr) — `@openclaw/nostr`
- [Zalo](/channels/zalo) — `@openclaw/zalo`
- [Microsoft Teams](/channels/msteams) — `@openclaw/msteams`
- Google Antigravity OAuth (autenticacao de provedor) — empacotado como `google-antigravity-auth` (desativado por padrao)
- Gemini CLI OAuth (autenticacao de provedor) — empacotado como `google-gemini-cli-auth` (desativado por padrao)
- Qwen OAuth (autenticacao de provedor) — empacotado como `qwen-portal-auth` (desativado por padrao)
- Copilot Proxy (autenticacao de provedor) — ponte local do VS Code Copilot Proxy; distinto do login de dispositivo embutido `github-copilot` (empacotado, desativado por padrao)

Os plugins do OpenClaw são **modulos TypeScript** carregados em tempo de execucao via jiti. **A validacao de configuracao nao executa codigo do plugin**; ela usa o manifesto do plugin e o JSON Schema. Veja [Plugin manifest](/plugins/manifest).

Plugins podem registrar:

- Metodos RPC do Gateway
- Handlers HTTP do Gateway
- Ferramentas de agente
- Comandos da CLI
- Servicos em segundo plano
- Validacao de configuracao opcional
- **Skills** (listando diretorios `skills` no manifesto do plugin)
- **Comandos de resposta automatica** (executam sem invocar o agente de IA)

Os plugins executam **no mesmo processo** do Gateway, portanto trate-os como codigo confiavel.
Guia de autoria de ferramentas: [Plugin agent tools](/plugins/agent-tools).

## Auxiliares de runtime

Plugins podem acessar auxiliares centrais selecionados via `api.runtime`. Para TTS de telefonia:

```ts
const result = await api.runtime.tts.textToSpeechTelephony({
  text: "Hello from OpenClaw",
  cfg: api.config,
});
```

Observacoes:

- Usa a configuracao central `messages.tts` (OpenAI ou ElevenLabs).
- Retorna buffer de audio PCM + taxa de amostragem. Os plugins devem reamostrar/codificar para os provedores.
- Edge TTS nao é suportado para telefonia.

## Descoberta e precedencia

O OpenClaw varre, em ordem:

1. Caminhos de configuracao

- `plugins.load.paths` (arquivo ou diretorio)

2. Extensoes do workspace

- `<workspace>/.openclaw/extensions/*.ts`
- `<workspace>/.openclaw/extensions/*/index.ts`

3. Extensoes globais

- `~/.openclaw/extensions/*.ts`
- `~/.openclaw/extensions/*/index.ts`

4. Extensoes empacotadas (enviadas com o OpenClaw, **desativadas por padrao**)

- `<openclaw>/extensions/*`

Plugins empacotados devem ser ativados explicitamente via `plugins.entries.<id>.enabled`
ou `openclaw plugins enable <id>`. Plugins instalados sao ativados por padrao,
mas podem ser desativados da mesma forma.

Cada plugin deve incluir um arquivo `openclaw.plugin.json` na raiz. Se um caminho
aponta para um arquivo, a raiz do plugin é o diretorio do arquivo e deve conter o
manifesto.

Se varios plugins resolverem para o mesmo id, a primeira correspondencia na
ordem acima vence e as copias de menor precedencia sao ignoradas.

### Package packs

Um diretorio de plugin pode incluir um `package.json` com `openclaw.extensions`:

```json
{
  "name": "my-pack",
  "openclaw": {
    "extensions": ["./src/safety.ts", "./src/tools.ts"]
  }
}
```

Cada entrada se torna um plugin. Se o pack listar varias extensoes, o id do plugin
se torna `name/<fileBase>`.

Se o seu plugin importar dependencias npm, instale-as nesse diretorio para que
`node_modules` esteja disponivel (`npm install` / `pnpm install`).

### Metadados do catalogo de canais

Plugins de canal podem anunciar metadados de integracao inicial via `openclaw.channel` e
dicas de instalacao via `openclaw.install`. Isso mantem o catalogo central sem dados.

Exemplo:

```json
{
  "name": "@openclaw/nextcloud-talk",
  "openclaw": {
    "extensions": ["./index.ts"],
    "channel": {
      "id": "nextcloud-talk",
      "label": "Nextcloud Talk",
      "selectionLabel": "Nextcloud Talk (self-hosted)",
      "docsPath": "/channels/nextcloud-talk",
      "docsLabel": "nextcloud-talk",
      "blurb": "Self-hosted chat via Nextcloud Talk webhook bots.",
      "order": 65,
      "aliases": ["nc-talk", "nc"]
    },
    "install": {
      "npmSpec": "@openclaw/nextcloud-talk",
      "localPath": "extensions/nextcloud-talk",
      "defaultChoice": "npm"
    }
  }
}
```

O OpenClaw tambem pode mesclar **catalogos de canais externos** (por exemplo, uma
exportacao de registro MPM). Coloque um arquivo JSON em um dos seguintes locais:

- `~/.openclaw/mpm/plugins.json`
- `~/.openclaw/mpm/catalog.json`
- `~/.openclaw/plugins/catalog.json`

Ou aponte `OPENCLAW_PLUGIN_CATALOG_PATHS` (ou `OPENCLAW_MPM_CATALOG_PATHS`) para
um ou mais arquivos JSON (delimitados por virgula/ponto e virgula/`PATH`). Cada arquivo deve
conter `{ "entries": [ { "name": "@scope/pkg", "openclaw": { "channel": {...}, "install": {...} } } ] }`.

## IDs de plugin

IDs padrao de plugin:

- Package packs: `package.json` `name`
- Arquivo independente: nome base do arquivo (`~/.../voice-call.ts` → `voice-call`)

Se um plugin exportar `id`, o OpenClaw o usa, mas avisa quando nao corresponde ao
id configurado.

## Configuracao

```json5
{
  plugins: {
    enabled: true,
    allow: ["voice-call"],
    deny: ["untrusted-plugin"],
    load: { paths: ["~/Projects/oss/voice-call-extension"] },
    entries: {
      "voice-call": { enabled: true, config: { provider: "twilio" } },
    },
  },
}
```

Campos:

- `enabled`: chave mestre (padrao: true)
- `allow`: allowlist (opcional)
- `deny`: denylist (opcional; deny tem precedencia)
- `load.paths`: arquivos/diretorios extras de plugin
- `entries.<id>`: chaves por plugin + configuracao

Alteracoes de configuracao **exigem reinicio do gateway**.

Regras de validacao (estritas):

- IDs de plugin desconhecidos em `entries`, `allow`, `deny` ou `slots` sao **erros**.
- Chaves `channels.<id>` desconhecidas sao **erros**, a menos que um manifesto de plugin declare
  o id do canal.
- A configuracao do plugin é validada usando o JSON Schema embutido em
  `openclaw.plugin.json` (`configSchema`).
- Se um plugin estiver desativado, sua configuracao é preservada e um **aviso** é emitido.

## Slots de plugin (categorias exclusivas)

Algumas categorias de plugin sao **exclusivas** (apenas uma ativa por vez). Use
`plugins.slots` para selecionar qual plugin possui o slot:

```json5
{
  plugins: {
    slots: {
      memory: "memory-core", // or "none" to disable memory plugins
    },
  },
}
```

Se varios plugins declararem `kind: "memory"`, apenas o selecionado carrega. Os demais
sao desativados com diagnosticos.

## UI de Controle (schema + rotulos)

A UI de Controle usa `config.schema` (JSON Schema + `uiHints`) para renderizar formularios melhores.

O OpenClaw aumenta `uiHints` em tempo de execucao com base nos plugins descobertos:

- Adiciona rotulos por plugin para `plugins.entries.<id>` / `.enabled` / `.config`
- Mescla dicas opcionais de campos de configuracao fornecidas pelo plugin em:
  `plugins.entries.<id>.config.<field>`

Se você quiser que os campos de configuracao do seu plugin exibam bons rotulos/placeholders (e marquem segredos como sensiveis),
forneca `uiHints` junto com o seu JSON Schema no manifesto do plugin.

Exemplo:

```json
{
  "id": "my-plugin",
  "configSchema": {
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "apiKey": { "type": "string" },
      "region": { "type": "string" }
    }
  },
  "uiHints": {
    "apiKey": { "label": "API Key", "sensitive": true },
    "region": { "label": "Region", "placeholder": "us-east-1" }
  }
}
```

## CLI

```bash
openclaw plugins list
openclaw plugins info <id>
openclaw plugins install <path>                 # copy a local file/dir into ~/.openclaw/extensions/<id>
openclaw plugins install ./extensions/voice-call # relative path ok
openclaw plugins install ./plugin.tgz           # install from a local tarball
openclaw plugins install ./plugin.zip           # install from a local zip
openclaw plugins install -l ./extensions/voice-call # link (no copy) for dev
openclaw plugins install @openclaw/voice-call # install from npm
openclaw plugins update <id>
openclaw plugins update --all
openclaw plugins enable <id>
openclaw plugins disable <id>
openclaw plugins doctor
```

`plugins update` funciona apenas para instalacoes npm rastreadas em `plugins.installs`.

Plugins tambem podem registrar seus proprios comandos de nivel superior (exemplo: `openclaw voicecall`).

## API de Plugin (visao geral)

Plugins exportam um dos seguintes:

- Uma funcao: `(api) => { ... }`
- Um objeto: `{ id, name, configSchema, register(api) { ... } }`

## Hooks de plugin

Plugins podem enviar hooks e registra-los em tempo de execucao. Isso permite que um plugin
empacote automacao orientada a eventos sem uma instalacao separada de pacote de hooks.

### Exemplo

```
import { registerPluginHooksFromDir } from "openclaw/plugin-sdk";

export default function register(api) {
  registerPluginHooksFromDir(api, "./hooks");
}
```

Observacoes:

- Diretorios de hooks seguem a estrutura normal de hooks (`HOOK.md` + `handler.ts`).
- As regras de elegibilidade de hooks ainda se aplicam (requisitos de SO/binarios/variaveis de ambiente/configuracao).
- Hooks gerenciados por plugin aparecem em `openclaw hooks list` com `plugin:<id>`.
- Nao é possivel ativar/desativar hooks gerenciados por plugin via `openclaw hooks`; ative/desative o plugin em vez disso.

## Plugins de provedor (autenticacao de modelo)

Plugins podem registrar fluxos de **autenticacao de provedor de modelo** para que os usuarios executem OAuth ou
configuracao de chave de API dentro do OpenClaw (sem scripts externos).

Registre um provedor via `api.registerProvider(...)`. Cada provedor expõe um
ou mais metodos de autenticacao (OAuth, chave de API, codigo de dispositivo, etc.). Esses metodos alimentam:

- `openclaw models auth login --provider <id> [--method <id>]`

Exemplo:

```ts
api.registerProvider({
  id: "acme",
  label: "AcmeAI",
  auth: [
    {
      id: "oauth",
      label: "OAuth",
      kind: "oauth",
      run: async (ctx) => {
        // Run OAuth flow and return auth profiles.
        return {
          profiles: [
            {
              profileId: "acme:default",
              credential: {
                type: "oauth",
                provider: "acme",
                access: "...",
                refresh: "...",
                expires: Date.now() + 3600 * 1000,
              },
            },
          ],
          defaultModel: "acme/opus-1",
        };
      },
    },
  ],
});
```

Observacoes:

- `run` recebe um `ProviderAuthContext` com auxiliares `prompter`, `runtime`,
  `openUrl` e `oauth.createVpsAwareHandlers`.
- Retorne `configPatch` quando precisar adicionar modelos padrao ou configuracao do provedor.
- Retorne `defaultModel` para que `--set-default` possa atualizar os padroes do agente.

### Registrar um canal de mensagens

Plugins podem registrar **plugins de canal** que se comportam como canais embutidos
(WhatsApp, Telegram, etc.). A configuracao do canal fica em `channels.<id>` e é
validada pelo codigo do seu plugin de canal.

```ts
const myChannel = {
  id: "acmechat",
  meta: {
    id: "acmechat",
    label: "AcmeChat",
    selectionLabel: "AcmeChat (API)",
    docsPath: "/channels/acmechat",
    blurb: "demo channel plugin.",
    aliases: ["acme"],
  },
  capabilities: { chatTypes: ["direct"] },
  config: {
    listAccountIds: (cfg) => Object.keys(cfg.channels?.acmechat?.accounts ?? {}),
    resolveAccount: (cfg, accountId) =>
      cfg.channels?.acmechat?.accounts?.[accountId ?? "default"] ?? {
        accountId,
      },
  },
  outbound: {
    deliveryMode: "direct",
    sendText: async () => ({ ok: true }),
  },
};

export default function (api) {
  api.registerChannel({ plugin: myChannel });
}
```

Observacoes:

- Coloque a configuracao em `channels.<id>` (nao em `plugins.entries`).
- `meta.label` é usado para rotulos em listas da CLI/UI.
- `meta.aliases` adiciona ids alternativos para normalizacao e entradas da CLI.
- `meta.preferOver` lista ids de canal a pular a ativacao automatica quando ambos estao configurados.
- `meta.detailLabel` e `meta.systemImage` permitem que UIs exibam rotulos/ícones de canal mais ricos.

### Escrever um novo canal de mensagens (passo a passo)

Use isto quando você quiser uma **nova superficie de chat** (um “canal de mensagens”), nao um provedor de modelo.
A documentacao de provedores de modelo fica em `/providers/*`.

1. Escolha um id + formato de configuracao

- Toda a configuracao de canal fica em `channels.<id>`.
- Prefira `channels.<id>.accounts.<accountId>` para configuracoes multi-conta.

2. Defina os metadados do canal

- `meta.label`, `meta.selectionLabel`, `meta.docsPath`, `meta.blurb` controlam listas da CLI/UI.
- `meta.docsPath` deve apontar para uma pagina de docs como `/channels/<id>`.
- `meta.preferOver` permite que um plugin substitua outro canal (a ativacao automatica o prefere).
- `meta.detailLabel` e `meta.systemImage` sao usados pelas UIs para texto detalhado/ícones.

3. Implemente os adaptadores obrigatorios

- `config.listAccountIds` + `config.resolveAccount`
- `capabilities` (tipos de chat, midia, threads, etc.)
- `outbound.deliveryMode` + `outbound.sendText` (para envio basico)

4. Adicione adaptadores opcionais conforme necessario

- `setup` (assistente), `security` (politica de Mensagens diretas), `status` (saude/diagnosticos)
- `gateway` (start/stop/login), `mentions`, `threading`, `streaming`
- `actions` (acoes de mensagem), `commands` (comportamento de comando nativo)

5. Registre o canal no seu plugin

- `api.registerChannel({ plugin })`

Exemplo minimo de configuracao:

```json5
{
  channels: {
    acmechat: {
      accounts: {
        default: { token: "ACME_TOKEN", enabled: true },
      },
    },
  },
}
```

Plugin de canal minimo (somente saida):

```ts
const plugin = {
  id: "acmechat",
  meta: {
    id: "acmechat",
    label: "AcmeChat",
    selectionLabel: "AcmeChat (API)",
    docsPath: "/channels/acmechat",
    blurb: "AcmeChat messaging channel.",
    aliases: ["acme"],
  },
  capabilities: { chatTypes: ["direct"] },
  config: {
    listAccountIds: (cfg) => Object.keys(cfg.channels?.acmechat?.accounts ?? {}),
    resolveAccount: (cfg, accountId) =>
      cfg.channels?.acmechat?.accounts?.[accountId ?? "default"] ?? {
        accountId,
      },
  },
  outbound: {
    deliveryMode: "direct",
    sendText: async ({ text }) => {
      // deliver `text` to your channel here
      return { ok: true };
    },
  },
};

export default function (api) {
  api.registerChannel({ plugin });
}
```

Carregue o plugin (diretorio de extensoes ou `plugins.load.paths`), reinicie o gateway
e, em seguida, configure `channels.<id>` na sua configuracao.

### Ferramentas de agente

Veja o guia dedicado: [Plugin agent tools](/plugins/agent-tools).

### Registrar um metodo RPC do gateway

```ts
export default function (api) {
  api.registerGatewayMethod("myplugin.status", ({ respond }) => {
    respond(true, { ok: true });
  });
}
```

### Registrar comandos da CLI

```ts
export default function (api) {
  api.registerCli(
    ({ program }) => {
      program.command("mycmd").action(() => {
        console.log("Hello");
      });
    },
    { commands: ["mycmd"] },
  );
}
```

### Registrar comandos de resposta automatica

Plugins podem registrar comandos de barra personalizados que executam **sem invocar o
agente de IA**. Isso é util para comandos de alternancia, verificacoes de status ou acoes rapidas
que nao precisam de processamento por LLM.

```ts
export default function (api) {
  api.registerCommand({
    name: "mystatus",
    description: "Show plugin status",
    handler: (ctx) => ({
      text: `Plugin is running! Channel: ${ctx.channel}`,
    }),
  });
}
```

Contexto do handler de comando:

- `senderId`: O ID do remetente (se disponivel)
- `channel`: O canal onde o comando foi enviado
- `isAuthorizedSender`: Se o remetente é um usuario autorizado
- `args`: Argumentos passados apos o comando (se `acceptsArgs: true`)
- `commandBody`: O texto completo do comando
- `config`: A configuracao atual do OpenClaw

Opcoes de comando:

- `name`: Nome do comando (sem o `/` inicial)
- `description`: Texto de ajuda mostrado nas listas de comandos
- `acceptsArgs`: Se o comando aceita argumentos (padrao: false). Se false e argumentos forem fornecidos, o comando nao correspondera e a mensagem passara para outros handlers
- `requireAuth`: Se exige remetente autorizado (padrao: true)
- `handler`: Funcao que retorna `{ text: string }` (pode ser async)

Exemplo com autorizacao e argumentos:

```ts
api.registerCommand({
  name: "setmode",
  description: "Set plugin mode",
  acceptsArgs: true,
  requireAuth: true,
  handler: async (ctx) => {
    const mode = ctx.args?.trim() || "default";
    await saveMode(mode);
    return { text: `Mode set to: ${mode}` };
  },
});
```

Observacoes:

- Comandos de plugin sao processados **antes** dos comandos embutidos e do agente de IA
- Comandos sao registrados globalmente e funcionam em todos os canais
- Nomes de comandos nao diferenciam maiusculas/minusculas (`/MyStatus` corresponde a `/mystatus`)
- Nomes de comandos devem comecar com uma letra e conter apenas letras, numeros, hifens e sublinhados
- Nomes de comandos reservados (como `help`, `status`, `reset`, etc.) nao podem ser sobrescritos por plugins
- Registro duplicado de comandos entre plugins falhara com erro de diagnostico

### Registrar servicos em segundo plano

```ts
export default function (api) {
  api.registerService({
    id: "my-service",
    start: () => api.logger.info("ready"),
    stop: () => api.logger.info("bye"),
  });
}
```

## Convencoes de nomenclatura

- Metodos do Gateway: `pluginId.action` (exemplo: `voicecall.status`)
- Ferramentas: `snake_case` (exemplo: `voice_call`)
- Comandos da CLI: kebab ou camel, mas evite conflito com comandos centrais

## Skills

Plugins podem enviar uma skill no repositorio (`skills/<name>/SKILL.md`).
Ative-a com `plugins.entries.<id>.enabled` (ou outros gates de configuracao) e garanta
que ela esteja presente nos locais de skills do workspace/gerenciados.

## Distribuicao (npm)

Empacotamento recomendado:

- Pacote principal: `openclaw` (este repositorio)
- Plugins: pacotes npm separados sob `@openclaw/*` (exemplo: `@openclaw/voice-call`)

Contrato de publicacao:

- O `package.json` do plugin deve incluir `openclaw.extensions` com um ou mais arquivos de entrada.
- Arquivos de entrada podem ser `.js` ou `.ts` (jiti carrega TS em tempo de execucao).
- `openclaw plugins install <npm-spec>` usa `npm pack`, extrai para `~/.openclaw/extensions/<id>/` e o ativa na configuracao.
- Estabilidade de chave de configuracao: pacotes com escopo sao normalizados para o id **sem escopo** em `plugins.entries.*`.

## Plugin de exemplo: Voice Call

Este repositorio inclui um plugin de chamada de voz (Twilio ou fallback de log):

- Codigo-fonte: `extensions/voice-call`
- Skill: `skills/voice-call`
- CLI: `openclaw voicecall start|status`
- Ferramenta: `voice_call`
- RPC: `voicecall.start`, `voicecall.status`
- Configuracao (twilio): `provider: "twilio"` + `twilio.accountSid/authToken/from` (opcional `statusCallbackUrl`, `twimlUrl`)
- Configuracao (dev): `provider: "log"` (sem rede)

Veja [Voice Call](/plugins/voice-call) e `extensions/voice-call/README.md` para configuracao e uso.

## Notas de seguranca

Plugins executam no mesmo processo do Gateway. Trate-os como codigo confiavel:

- Instale apenas plugins em que você confia.
- Prefira allowlists `plugins.allow`.
- Reinicie o Gateway apos alteracoes.

## Testando plugins

Plugins podem (e devem) enviar testes:

- Plugins no repositorio podem manter testes Vitest em `src/**` (exemplo: `src/plugins/voice-call.plugin.test.ts`).
- Plugins publicados separadamente devem executar seu proprio CI (lint/build/test) e validar que `openclaw.extensions` aponta para o entrypoint construido (`dist/index.js`).
