---
summary: "Comando de localização para nodes (location.get), modos de permissão e comportamento em segundo plano"
read_when:
  - Adicionar suporte a node de localização ou UI de permissões
  - Projetar fluxos de localização em segundo plano + push
title: "Comando de Localização"
x-i18n:
  source_path: nodes/location-command.md
  source_hash: 23124096256384d2
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:42Z
---

# Comando de localização (nodes)

## TL;DR

- `location.get` é um comando de node (via `node.invoke`).
- Desativado por padrão.
- As configurações usam um seletor: Desligado / Enquanto em Uso / Sempre.
- Alternância separada: Localização Precisa.

## Por que um seletor (não apenas um switch)

As permissões do SO são multinível. Podemos expor um seletor no app, mas o SO ainda decide a concessão real.

- iOS/macOS: o usuário pode escolher **Enquanto em Uso** ou **Sempre** nos prompts/Configurações do sistema. O app pode solicitar upgrade, mas o SO pode exigir Configurações.
- Android: localização em segundo plano é uma permissão separada; no Android 10+ geralmente exige um fluxo em Configurações.
- Localização precisa é uma concessão separada (iOS 14+ “Precise”, Android “fine” vs “coarse”).

O seletor na UI define o modo solicitado; a concessão real fica nas configurações do SO.

## Modelo de configurações

Por dispositivo de node:

- `location.enabledMode`: `off | whileUsing | always`
- `location.preciseEnabled`: bool

Comportamento da UI:

- Selecionar `whileUsing` solicita permissão em primeiro plano.
- Selecionar `always` primeiro garante `whileUsing`, depois solicita segundo plano (ou envia o usuário para Configurações se necessário).
- Se o SO negar o nível solicitado, reverter para o nível mais alto concedido e mostrar o status.

## Mapeamento de permissões (node.permissions)

Opcional. O node macOS reporta `location` via o mapa de permissões; iOS/Android podem omitir.

## Comando: `location.get`

Chamado via `node.invoke`.

Parâmetros (sugeridos):

```json
{
  "timeoutMs": 10000,
  "maxAgeMs": 15000,
  "desiredAccuracy": "coarse|balanced|precise"
}
```

Payload de resposta:

```json
{
  "lat": 48.20849,
  "lon": 16.37208,
  "accuracyMeters": 12.5,
  "altitudeMeters": 182.0,
  "speedMps": 0.0,
  "headingDeg": 270.0,
  "timestamp": "2026-01-03T12:34:56.000Z",
  "isPrecise": true,
  "source": "gps|wifi|cell|unknown"
}
```

Erros (códigos estáveis):

- `LOCATION_DISABLED`: seletor desligado.
- `LOCATION_PERMISSION_REQUIRED`: permissão ausente para o modo solicitado.
- `LOCATION_BACKGROUND_UNAVAILABLE`: app em segundo plano, mas apenas Enquanto em Uso é permitido.
- `LOCATION_TIMEOUT`: sem fix dentro do tempo.
- `LOCATION_UNAVAILABLE`: falha do sistema / sem provedores.

## Comportamento em segundo plano (futuro)

Objetivo: o modelo pode solicitar localização mesmo quando o node está em segundo plano, mas apenas quando:

- O usuário selecionou **Sempre**.
- O SO concede localização em segundo plano.
- O app está autorizado a executar em segundo plano para localização (modo de segundo plano do iOS / serviço em primeiro plano do Android ou autorização especial).

Fluxo acionado por push (futuro):

1. O Gateway envia um push para o node (push silencioso ou dados FCM).
2. O node acorda brevemente e solicita localização do dispositivo.
3. O node encaminha o payload para o Gateway.

Notas:

- iOS: permissão Sempre + modo de localização em segundo plano são obrigatórios. Push silencioso pode ser limitado; espere falhas intermitentes.
- Android: localização em segundo plano pode exigir um serviço em primeiro plano; caso contrário, espere negação.

## Integração com modelo/ferramentas

- Superfície de ferramentas: a ferramenta `nodes` adiciona a ação `location_get` (node obrigatório).
- CLI: `openclaw nodes location get --node <id>`.
- Diretrizes do agente: chame apenas quando o usuário tiver habilitado a localização e entender o escopo.

## Texto de UX (sugerido)

- Desligado: “O compartilhamento de localização está desativado.”
- Enquanto em Uso: “Somente quando o OpenClaw estiver aberto.”
- Sempre: “Permitir localização em segundo plano. Requer permissão do sistema.”
- Precisa: “Usar localização GPS precisa. Desative para compartilhar localização aproximada.”
