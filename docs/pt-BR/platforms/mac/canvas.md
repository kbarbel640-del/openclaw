---
summary: "Painel Canvas controlado por agente incorporado via WKWebView + esquema de URL personalizado"
read_when:
  - Implementando o painel Canvas no macOS
  - Adicionando controles do agente para o workspace visual
  - Depurando carregamentos do Canvas no WKWebView
title: "Canvas"
x-i18n:
  source_path: platforms/mac/canvas.md
  source_hash: e39caa21542e839d
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:54Z
---

# Canvas (app macOS)

O app macOS incorpora um **painel Canvas** controlado por agente usando `WKWebView`. Ele
é um workspace visual leve para HTML/CSS/JS, A2UI e pequenas superfícies de UI
interativas.

## Onde o Canvas fica

O estado do Canvas é armazenado em Application Support:

- `~/Library/Application Support/OpenClaw/canvas/<session>/...`

O painel Canvas serve esses arquivos por meio de um **esquema de URL personalizado**:

- `openclaw-canvas://<session>/<path>`

Exemplos:

- `openclaw-canvas://main/` → `<canvasRoot>/main/index.html`
- `openclaw-canvas://main/assets/app.css` → `<canvasRoot>/main/assets/app.css`
- `openclaw-canvas://main/widgets/todo/` → `<canvasRoot>/main/widgets/todo/index.html`

Se não existir `index.html` na raiz, o app mostra uma **página de scaffold integrada**.

## Comportamento do painel

- Painel sem borda, redimensionável, ancorado perto da barra de menu (ou do cursor do mouse).
- Lembra tamanho/posição por sessao.
- Recarrega automaticamente quando os arquivos locais do Canvas mudam.
- Apenas um painel Canvas fica visível por vez (a sessao é trocada conforme necessário).

O Canvas pode ser desativado em Ajustes → **Allow Canvas**. Quando desativado, os comandos de nó do Canvas retornam `CANVAS_DISABLED`.

## Superficie de API do agente

O Canvas é exposto via o **Gateway WebSocket**, para que o agente possa:

- mostrar/ocultar o painel
- navegar para um caminho ou URL
- avaliar JavaScript
- capturar uma imagem de snapshot

Exemplos de CLI:

```bash
openclaw nodes canvas present --node <id>
openclaw nodes canvas navigate --node <id> --url "/"
openclaw nodes canvas eval --node <id> --js "document.title"
openclaw nodes canvas snapshot --node <id>
```

Notas:

- `canvas.navigate` aceita **caminhos locais do Canvas**, URLs `http(s)` e URLs `file://`.
- Se voce passar `"/"`, o Canvas mostra o scaffold local ou `index.html`.

## A2UI no Canvas

O A2UI é hospedado pelo host de Canvas do Gateway e renderizado dentro do painel Canvas.
Quando o Gateway anuncia um host de Canvas, o app macOS navega automaticamente para a
pagina do host A2UI na primeira abertura.

URL padrao do host A2UI:

```
http://<gateway-host>:18793/__openclaw__/a2ui/
```

### Comandos A2UI (v0.8)

Atualmente, o Canvas aceita mensagens servidor→cliente **A2UI v0.8**:

- `beginRendering`
- `surfaceUpdate`
- `dataModelUpdate`
- `deleteSurface`

`createSurface` (v0.9) nao e suportado.

Exemplo de CLI:

```bash
cat > /tmp/a2ui-v0.8.jsonl <<'EOFA2'
{"surfaceUpdate":{"surfaceId":"main","components":[{"id":"root","component":{"Column":{"children":{"explicitList":["title","content"]}}}},{"id":"title","component":{"Text":{"text":{"literalString":"Canvas (A2UI v0.8)"},"usageHint":"h1"}}},{"id":"content","component":{"Text":{"text":{"literalString":"If you can read this, A2UI push works."},"usageHint":"body"}}}]}}
{"beginRendering":{"surfaceId":"main","root":"root"}}
EOFA2

openclaw nodes canvas a2ui push --jsonl /tmp/a2ui-v0.8.jsonl --node <id>
```

Teste rapido:

```bash
openclaw nodes canvas a2ui push --node <id> --text "Hello from A2UI"
```

## Acionando execucoes do agente a partir do Canvas

O Canvas pode acionar novas execucoes do agente por meio de deep links:

- `openclaw://agent?...`

Exemplo (em JS):

```js
window.location.href = "openclaw://agent?message=Review%20this%20design";
```

O app solicita confirmacao, a menos que uma chave valida seja fornecida.

## Notas de seguranca

- O esquema do Canvas bloqueia traversal de diretorios; os arquivos devem viver sob a raiz da sessao.
- O conteudo local do Canvas usa um esquema personalizado (nenhum servidor de local loopback e necessario).
- URLs externas `http(s)` sao permitidas apenas quando navegadas explicitamente.
