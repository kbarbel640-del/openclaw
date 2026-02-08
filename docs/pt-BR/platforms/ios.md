---
summary: "Aplicativo de nó iOS: conectar ao Gateway, pareamento, canvas e solucao de problemas"
read_when:
  - Pareamento ou reconexao do nó iOS
  - Executar o aplicativo iOS a partir do codigo-fonte
  - Depurar a descoberta do gateway ou comandos de canvas
title: "Aplicativo iOS"
x-i18n:
  source_path: platforms/ios.md
  source_hash: 692eebdc82e4bb8d
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:51Z
---

# Aplicativo iOS (Nó)

Disponibilidade: prévia interna. O aplicativo iOS ainda não é distribuído publicamente.

## O que ele faz

- Conecta-se a um Gateway via WebSocket (LAN ou tailnet).
- Expõe capacidades do nó: Canvas, captura de tela, captura da câmera, localização, modo de fala, ativação por voz.
- Recebe comandos `node.invoke` e reporta eventos de status do nó.

## Requisitos

- Gateway em execução em outro dispositivo (macOS, Linux ou Windows via WSL2).
- Caminho de rede:
  - Mesma LAN via Bonjour, **ou**
  - Tailnet via DNS-SD unicast (domínio de exemplo: `openclaw.internal.`), **ou**
  - Host/porta manual (alternativa).

## Inicio rapido (parear + conectar)

1. Inicie o Gateway:

```bash
openclaw gateway --port 18789
```

2. No aplicativo iOS, abra Settings e selecione um gateway descoberto (ou ative Manual Host e informe host/porta).

3. Aprove a solicitação de pareamento no host do gateway:

```bash
openclaw nodes pending
openclaw nodes approve <requestId>
```

4. Verifique a conexão:

```bash
openclaw nodes status
openclaw gateway call node.list --params "{}"
```

## Caminhos de descoberta

### Bonjour (LAN)

O Gateway anuncia `_openclaw-gw._tcp` em `local.`. O aplicativo iOS lista esses automaticamente.

### Tailnet (entre redes)

Se o mDNS estiver bloqueado, use uma zona DNS-SD unicast (escolha um domínio; exemplo: `openclaw.internal.`) e o split DNS do Tailscale.
Veja [Bonjour](/gateway/bonjour) para o exemplo de CoreDNS.

### Host/porta manual

Em Settings, ative **Manual Host** e informe o host + porta do gateway (padrão `18789`).

## Canvas + A2UI

O nó iOS renderiza um canvas WKWebView. Use `node.invoke` para controlá-lo:

```bash
openclaw nodes invoke --node "iOS Node" --command canvas.navigate --params '{"url":"http://<gateway-host>:18793/__openclaw__/canvas/"}'
```

Observações:

- O host de canvas do Gateway serve `/__openclaw__/canvas/` e `/__openclaw__/a2ui/`.
- O nó iOS navega automaticamente para o A2UI ao conectar quando uma URL de host de canvas é anunciada.
- Retorne ao scaffold integrado com `canvas.navigate` e `{"url":""}`.

### Avaliação / snapshot do canvas

```bash
openclaw nodes invoke --node "iOS Node" --command canvas.eval --params '{"javaScript":"(() => { const {ctx} = window.__openclaw; ctx.clearRect(0,0,innerWidth,innerHeight); ctx.lineWidth=6; ctx.strokeStyle=\"#ff2d55\"; ctx.beginPath(); ctx.moveTo(40,40); ctx.lineTo(innerWidth-40, innerHeight-40); ctx.stroke(); return \"ok\"; })()"}'
```

```bash
openclaw nodes invoke --node "iOS Node" --command canvas.snapshot --params '{"maxWidth":900,"format":"jpeg"}'
```

## Ativacao por voz + modo de fala

- A ativacao por voz e o modo de fala estão disponíveis em Settings.
- O iOS pode suspender o audio em segundo plano; trate os recursos de voz como melhor esforço quando o aplicativo nao estiver ativo.

## Erros comuns

- `NODE_BACKGROUND_UNAVAILABLE`: traga o aplicativo iOS para o primeiro plano (comandos de canvas/camera/tela exigem isso).
- `A2UI_HOST_NOT_CONFIGURED`: o Gateway nao anunciou uma URL de host de canvas; verifique `canvasHost` em [Configuracao do Gateway](/gateway/configuration).
- O prompt de pareamento nunca aparece: execute `openclaw nodes pending` e aprove manualmente.
- Falha ao reconectar apos reinstalar: o token de pareamento do Keychain foi limpo; refaça o pareamento do nó.

## Documentacao relacionada

- [Pareamento](/gateway/pairing)
- [Descoberta](/gateway/discovery)
- [Bonjour](/gateway/bonjour)
