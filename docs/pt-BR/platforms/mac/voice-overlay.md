---
summary: "Ciclo de vida da sobreposição de voz quando palavra de ativação e push-to-talk se sobrepõem"
read_when:
  - Ajustando o comportamento da sobreposição de voz
title: "Sobreposição de Voz"
x-i18n:
  source_path: platforms/mac/voice-overlay.md
  source_hash: 3be1a60aa7940b23
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:03Z
---

# Ciclo de Vida da Sobreposição de Voz (macOS)

Público: colaboradores do app macOS. Objetivo: manter a sobreposição de voz previsível quando palavra de ativação e push-to-talk se sobrepõem.

### Intenção atual

- Se a sobreposição já estiver visível a partir da palavra de ativação e o usuário pressionar a tecla de atalho, a sessão de hotkey _adota_ o texto existente em vez de reiniciá-lo. A sobreposição permanece ativa enquanto a hotkey é mantida pressionada. Quando o usuário solta: enviar se houver texto aparado; caso contrário, dispensar.
- Apenas palavra de ativação ainda envia automaticamente ao detectar silêncio; push-to-talk envia imediatamente ao soltar.

### Implementado (9 de dezembro de 2025)

- As sessões da sobreposição agora carregam um token por captura (palavra de ativação ou push-to-talk). Atualizações parciais/finais/enviar/dispensar/nível são descartadas quando o token não corresponde, evitando callbacks obsoletos.
- Push-to-talk adota qualquer texto visível da sobreposição como prefixo (assim, pressionar a hotkey enquanto a sobreposição da palavra de ativação está ativa mantém o texto e anexa a nova fala). Ele aguarda até 1,5s por uma transcrição final antes de recorrer ao texto atual.
- Logs de chime/sobreposição são emitidos em `info` nas categorias `voicewake.overlay`, `voicewake.ptt` e `voicewake.chime` (início de sessão, parcial, final, envio, dispensa, motivo do chime).

### Próximos passos

1. **VoiceSessionCoordinator (actor)**
   - Possui exatamente um `VoiceSession` por vez.
   - API (baseada em token): `beginWakeCapture`, `beginPushToTalk`, `updatePartial`, `endCapture`, `cancel`, `applyCooldown`.
   - Descarta callbacks que carregam tokens obsoletos (impede que reconhecedores antigos reabram a sobreposição).
2. **VoiceSession (modelo)**
   - Campos: `token`, `source` (wakeWord|pushToTalk), texto confirmado/volátil, flags de chime, timers (auto-envio, inatividade), `overlayMode` (display|editing|sending), prazo de cooldown.
3. **Vinculação da sobreposição**
   - `VoiceSessionPublisher` (`ObservableObject`) espelha a sessão ativa no SwiftUI.
   - `VoiceWakeOverlayView` renderiza apenas via o publisher; nunca muta singletons globais diretamente.
   - Ações do usuário na sobreposição (`sendNow`, `dismiss`, `edit`) retornam ao coordinator com o token da sessão.
4. **Caminho unificado de envio**
   - Em `endCapture`: se o texto aparado estiver vazio → dispensar; caso contrário, `performSend(session:)` (toca o chime de envio uma vez, encaminha, dispensa).
   - Push-to-talk: sem atraso; palavra de ativação: atraso opcional para auto-envio.
   - Aplique um curto cooldown ao runtime de wake após o término do push-to-talk para que a palavra de ativação não seja reacionada imediatamente.
5. **Logging**
   - O coordinator emite logs `.info` no subsistema `bot.molt`, categorias `voicewake.overlay` e `voicewake.chime`.
   - Eventos-chave: `session_started`, `adopted_by_push_to_talk`, `partial`, `finalized`, `send`, `dismiss`, `cancel`, `cooldown`.

### Checklist de depuração

- Transmita logs enquanto reproduz uma sobreposição travada:

  ```bash
  sudo log stream --predicate 'subsystem == "bot.molt" AND category CONTAINS "voicewake"' --level info --style compact
  ```

- Verifique se há apenas um token de sessão ativo; callbacks obsoletos devem ser descartados pelo coordinator.
- Garanta que a liberação do push-to-talk sempre chame `endCapture` com o token ativo; se o texto estiver vazio, espere `dismiss` sem chime ou envio.

### Etapas de migração (sugeridas)

1. Adicione `VoiceSessionCoordinator`, `VoiceSession` e `VoiceSessionPublisher`.
2. Refatore `VoiceWakeRuntime` para criar/atualizar/encerrar sessões em vez de tocar `VoiceWakeOverlayController` diretamente.
3. Refatore `VoicePushToTalk` para adotar sessões existentes e chamar `endCapture` ao soltar; aplique o cooldown de runtime.
4. Conecte `VoiceWakeOverlayController` ao publisher; remova chamadas diretas do runtime/PTT.
5. Adicione testes de integração para adoção de sessão, cooldown e dispensa com texto vazio.
