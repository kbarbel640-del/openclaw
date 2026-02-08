---
summary: "Extensao do Chrome: deixe o OpenClaw controlar sua aba existente do Chrome"
read_when:
  - Voce quer que o agente controle uma aba existente do Chrome (botao da barra de ferramentas)
  - Voce precisa de Gateway remoto + automacao de navegador local via Tailscale
  - Voce quer entender as implicacoes de seguranca da tomada de controle do navegador
title: "Extensao do Chrome"
x-i18n:
  source_path: tools/chrome-extension.md
  source_hash: 3b77bdad7d3dab6a
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:42Z
---

# Extensao do Chrome (relay de navegador)

A extensao do Chrome do OpenClaw permite que o agente controle suas **abas existentes do Chrome** (sua janela normal do Chrome) em vez de iniciar um perfil do Chrome separado gerenciado pelo OpenClaw.

O anexar/desanexar acontece por meio de **um unico botao da barra de ferramentas do Chrome**.

## O que e (conceito)

Existem tres partes:

- **Servico de controle do navegador** (Gateway ou node): a API que o agente/ferramenta chama (via o Gateway)
- **Servidor de relay local** (CDP em loopback): faz a ponte entre o servidor de controle e a extensao (`http://127.0.0.1:18792` por padrao)
- **Extensao Chrome MV3**: anexa a aba ativa usando `chrome.debugger` e encaminha mensagens CDP para o relay

O OpenClaw entao controla a aba anexada por meio da superficie normal da ferramenta `browser` (selecionando o perfil correto).

## Instalar / carregar (descompactado)

1. Instale a extensao em um caminho local estavel:

```bash
openclaw browser extension install
```

2. Imprima o caminho do diretorio da extensao instalada:

```bash
openclaw browser extension path
```

3. Chrome → `chrome://extensions`

- Ative “Modo do desenvolvedor”
- “Carregar sem compactacao” → selecione o diretorio impresso acima

4. Fixe a extensao.

## Atualizacoes (sem etapa de build)

A extensao e enviada dentro da release do OpenClaw (pacote npm) como arquivos estaticos. Nao ha uma etapa de “build” separada.

Depois de atualizar o OpenClaw:

- Execute novamente `openclaw browser extension install` para atualizar os arquivos instalados no seu diretorio de estado do OpenClaw.
- Chrome → `chrome://extensions` → clique em “Recarregar” na extensao.

## Use (sem configuracao extra)

O OpenClaw vem com um perfil de navegador integrado chamado `chrome` que aponta para o relay da extensao na porta padrao.

Use assim:

- CLI: `openclaw browser --browser-profile chrome tabs`
- Ferramenta do agente: `browser` com `profile="chrome"`

Se voce quiser um nome diferente ou uma porta de relay diferente, crie seu proprio perfil:

```bash
openclaw browser create-profile \
  --name my-chrome \
  --driver extension \
  --cdp-url http://127.0.0.1:18792 \
  --color "#00AA00"
```

## Anexar / desanexar (botao da barra de ferramentas)

- Abra a aba que voce quer que o OpenClaw controle.
- Clique no icone da extensao.
  - O badge mostra `ON` quando anexado.
- Clique novamente para desanexar.

## Qual aba ele controla?

- Ele **nao** controla automaticamente “qualquer aba que voce esteja vendo”.
- Ele controla **apenas a(s) aba(s) que voce anexou explicitamente** clicando no botao da barra de ferramentas.
- Para alternar: abra a outra aba e clique no icone da extensao nela.

## Badge + erros comuns

- `ON`: anexado; o OpenClaw pode controlar essa aba.
- `…`: conectando ao relay local.
- `!`: relay nao acessivel (mais comum: o servidor de relay do navegador nao esta em execucao nesta maquina).

Se voce vir `!`:

- Certifique-se de que o Gateway esta em execucao localmente (configuracao padrao), ou execute um node host nesta maquina se o Gateway rodar em outro lugar.
- Abra a pagina de Opcoes da extensao; ela mostra se o relay esta acessivel.

## Gateway remoto (use um node host)

### Gateway local (mesma maquina do Chrome) — geralmente **sem etapas extras**

Se o Gateway roda na mesma maquina do Chrome, ele inicia o servico de controle do navegador em loopback
e inicia automaticamente o servidor de relay. A extensao conversa com o relay local; as chamadas da CLI/ferramenta vao para o Gateway.

### Gateway remoto (Gateway roda em outro lugar) — **execute um node host**

Se o seu Gateway roda em outra maquina, inicie um node host na maquina que executa o Chrome.
O Gateway ira fazer proxy das acoes do navegador para esse node; a extensao + relay permanecem locais na maquina do navegador.

Se varios nodes estiverem conectados, fixe um com `gateway.nodes.browser.node` ou defina `gateway.nodes.browser.mode`.

## Sandboxing (containers de ferramentas)

Se a sua sessao de agente estiver em sandbox (`agents.defaults.sandbox.mode != "off"`), a ferramenta `browser` pode ser restrita:

- Por padrao, sessoes em sandbox geralmente apontam para o **navegador do sandbox** (`target="sandbox"`), nao para o seu Chrome do host.
- A tomada de controle via relay da extensao do Chrome exige controlar o servidor de controle do navegador do **host**.

Opcoes:

- Mais facil: use a extensao a partir de uma sessao/agente **nao em sandbox**.
- Ou permita o controle do navegador do host para sessoes em sandbox:

```json5
{
  agents: {
    defaults: {
      sandbox: {
        browser: {
          allowHostControl: true,
        },
      },
    },
  },
}
```

Em seguida, garanta que a ferramenta nao seja negada pela politica de ferramentas e (se necessario) chame `browser` com `target="host"`.

Depuracao: `openclaw sandbox explain`

## Dicas de acesso remoto

- Mantenha o Gateway e o node host na mesma tailnet; evite expor portas de relay para a LAN ou Internet publica.
- Emparelhe nodes intencionalmente; desative o roteamento de proxy do navegador se voce nao quiser controle remoto (`gateway.nodes.browser.mode="off"`).

## Como funciona o “caminho da extensao”

`openclaw browser extension path` imprime o diretorio **instalado** no disco que contem os arquivos da extensao.

A CLI intencionalmente **nao** imprime um caminho `node_modules`. Sempre execute `openclaw browser extension install` primeiro para copiar a extensao para um local estavel dentro do seu diretorio de estado do OpenClaw.

Se voce mover ou excluir esse diretorio de instalacao, o Chrome marcara a extensao como quebrada ate que voce a recarregue a partir de um caminho valido.

## Implicacoes de seguranca (leia isto)

Isto e poderoso e arriscado. Trate como dar ao modelo “maos no seu navegador”.

- A extensao usa a API de depuracao do Chrome (`chrome.debugger`). Quando anexada, o modelo pode:
  - clicar/digitar/navegar nessa aba
  - ler o conteudo da pagina
  - acessar tudo o que a sessao autenticada da aba puder acessar
- **Isto nao e isolado** como o perfil dedicado gerenciado pelo OpenClaw.
  - Se voce anexar ao seu perfil/aba de uso diario, estara concedendo acesso a esse estado de conta.

Recomendacoes:

- Prefira um perfil do Chrome dedicado (separado da sua navegacao pessoal) para uso do relay da extensao.
- Mantenha o Gateway e quaisquer node hosts apenas na tailnet; confie na autenticacao do Gateway + emparelhamento de nodes.
- Evite expor portas de relay pela LAN (`0.0.0.0`) e evite o Funnel (publico).
- O relay bloqueia origens nao provenientes da extensao e exige um token de autenticacao interno para clientes CDP.

Relacionado:

- Visao geral da ferramenta de navegador: [Browser](/tools/browser)
- Auditoria de seguranca: [Security](/gateway/security)
- Configuracao do Tailscale: [Tailscale](/gateway/tailscale)
