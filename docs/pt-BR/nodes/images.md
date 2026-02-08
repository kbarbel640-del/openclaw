---
summary: "Regras de manipulacao de imagens e midia para envio, gateway e respostas do agente"
read_when:
  - "Ao modificar o pipeline de midia ou anexos"
title: "Suporte a Imagens e Midia"
x-i18n:
  source_path: nodes/images.md
  source_hash: 971aed398ea01078
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:46Z
---

# Suporte a Imagens & Midia — 2025-12-05

O canal WhatsApp opera via **Baileys Web**. Este documento registra as regras atuais de manipulacao de midia para envio, gateway e respostas do agente.

## Objetivos

- Enviar midia com legendas opcionais via `openclaw message send --media`.
- Permitir que respostas automaticas da caixa de entrada web incluam midia junto com texto.
- Manter limites por tipo sensatos e previsiveis.

## Superficie da CLI

- `openclaw message send --media <path-or-url> [--message <caption>]`
  - `--media` opcional; a legenda pode estar vazia para envios apenas de midia.
  - `--dry-run` imprime o payload resolvido; `--json` emite `{ channel, to, messageId, mediaUrl, caption }`.

## Comportamento do canal WhatsApp Web

- Entrada: caminho de arquivo local **ou** URL HTTP(S).
- Fluxo: carregar em um Buffer, detectar o tipo de midia e construir o payload correto:
  - **Imagens:** redimensionar e recomprimir para JPEG (lado maximo 2048px) visando `agents.defaults.mediaMaxMb` (padrao 5 MB), limitado a 6 MB.
  - **Audio/Voz/Video:** passagem direta ate 16 MB; audio e enviado como nota de voz (`ptt: true`).
  - **Documentos:** qualquer outro tipo, ate 100 MB, com nome de arquivo preservado quando disponivel.
- Reproducao estilo GIF do WhatsApp: enviar um MP4 com `gifPlayback: true` (CLI: `--gif-playback`) para que clientes moveis reproduzam em loop inline.
- A deteccao de MIME prioriza magic bytes, depois cabecalhos e, por fim, a extensao do arquivo.
- A legenda vem de `--message` ou `reply.text`; legenda vazia e permitida.
- Logs: modo nao verboso mostra `↩️`/`✅`; modo verboso inclui tamanho e caminho/URL de origem.

## Pipeline de Resposta Automatica

- `getReplyFromConfig` retorna `{ text?, mediaUrl?, mediaUrls? }`.
- Quando ha midia, o remetente web resolve caminhos locais ou URLs usando o mesmo pipeline que `openclaw message send`.
- Multiplas entradas de midia sao enviadas sequencialmente, se fornecidas.

## Midia de Entrada para Comandos (Pi)

- Quando mensagens web de entrada incluem midia, o OpenClaw faz o download para um arquivo temporario e expõe variaveis de template:
  - `{{MediaUrl}}` pseudo-URL para a midia de entrada.
  - `{{MediaPath}}` caminho temporario local gravado antes de executar o comando.
- Quando um sandbox Docker por sessao esta habilitado, a midia de entrada e copiada para o workspace do sandbox e `MediaPath`/`MediaUrl` sao reescritos para um caminho relativo como `media/inbound/<filename>`.
- A compreensao de midia (se configurada via `tools.media.*` ou compartilhada `tools.media.models`) roda antes do templating e pode inserir blocos `[Image]`, `[Audio]` e `[Video]` em `Body`.
  - Audio define `{{Transcript}}` e usa a transcricao para o parsing de comandos, para que comandos com barra continuem funcionando.
  - Descricoes de video e imagem preservam qualquer texto de legenda para o parsing de comandos.
- Por padrao, apenas o primeiro anexo de imagem/audio/video correspondente e processado; defina `tools.media.<cap>.attachments` para processar multiplos anexos.

## Limites & Erros

**Limites de envio de saida (envio web do WhatsApp)**

- Imagens: limite de ~6 MB apos a recompressao.
- Audio/voz/video: limite de 16 MB; documentos: limite de 100 MB.
- Midia grande demais ou ilegivel → erro claro nos logs e a resposta e ignorada.

**Limites de compreensao de midia (transcricao/descricao)**

- Imagem padrao: 10 MB (`tools.media.image.maxBytes`).
- Audio padrao: 20 MB (`tools.media.audio.maxBytes`).
- Video padrao: 50 MB (`tools.media.video.maxBytes`).
- Midia grande demais ignora a compreensao, mas as respostas ainda seguem com o corpo original.

## Notas para Testes

- Cobrir fluxos de envio + resposta para casos de imagem/audio/documento.
- Validar recompressao para imagens (limite de tamanho) e flag de nota de voz para audio.
- Garantir que respostas com multiplas midias se expandam como envios sequenciais.
