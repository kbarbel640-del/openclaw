---
summary: "Servico integrado de controle de navegador + comandos de acao"
read_when:
  - Adicionando automacao de navegador controlada por agente
  - Depurando por que o openclaw esta interferindo no seu proprio Chrome
  - Implementando configuracoes e ciclo de vida do navegador no app macOS
title: "Navegador (gerenciado pelo OpenClaw)"
x-i18n:
  source_path: tools/browser.md
  source_hash: a868d040183436a1
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:14Z
---

# Navegador (gerenciado pelo openclaw)

O OpenClaw pode executar um **perfil dedicado do Chrome/Brave/Edge/Chromium** que o agente controla.
Ele e isolado do seu navegador pessoal e e gerenciado por um pequeno servico local
de controle dentro do Gateway (apenas loopback).

Visao para iniciantes:

- Pense nisso como um **navegador separado, apenas para o agente**.
- O perfil `openclaw` **nao** toca no seu perfil de navegador pessoal.
- O agente pode **abrir abas, ler paginas, clicar e digitar** em uma faixa segura.
- O perfil padrao `chrome` usa o **navegador Chromium padrao do sistema** via o
  relay de extensao; troque para `openclaw` para o navegador gerenciado isolado.

## O que voce recebe

- Um perfil de navegador separado chamado **openclaw** (acento laranja por padrao).
- Controle deterministico de abas (listar/abrir/focar/fechar).
- Acoes do agente (clicar/digitar/arrastar/selecionar), snapshots, capturas de tela, PDFs.
- Suporte opcional a multiplos perfis (`openclaw`, `work`, `remote`, ...).

Este navegador **nao** e o seu navegador do dia a dia. Ele e uma superficie segura e isolada para
automacao e verificacao por agentes.

## Inicio rapido

```bash
openclaw browser --browser-profile openclaw status
openclaw browser --browser-profile openclaw start
openclaw browser --browser-profile openclaw open https://example.com
openclaw browser --browser-profile openclaw snapshot
```

Se voce receber “Browser disabled”, habilite-o na configuracao (veja abaixo) e reinicie o
Gateway.

## Perfis: `openclaw` vs `chrome`

- `openclaw`: navegador gerenciado e isolado (nao requer extensao).
- `chrome`: relay de extensao para o **navegador do sistema** (requer a extensao
  do OpenClaw anexada a uma aba).

Defina `browser.defaultProfile: "openclaw"` se voce quiser o modo gerenciado por padrao.

## Configuracao

As configuracoes do navegador ficam em `~/.openclaw/openclaw.json`.

```json5
{
  browser: {
    enabled: true, // default: true
    // cdpUrl: "http://127.0.0.1:18792", // legacy single-profile override
    remoteCdpTimeoutMs: 1500, // remote CDP HTTP timeout (ms)
    remoteCdpHandshakeTimeoutMs: 3000, // remote CDP WebSocket handshake timeout (ms)
    defaultProfile: "chrome",
    color: "#FF4500",
    headless: false,
    noSandbox: false,
    attachOnly: false,
    executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    profiles: {
      openclaw: { cdpPort: 18800, color: "#FF4500" },
      work: { cdpPort: 18801, color: "#0066CC" },
      remote: { cdpUrl: "http://10.0.0.42:9222", color: "#00AA00" },
    },
  },
}
```

Notas:

- O servico de controle do navegador se vincula ao loopback em uma porta derivada de `gateway.port`
  (padrao: `18791`, que e gateway + 2). O relay usa a proxima porta (`18792`).
- Se voce substituir a porta do Gateway (`gateway.port` ou `OPENCLAW_GATEWAY_PORT`),
  as portas derivadas do navegador mudam para permanecer na mesma “familia”.
- `cdpUrl` usa por padrao a porta do relay quando nao definida.
- `remoteCdpTimeoutMs` se aplica a verificacoes de acessibilidade CDP remotas (nao-loopback).
- `remoteCdpHandshakeTimeoutMs` se aplica a verificacoes de acessibilidade do WebSocket CDP remoto.
- `attachOnly: true` significa “nunca iniciar um navegador local; apenas anexar se ja estiver em execucao.”
- `color` + `color` por perfil tingem a UI do navegador para que voce veja qual perfil esta ativo.
- O perfil padrao e `chrome` (relay de extensao). Use `defaultProfile: "openclaw"` para o navegador gerenciado.
- Ordem de autodeteccao: navegador padrao do sistema se for baseado em Chromium; caso contrario Chrome → Brave → Edge → Chromium → Chrome Canary.
- Perfis locais `openclaw` atribuem automaticamente `cdpPort`/`cdpUrl` — defina-os apenas para CDP remoto.

## Usar Brave (ou outro navegador baseado em Chromium)

Se o **navegador padrao do sistema** for baseado em Chromium (Chrome/Brave/Edge/etc),
o OpenClaw o usa automaticamente. Defina `browser.executablePath` para substituir a
autodeteccao:

Exemplo de CLI:

```bash
openclaw config set browser.executablePath "/usr/bin/google-chrome"
```

```json5
// macOS
{
  browser: {
    executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
  }
}

// Windows
{
  browser: {
    executablePath: "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe"
  }
}

// Linux
{
  browser: {
    executablePath: "/usr/bin/brave-browser"
  }
}
```

## Controle local vs remoto

- **Controle local (padrao):** o Gateway inicia o servico de controle em loopback e pode iniciar um navegador local.
- **Controle remoto (node host):** execute um node host na maquina que tem o navegador; o Gateway faz proxy das acoes do navegador para ele.
- **CDP remoto:** defina `browser.profiles.<name>.cdpUrl` (ou `browser.cdpUrl`) para
  anexar a um navegador baseado em Chromium remoto. Nesse caso, o OpenClaw nao iniciara um navegador local.

URLs de CDP remoto podem incluir autenticacao:

- Tokens por query (por exemplo, `https://provider.example?token=<token>`)
- HTTP Basic auth (por exemplo, `https://user:pass@provider.example`)

O OpenClaw preserva a autenticacao ao chamar endpoints `/json/*` e ao conectar
ao WebSocket do CDP. Prefira variaveis de ambiente ou gerenciadores de segredos para
tokens em vez de comita-los em arquivos de configuracao.

## Proxy de navegador no node (padrao zero-config)

Se voce executar um **node host** na maquina que tem o navegador, o OpenClaw pode
auto-rotear chamadas de ferramentas do navegador para esse node sem nenhuma configuracao extra de navegador.
Este e o caminho padrao para gateways remotos.

Notas:

- O node host expõe seu servidor local de controle de navegador por meio de um **comando de proxy**.
- Os perfis vem da propria configuracao `browser.profiles` do node (igual ao local).
- Desative se voce nao quiser:
  - No node: `nodeHost.browserProxy.enabled=false`
  - No gateway: `gateway.nodes.browser.mode="off"`

## Browserless (CDP remoto hospedado)

[Browserless](https://browserless.io) e um servico Chromium hospedado que expõe
endpoints CDP via HTTPS. Voce pode apontar um perfil de navegador do OpenClaw para um
endpoint regional do Browserless e autenticar com sua chave de API.

Exemplo:

```json5
{
  browser: {
    enabled: true,
    defaultProfile: "browserless",
    remoteCdpTimeoutMs: 2000,
    remoteCdpHandshakeTimeoutMs: 4000,
    profiles: {
      browserless: {
        cdpUrl: "https://production-sfo.browserless.io?token=<BROWSERLESS_API_KEY>",
        color: "#00AA00",
      },
    },
  },
}
```

Notas:

- Substitua `<BROWSERLESS_API_KEY>` pelo seu token real do Browserless.
- Escolha o endpoint regional que corresponda a sua conta do Browserless (veja a documentacao deles).

## Seguranca

Ideias principais:

- O controle do navegador e apenas em loopback; o acesso flui pela autenticacao do Gateway ou pareamento de node.
- Mantenha o Gateway e quaisquer node hosts em uma rede privada (Tailscale); evite exposicao publica.
- Trate URLs/tokens de CDP remoto como segredos; prefira variaveis de ambiente ou um gerenciador de segredos.

Dicas de CDP remoto:

- Prefira endpoints HTTPS e tokens de curta duracao quando possivel.
- Evite embutir tokens de longa duracao diretamente em arquivos de configuracao.

## Perfis (multi-navegador)

O OpenClaw suporta multiplos perfis nomeados (configuracoes de roteamento). Os perfis podem ser:

- **openclaw-managed**: uma instancia dedicada de navegador baseado em Chromium com seu proprio diretorio de dados do usuario + porta CDP
- **remote**: uma URL CDP explicita (navegador baseado em Chromium rodando em outro lugar)
- **extension relay**: suas abas existentes do Chrome via o relay local + extensao do Chrome

Padroes:

- O perfil `openclaw` e criado automaticamente se estiver ausente.
- O perfil `chrome` e embutido para o relay da extensao do Chrome (aponta para `http://127.0.0.1:18792` por padrao).
- Portas CDP locais alocam de **18800–18899** por padrao.
- Excluir um perfil move seu diretorio de dados local para a Lixeira.

Todos os endpoints de controle aceitam `?profile=<name>`; a CLI usa `--browser-profile`.

## Relay da extensao do Chrome (use seu Chrome existente)

O OpenClaw tambem pode dirigir **suas abas existentes do Chrome** (sem uma instancia separada do Chrome “openclaw”) via um relay CDP local + uma extensao do Chrome.

Guia completo: [Extensao do Chrome](/tools/chrome-extension)

Fluxo:

- O Gateway roda localmente (mesma maquina) ou um node host roda na maquina do navegador.
- Um **servidor de relay** local escuta em um `cdpUrl` de loopback (padrao: `http://127.0.0.1:18792`).
- Voce clica no icone da extensao **OpenClaw Browser Relay** em uma aba para anexar (ele nao se anexa automaticamente).
- O agente controla essa aba pela ferramenta normal `browser`, selecionando o perfil correto.

Se o Gateway rodar em outro lugar, execute um node host na maquina do navegador para que o Gateway possa fazer proxy das acoes do navegador.

### Sessoes em sandbox

Se a sessao do agente estiver em sandbox, a ferramenta `browser` pode usar por padrao `target="sandbox"` (navegador de sandbox).
A tomada de controle do relay da extensao do Chrome requer controle do navegador do host, entao:

- execute a sessao sem sandbox, ou
- defina `agents.defaults.sandbox.browser.allowHostControl: true` e use `target="host"` ao chamar a ferramenta.

### Configuracao

1. Carregue a extensao (dev/descompactada):

```bash
openclaw browser extension install
```

- Chrome → `chrome://extensions` → habilite “Developer mode”
- “Load unpacked” → selecione o diretorio impresso por `openclaw browser extension path`
- Fixe a extensao e, em seguida, clique nela na aba que voce deseja controlar (o badge mostra `ON`).

2. Use-a:

- CLI: `openclaw browser --browser-profile chrome tabs`
- Ferramenta do agente: `browser` com `profile="chrome"`

Opcional: se voce quiser um nome ou porta de relay diferentes, crie seu proprio perfil:

```bash
openclaw browser create-profile \
  --name my-chrome \
  --driver extension \
  --cdp-url http://127.0.0.1:18792 \
  --color "#00AA00"
```

Notas:

- Este modo depende do Playwright-on-CDP para a maioria das operacoes (capturas/snapshots/acoes).
- Desanexe clicando novamente no icone da extensao.

## Garantias de isolamento

- **Diretorio de dados do usuario dedicado**: nunca toca no seu perfil de navegador pessoal.
- **Portas dedicadas**: evita `9222` para prevenir colisoes com fluxos de desenvolvimento.
- **Controle deterministico de abas**: direciona abas por `targetId`, nao pela “ultima aba”.

## Selecao de navegador

Ao iniciar localmente, o OpenClaw escolhe o primeiro disponivel:

1. Chrome
2. Brave
3. Edge
4. Chromium
5. Chrome Canary

Voce pode substituir com `browser.executablePath`.

Plataformas:

- macOS: verifica `/Applications` e `~/Applications`.
- Linux: procura `google-chrome`, `brave`, `microsoft-edge`, `chromium`, etc.
- Windows: verifica locais comuns de instalacao.

## API de controle (opcional)

Apenas para integracoes locais, o Gateway expõe uma pequena API HTTP em loopback:

- Status/iniciar/parar: `GET /`, `POST /start`, `POST /stop`
- Abas: `GET /tabs`, `POST /tabs/open`, `POST /tabs/focus`, `DELETE /tabs/:targetId`
- Snapshot/captura de tela: `GET /snapshot`, `POST /screenshot`
- Acoes: `POST /navigate`, `POST /act`
- Hooks: `POST /hooks/file-chooser`, `POST /hooks/dialog`
- Downloads: `POST /download`, `POST /wait/download`
- Depuracao: `GET /console`, `POST /pdf`
- Depuracao: `GET /errors`, `GET /requests`, `POST /trace/start`, `POST /trace/stop`, `POST /highlight`
- Rede: `POST /response/body`
- Estado: `GET /cookies`, `POST /cookies/set`, `POST /cookies/clear`
- Estado: `GET /storage/:kind`, `POST /storage/:kind/set`, `POST /storage/:kind/clear`
- Configuracoes: `POST /set/offline`, `POST /set/headers`, `POST /set/credentials`, `POST /set/geolocation`, `POST /set/media`, `POST /set/timezone`, `POST /set/locale`, `POST /set/device`

Todos os endpoints aceitam `?profile=<name>`.

### Requisito do Playwright

Alguns recursos (navegar/agir/snapshot de IA/snapshot de papel, capturas de elementos, PDF) requerem
Playwright. Se o Playwright nao estiver instalado, esses endpoints retornam um erro
501 claro. Snapshots ARIA e capturas de tela basicas ainda funcionam para Chrome gerenciado pelo openclaw.
Para o driver de relay da extensao do Chrome, snapshots ARIA e capturas de tela requerem Playwright.

Se voce vir `Playwright is not available in this gateway build`, instale o pacote completo do
Playwright (nao `playwright-core`) e reinicie o gateway, ou reinstale
o OpenClaw com suporte a navegador.

#### Instalacao do Playwright no Docker

Se o seu Gateway roda em Docker, evite `npx playwright` (conflitos de override do npm).
Use a CLI empacotada:

```bash
docker compose run --rm openclaw-cli \
  node /app/node_modules/playwright-core/cli.js install chromium
```

Para persistir downloads do navegador, defina `PLAYWRIGHT_BROWSERS_PATH` (por exemplo,
`/home/node/.cache/ms-playwright`) e garanta que `/home/node` seja persistido via
`OPENCLAW_HOME_VOLUME` ou um bind mount. Veja [Docker](/install/docker).

## Como funciona (interno)

Fluxo de alto nivel:

- Um pequeno **servidor de controle** aceita requisicoes HTTP.
- Ele se conecta a navegadores baseados em Chromium (Chrome/Brave/Edge/Chromium) via **CDP**.
- Para acoes avancadas (clicar/digitar/snapshot/PDF), ele usa **Playwright** sobre
  CDP.
- Quando o Playwright nao esta presente, apenas operacoes sem Playwright ficam disponiveis.

Este design mantem o agente em uma interface estavel e deterministica enquanto permite
trocar navegadores e perfis locais/remotos.

## Referencia rapida da CLI

Todos os comandos aceitam `--browser-profile <name>` para direcionar um perfil especifico.
Todos os comandos tambem aceitam `--json` para saida legivel por maquina (payloads estaveis).

Basico:

- `openclaw browser status`
- `openclaw browser start`
- `openclaw browser stop`
- `openclaw browser tabs`
- `openclaw browser tab`
- `openclaw browser tab new`
- `openclaw browser tab select 2`
- `openclaw browser tab close 2`
- `openclaw browser open https://example.com`
- `openclaw browser focus abcd1234`
- `openclaw browser close abcd1234`

Inspecao:

- `openclaw browser screenshot`
- `openclaw browser screenshot --full-page`
- `openclaw browser screenshot --ref 12`
- `openclaw browser screenshot --ref e12`
- `openclaw browser snapshot`
- `openclaw browser snapshot --format aria --limit 200`
- `openclaw browser snapshot --interactive --compact --depth 6`
- `openclaw browser snapshot --efficient`
- `openclaw browser snapshot --labels`
- `openclaw browser snapshot --selector "#main" --interactive`
- `openclaw browser snapshot --frame "iframe#main" --interactive`
- `openclaw browser console --level error`
- `openclaw browser errors --clear`
- `openclaw browser requests --filter api --clear`
- `openclaw browser pdf`
- `openclaw browser responsebody "**/api" --max-chars 5000`

Acoes:

- `openclaw browser navigate https://example.com`
- `openclaw browser resize 1280 720`
- `openclaw browser click 12 --double`
- `openclaw browser click e12 --double`
- `openclaw browser type 23 "hello" --submit`
- `openclaw browser press Enter`
- `openclaw browser hover 44`
- `openclaw browser scrollintoview e12`
- `openclaw browser drag 10 11`
- `openclaw browser select 9 OptionA OptionB`
- `openclaw browser download e12 /tmp/report.pdf`
- `openclaw browser waitfordownload /tmp/report.pdf`
- `openclaw browser upload /tmp/file.pdf`
- `openclaw browser fill --fields '[{"ref":"1","type":"text","value":"Ada"}]'`
- `openclaw browser dialog --accept`
- `openclaw browser wait --text "Done"`
- `openclaw browser wait "#main" --url "**/dash" --load networkidle --fn "window.ready===true"`
- `openclaw browser evaluate --fn '(el) => el.textContent' --ref 7`
- `openclaw browser highlight e12`
- `openclaw browser trace start`
- `openclaw browser trace stop`

Estado:

- `openclaw browser cookies`
- `openclaw browser cookies set session abc123 --url "https://example.com"`
- `openclaw browser cookies clear`
- `openclaw browser storage local get`
- `openclaw browser storage local set theme dark`
- `openclaw browser storage session clear`
- `openclaw browser set offline on`
- `openclaw browser set headers --json '{"X-Debug":"1"}'`
- `openclaw browser set credentials user pass`
- `openclaw browser set credentials --clear`
- `openclaw browser set geo 37.7749 -122.4194 --origin "https://example.com"`
- `openclaw browser set geo --clear`
- `openclaw browser set media dark`
- `openclaw browser set timezone America/New_York`
- `openclaw browser set locale en-US`
- `openclaw browser set device "iPhone 14"`

Notas:

- `upload` e `dialog` sao chamadas de **armar**; execute-as antes do clique/pressionamento
  que aciona o seletor/dialogo.
- `upload` tambem pode definir inputs de arquivo diretamente via `--input-ref` ou `--element`.
- `snapshot`:
  - `--format ai` (padrao quando o Playwright esta instalado): retorna um snapshot de IA com referencias numericas (`aria-ref="<n>"`).
  - `--format aria`: retorna a arvore de acessibilidade (sem referencias; apenas inspecao).
  - `--efficient` (ou `--mode efficient`): preset de snapshot de papeis compacto (interativo + compacto + profundidade + menor maxChars).
  - Padrao de configuracao (apenas ferramenta/CLI): defina `browser.snapshotDefaults.mode: "efficient"` para usar snapshots eficientes quando o chamador nao passar um modo (veja [Configuracao do Gateway](/gateway/configuration#browser-openclaw-managed-browser)).
  - Opcoes de snapshot de papeis (`--interactive`, `--compact`, `--depth`, `--selector`) forcam um snapshot baseado em papeis com referencias como `ref=e12`.
  - `--frame "<iframe selector>"` limita snapshots de papeis a um iframe (em par com refs de papeis como `e12`).
  - `--interactive` gera uma lista plana e facil de selecionar de elementos interativos (melhor para dirigir acoes).
  - `--labels` adiciona uma captura de tela apenas da viewport com rotulos de referencia sobrepostos (imprime `MEDIA:<path>`).
- `click`/`type`/etc exigem um `ref` de `snapshot` (seja numerico `12` ou ref de papel `e12`).
  Seletores CSS nao sao suportados intencionalmente para acoes.

## Snapshots e refs

O OpenClaw suporta dois estilos de “snapshot”:

- **Snapshot de IA (refs numericas)**: `openclaw browser snapshot` (padrao; `--format ai`)
  - Saida: um snapshot de texto que inclui refs numericas.
  - Acoes: `openclaw browser click 12`, `openclaw browser type 23 "hello"`.
  - Internamente, a ref e resolvida via `aria-ref` do Playwright.

- **Snapshot de papeis (refs de papel como `e12`)**: `openclaw browser snapshot --interactive` (ou `--compact`, `--depth`, `--selector`, `--frame`)
  - Saida: uma lista/arvore baseada em papeis com `[ref=e12]` (e opcional `[nth=1]`).
  - Acoes: `openclaw browser click e12`, `openclaw browser highlight e12`.
  - Internamente, a ref e resolvida via `getByRole(...)` (mais `nth()` para duplicatas).
  - Adicione `--labels` para incluir uma captura de tela da viewport com rotulos `e12` sobrepostos.

Comportamento das refs:

- As refs **nao sao estaveis entre navegacoes**; se algo falhar, execute novamente `snapshot` e use uma ref nova.
- Se o snapshot de papeis foi tirado com `--frame`, as refs de papeis ficam limitadas a esse iframe ate o proximo snapshot de papeis.

## Power-ups de espera

Voce pode esperar por mais do que apenas tempo/texto:

- Esperar por URL (globs suportados pelo Playwright):
  - `openclaw browser wait --url "**/dash"`
- Esperar por estado de carregamento:
  - `openclaw browser wait --load networkidle`
- Esperar por um predicado JS:
  - `openclaw browser wait --fn "window.ready===true"`
- Esperar por um seletor ficar visivel:
  - `openclaw browser wait "#main"`

Eles podem ser combinados:

```bash
openclaw browser wait "#main" \
  --url "**/dash" \
  --load networkidle \
  --fn "window.ready===true" \
  --timeout-ms 15000
```

## Fluxos de depuracao

Quando uma acao falha (por exemplo, “not visible”, “strict mode violation”, “covered”):

1. `openclaw browser snapshot --interactive`
2. Use `click <ref>` / `type <ref>` (prefira refs de papeis no modo interativo)
3. Se ainda falhar: `openclaw browser highlight <ref>` para ver o que o Playwright esta direcionando
4. Se a pagina se comportar de forma estranha:
   - `openclaw browser errors --clear`
   - `openclaw browser requests --filter api --clear`
5. Para depuracao profunda: grave um trace:
   - `openclaw browser trace start`
   - reproduza o problema
   - `openclaw browser trace stop` (imprime `TRACE:<path>`)

## Saida JSON

`--json` e para scripts e ferramentas estruturadas.

Exemplos:

```bash
openclaw browser status --json
openclaw browser snapshot --interactive --json
openclaw browser requests --filter api --json
openclaw browser cookies --json
```

Snapshots de papeis em JSON incluem `refs` mais um pequeno bloco `stats` (linhas/chars/refs/interativo) para que ferramentas possam raciocinar sobre tamanho e densidade do payload.

## Controles de estado e ambiente

Sao uteis para fluxos “fazer o site se comportar como X”:

- Cookies: `cookies`, `cookies set`, `cookies clear`
- Storage: `storage local|session get|set|clear`
- Offline: `set offline on|off`
- Headers: `set headers --json '{"X-Debug":"1"}'` (ou `--clear`)
- HTTP basic auth: `set credentials user pass` (ou `--clear`)
- Geolocalizacao: `set geo <lat> <lon> --origin "https://example.com"` (ou `--clear`)
- Midia: `set media dark|light|no-preference|none`
- Fuso horario / localidade: `set timezone ...`, `set locale ...`
- Dispositivo / viewport:
  - `set device "iPhone 14"` (presets de dispositivo do Playwright)
  - `set viewport 1280 720`

## Seguranca e privacidade

- O perfil de navegador do openclaw pode conter sessoes logadas; trate-o como sensivel.
- `browser act kind=evaluate` / `openclaw browser evaluate` e `wait --fn`
  executam JavaScript arbitrario no contexto da pagina. A injecao de prompt pode direcionar
  isso. Desative com `browser.evaluateEnabled=false` se voce nao precisar disso.
- Para logins e notas anti-bot (X/Twitter, etc.), veja [Login de navegador + postagem no X/Twitter](/tools/browser-login).
- Mantenha o Gateway/node host privado (apenas loopback ou tailnet).
- Endpoints de CDP remoto sao poderosos; tunnele e proteja-os.

## Solucao de problemas

Para problemas especificos do Linux (especialmente Chromium via snap), veja
[Solução de problemas do navegador](/tools/browser-linux-troubleshooting).

## Ferramentas do agente + como o controle funciona

O agente recebe **uma ferramenta** para automacao de navegador:

- `browser` — status/iniciar/parar/abas/abrir/focar/fechar/snapshot/captura de tela/navegar/agir

Como isso se mapeia:

- `browser snapshot` retorna uma arvore de UI estavel (IA ou ARIA).
- `browser act` usa os IDs `ref` do snapshot para clicar/digitar/arrastar/selecionar.
- `browser screenshot` captura pixels (pagina inteira ou elemento).
- `browser` aceita:
  - `profile` para escolher um perfil de navegador nomeado (openclaw, chrome ou CDP remoto).
  - `target` (`sandbox` | `host` | `node`) para selecionar onde o navegador vive.
  - Em sessoes em sandbox, `target: "host"` requer `agents.defaults.sandbox.browser.allowHostControl=true`.
  - Se `target` for omitido: sessoes em sandbox usam por padrao `sandbox`, sessoes sem sandbox usam por padrao `host`.
  - Se um node com capacidade de navegador estiver conectado, a ferramenta pode auto-rotear para ele, a menos que voce fixe `target="host"` ou `target="node"`.

Isso mantem o agente deterministico e evita seletores frageis.
