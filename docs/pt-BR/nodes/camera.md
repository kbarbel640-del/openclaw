---
summary: "Captura de câmera (nó iOS + app macOS) para uso por agentes: fotos (jpg) e clipes curtos de vídeo (mp4)"
read_when:
  - Ao adicionar ou modificar a captura de câmera em nós iOS ou macOS
  - Ao estender fluxos de trabalho de arquivos temporários MEDIA acessíveis por agentes
title: "Captura de Câmera"
x-i18n:
  source_path: nodes/camera.md
  source_hash: b4d5f5ecbab6f705
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:49Z
---

# Captura de câmera (agente)

O OpenClaw oferece suporte à **captura de câmera** para fluxos de trabalho de agentes:

- **Nó iOS** (pareado via Gateway): capturar uma **foto** (`jpg`) ou **clipe curto de vídeo** (`mp4`, com áudio opcional) via `node.invoke`.
- **Nó Android** (pareado via Gateway): capturar uma **foto** (`jpg`) ou **clipe curto de vídeo** (`mp4`, com áudio opcional) via `node.invoke`.
- **App macOS** (nó via Gateway): capturar uma **foto** (`jpg`) ou **clipe curto de vídeo** (`mp4`, com áudio opcional) via `node.invoke`.

Todo acesso à câmera é controlado por **configurações definidas pelo usuário**.

## Nó iOS

### Configuração do usuário (padrão ativado)

- Aba Ajustes do iOS → **Câmera** → **Permitir Câmera** (`camera.enabled`)
  - Padrão: **ativado** (chave ausente é tratada como habilitada).
  - Quando desativado: comandos `camera.*` retornam `CAMERA_DISABLED`.

### Comandos (via Gateway `node.invoke`)

- `camera.list`
  - Payload de resposta:
    - `devices`: array de `{ id, name, position, deviceType }`

- `camera.snap`
  - Parâmetros:
    - `facing`: `front|back` (padrão: `front`)
    - `maxWidth`: number (opcional; padrão `1600` no nó iOS)
    - `quality`: `0..1` (opcional; padrão `0.9`)
    - `format`: atualmente `jpg`
    - `delayMs`: number (opcional; padrão `0`)
    - `deviceId`: string (opcional; de `camera.list`)
  - Payload de resposta:
    - `format: "jpg"`
    - `base64: "<...>"`
    - `width`, `height`
  - Proteção de payload: fotos são recomprimidas para manter o payload base64 abaixo de 5 MB.

- `camera.clip`
  - Parâmetros:
    - `facing`: `front|back` (padrão: `front`)
    - `durationMs`: number (padrão `3000`, limitado a um máximo de `60000`)
    - `includeAudio`: boolean (padrão `true`)
    - `format`: atualmente `mp4`
    - `deviceId`: string (opcional; de `camera.list`)
  - Payload de resposta:
    - `format: "mp4"`
    - `base64: "<...>"`
    - `durationMs`
    - `hasAudio`

### Requisito de primeiro plano

Assim como `canvas.*`, o nó iOS permite comandos `camera.*` apenas em **primeiro plano**. Invocações em segundo plano retornam `NODE_BACKGROUND_UNAVAILABLE`.

### Auxiliar de CLI (arquivos temporários + MEDIA)

A forma mais fácil de obter anexos é via o auxiliar de CLI, que grava a mídia decodificada em um arquivo temporário e imprime `MEDIA:<path>`.

Exemplos:

```bash
openclaw nodes camera snap --node <id>               # default: both front + back (2 MEDIA lines)
openclaw nodes camera snap --node <id> --facing front
openclaw nodes camera clip --node <id> --duration 3000
openclaw nodes camera clip --node <id> --no-audio
```

Notas:

- `nodes camera snap` usa como padrão **ambas** as câmeras para fornecer ao agente as duas visões.
- Os arquivos de saída são temporários (no diretório temporário do SO), a menos que você crie seu próprio wrapper.

## Nó Android

### Configuração do usuário (padrão ativado)

- Tela de Configurações do Android → **Câmera** → **Permitir Câmera** (`camera.enabled`)
  - Padrão: **ativado** (chave ausente é tratada como habilitada).
  - Quando desativado: comandos `camera.*` retornam `CAMERA_DISABLED`.

### Permissões

- O Android requer permissões em tempo de execução:
  - `CAMERA` para `camera.snap` e `camera.clip`.
  - `RECORD_AUDIO` para `camera.clip` quando `includeAudio=true`.

Se as permissões estiverem ausentes, o app solicitará quando possível; se negadas, solicitações `camera.*` falham com um erro
`*_PERMISSION_REQUIRED`.

### Requisito de primeiro plano

Assim como `canvas.*`, o nó Android permite comandos `camera.*` apenas em **primeiro plano**. Invocações em segundo plano retornam `NODE_BACKGROUND_UNAVAILABLE`.

### Proteção de payload

Fotos são recomprimidas para manter o payload base64 abaixo de 5 MB.

## App macOS

### Configuração do usuário (padrão desativado)

O app complementar do macOS expõe uma caixa de seleção:

- **Ajustes → Geral → Permitir Câmera** (`openclaw.cameraEnabled`)
  - Padrão: **desativado**
  - Quando desativado: solicitações de câmera retornam “Câmera desativada pelo usuário”.

### Auxiliar de CLI (invocação do nó)

Use a CLI principal `openclaw` para invocar comandos de câmera no nó macOS.

Exemplos:

```bash
openclaw nodes camera list --node <id>            # list camera ids
openclaw nodes camera snap --node <id>            # prints MEDIA:<path>
openclaw nodes camera snap --node <id> --max-width 1280
openclaw nodes camera snap --node <id> --delay-ms 2000
openclaw nodes camera snap --node <id> --device-id <id>
openclaw nodes camera clip --node <id> --duration 10s          # prints MEDIA:<path>
openclaw nodes camera clip --node <id> --duration-ms 3000      # prints MEDIA:<path> (legacy flag)
openclaw nodes camera clip --node <id> --device-id <id>
openclaw nodes camera clip --node <id> --no-audio
```

Notas:

- `openclaw nodes camera snap` usa como padrão `maxWidth=1600` salvo se substituído.
- No macOS, `camera.snap` aguarda `delayMs` (padrão 2000ms) após o aquecimento/estabilização de exposição antes de capturar.
- Payloads de fotos são recomprimidos para manter o base64 abaixo de 5 MB.

## Segurança + limites práticos

- O acesso à câmera e ao microfone aciona os prompts usuais de permissão do SO (e requer strings de uso no Info.plist).
- Clipes de vídeo são limitados (atualmente `<= 60s`) para evitar payloads de nó grandes demais (sobrecarga de base64 + limites de mensagem).

## Vídeo de tela no macOS (nível do SO)

Para vídeo de _tela_ (não da câmera), use o app complementar do macOS:

```bash
openclaw nodes screen record --node <id> --duration 10s --fps 15   # prints MEDIA:<path>
```

Notas:

- Requer permissão de **Gravação de Tela** do macOS (TCC).
