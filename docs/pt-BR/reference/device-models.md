---
summary: "Como o OpenClaw incorpora identificadores de modelos de dispositivos da Apple para nomes amigáveis no app macOS."
read_when:
  - Ao atualizar mapeamentos de identificadores de modelos de dispositivos ou arquivos NOTICE/licença
  - Ao alterar como a UI de Instances exibe nomes de dispositivos
title: "Banco de dados de modelos de dispositivos"
x-i18n:
  source_path: reference/device-models.md
  source_hash: 1d99c2538a0d8fdd
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:14Z
---

# Banco de dados de modelos de dispositivos (nomes amigáveis)

O app complementar do macOS mostra nomes amigáveis de modelos de dispositivos da Apple na UI **Instances**, mapeando identificadores de modelo da Apple (por exemplo, `iPad16,6`, `Mac16,6`) para nomes legíveis por humanos.

O mapeamento é incorporado como JSON em:

- `apps/macos/Sources/OpenClaw/Resources/DeviceModels/`

## Fonte de dados

Atualmente incorporamos o mapeamento a partir do repositório licenciado sob MIT:

- `kyle-seongwoo-jun/apple-device-identifiers`

Para manter builds determinísticas, os arquivos JSON são fixados em commits específicos do upstream (registrados em `apps/macos/Sources/OpenClaw/Resources/DeviceModels/NOTICE.md`).

## Atualizando o banco de dados

1. Escolha os commits do upstream que voce deseja fixar (um para iOS, um para macOS).
2. Atualize os hashes de commit em `apps/macos/Sources/OpenClaw/Resources/DeviceModels/NOTICE.md`.
3. Baixe novamente os arquivos JSON, fixados nesses commits:

```bash
IOS_COMMIT="<commit sha for ios-device-identifiers.json>"
MAC_COMMIT="<commit sha for mac-device-identifiers.json>"

curl -fsSL "https://raw.githubusercontent.com/kyle-seongwoo-jun/apple-device-identifiers/${IOS_COMMIT}/ios-device-identifiers.json" \
  -o apps/macos/Sources/OpenClaw/Resources/DeviceModels/ios-device-identifiers.json

curl -fsSL "https://raw.githubusercontent.com/kyle-seongwoo-jun/apple-device-identifiers/${MAC_COMMIT}/mac-device-identifiers.json" \
  -o apps/macos/Sources/OpenClaw/Resources/DeviceModels/mac-device-identifiers.json
```

4. Garanta que `apps/macos/Sources/OpenClaw/Resources/DeviceModels/LICENSE.apple-device-identifiers.txt` ainda corresponda ao upstream (substitua-o se a licença do upstream mudar).
5. Verifique se o app macOS compila corretamente (sem avisos):

```bash
swift build --package-path apps/macos
```
