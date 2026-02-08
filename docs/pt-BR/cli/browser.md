---
summary: "Referencia da CLI para `openclaw browser` (perfis, abas, acoes, relay da extensao)"
read_when:
  - Voce usa `openclaw browser` e quer exemplos para tarefas comuns
  - Voce quer controlar um navegador em execucao em outra maquina via um node host
  - Voce quer usar o relay da extensao do Chrome (anexar/desanexar pelo botao da barra de ferramentas)
title: "navegador"
x-i18n:
  source_path: cli/browser.md
  source_hash: af35adfd68726fd5
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:32Z
---

# `openclaw browser`

Gerencie o servidor de controle de navegador do OpenClaw e execute acoes do navegador (abas, snapshots, capturas de tela, navegacao, cliques, digitacao).

Relacionado:

- Ferramenta de navegador + API: [Browser tool](/tools/browser)
- Relay da extensao do Chrome: [Chrome extension](/tools/chrome-extension)

## Flags comuns

- `--url <gatewayWsUrl>`: URL do WebSocket do Gateway (padrao da configuracao).
- `--token <token>`: token do Gateway (se necessario).
- `--timeout <ms>`: tempo limite da requisicao (ms).
- `--browser-profile <name>`: escolher um perfil de navegador (padrao da configuracao).
- `--json`: saida legivel por maquina (onde suportado).

## Inicio rapido (local)

```bash
openclaw browser --browser-profile chrome tabs
openclaw browser --browser-profile openclaw start
openclaw browser --browser-profile openclaw open https://example.com
openclaw browser --browser-profile openclaw snapshot
```

## Perfis

Perfis sao configuracoes nomeadas de roteamento do navegador. Na pratica:

- `openclaw`: inicia/anexa a uma instancia dedicada do Chrome gerenciada pelo OpenClaw (diretorio de dados do usuario isolado).
- `chrome`: controla suas abas existentes do Chrome via o relay da extensao do Chrome.

```bash
openclaw browser profiles
openclaw browser create-profile --name work --color "#FF5A36"
openclaw browser delete-profile --name work
```

Use um perfil especifico:

```bash
openclaw browser --browser-profile work tabs
```

## Abas

```bash
openclaw browser tabs
openclaw browser open https://docs.openclaw.ai
openclaw browser focus <targetId>
openclaw browser close <targetId>
```

## Snapshot / captura de tela / acoes

Snapshot:

```bash
openclaw browser snapshot
```

Captura de tela:

```bash
openclaw browser screenshot
```

Navegar/clicar/digitar (automacao de UI baseada em ref):

```bash
openclaw browser navigate https://example.com
openclaw browser click <ref>
openclaw browser type <ref> "hello"
```

## Relay da extensao do Chrome (anexar via botao da barra de ferramentas)

Este modo permite que o agente controle uma aba existente do Chrome que voce anexa manualmente (nao ha anexo automatico).

Instale a extensao desempacotada em um caminho estavel:

```bash
openclaw browser extension install
openclaw browser extension path
```

Em seguida, Chrome → `chrome://extensions` → habilite “Developer mode” → “Load unpacked” → selecione a pasta exibida.

Guia completo: [Chrome extension](/tools/chrome-extension)

## Controle remoto do navegador (proxy de node host)

Se o Gateway roda em uma maquina diferente do navegador, execute um **node host** na maquina que tem Chrome/Brave/Edge/Chromium. O Gateway fara o proxy das acoes do navegador para esse node (nenhum servidor de controle de navegador separado e necessario).

Use `gateway.nodes.browser.mode` para controlar o roteamento automatico e `gateway.nodes.browser.node` para fixar um node especifico se varios estiverem conectados.

Seguranca + configuracao remota: [Browser tool](/tools/browser), [Remote access](/gateway/remote), [Tailscale](/gateway/tailscale), [Security](/gateway/security)
