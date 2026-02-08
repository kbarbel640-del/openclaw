---
summary: "Modos de ativacao por voz e push-to-talk, alem de detalhes de roteamento no app para mac"
read_when:
  - Trabalhando em fluxos de ativacao por voz ou PTT
title: "Ativacao por Voz"
x-i18n:
  source_path: platforms/mac/voicewake.md
  source_hash: f6440bb89f349ba5
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:03Z
---

# Ativacao por Voz & Push-to-Talk

## Modos

- **Modo de palavra de ativacao** (padrao): reconhecedor de fala sempre ativo aguarda tokens de disparo (`swabbleTriggerWords`). Ao detectar, inicia a captura, exibe o overlay com texto parcial e envia automaticamente apos silencio.
- **Push-to-talk (segurar Option direito)**: segure a tecla Option direita para capturar imediatamente — sem necessidade de disparo. O overlay aparece enquanto estiver pressionada; ao soltar, finaliza e encaminha apos um pequeno atraso para voce poder ajustar o texto.

## Comportamento em tempo de execucao (palavra de ativacao)

- O reconhecedor de fala vive em `VoiceWakeRuntime`.
- O disparo so ocorre quando ha uma **pausa significativa** entre a palavra de ativacao e a proxima palavra (~0,55s de intervalo). O overlay/alerta sonoro pode iniciar na pausa mesmo antes do comando comecar.
- Janelas de silencio: 2,0s quando a fala esta fluindo, 5,0s se apenas o disparo foi ouvido.
- Parada forcada: 120s para evitar sessoes fora de controle.
- Debounce entre sessoes: 350ms.
- O overlay e controlado via `VoiceWakeOverlayController` com coloracao de comprometido/volatil.
- Apos o envio, o reconhecedor reinicia de forma limpa para ouvir o proximo disparo.

## Invariantes do ciclo de vida

- Se Ativacao por Voz estiver habilitada e as permissoes concedidas, o reconhecedor de palavra de ativacao deve estar ouvindo (exceto durante uma captura explicita de push-to-talk).
- A visibilidade do overlay (incluindo fechamento manual pelo botao X) nunca deve impedir que o reconhecedor retome.

## Modo de falha do overlay preso (anterior)

Anteriormente, se o overlay ficasse preso visivel e voce o fechasse manualmente, a Ativacao por Voz podia parecer “morta”, porque a tentativa de reinicio do runtime podia ser bloqueada pela visibilidade do overlay e nenhum reinicio subsequente era agendado.

Endurecimento:

- O reinicio do runtime de ativacao nao e mais bloqueado pela visibilidade do overlay.
- A conclusao do fechamento do overlay dispara um `VoiceWakeRuntime.refresh(...)` via `VoiceSessionCoordinator`, garantindo que o fechamento manual pelo X sempre retome a escuta.

## Especificos de push-to-talk

- A deteccao de atalho usa um monitor global `.flagsChanged` para **Option direito** (`keyCode 61` + `.option`). Apenas observamos eventos (sem interceptar).
- O pipeline de captura vive em `VoicePushToTalk`: inicia a Fala imediatamente, transmite parciais para o overlay e chama `VoiceWakeForwarder` ao soltar.
- Quando o push-to-talk inicia, pausamos o runtime de palavra de ativacao para evitar disputas de capturas de audio; ele reinicia automaticamente apos a liberacao.
- Permissoes: requer Microfone + Fala; para ver eventos, e necessario aprovacao de Acessibilidade/Monitoramento de Entrada.
- Teclados externos: alguns podem nao expor o Option direito como esperado — ofereca um atalho alternativo se usuarios relatarem falhas.

## Configuracoes voltadas ao usuario

- Alternancia **Ativacao por Voz**: habilita o runtime de palavra de ativacao.
- **Segurar Cmd+Fn para falar**: habilita o monitor de push-to-talk. Desativado no macOS < 26.
- Seletores de idioma e microfone, medidor de nivel ao vivo, tabela de palavras de disparo, testador (apenas local; nao encaminha).
- O seletor de microfone preserva a ultima selecao se um dispositivo desconectar, mostra um aviso de desconectado e recorre temporariamente ao padrao do sistema ate ele retornar.
- **Sons**: alertas sonoros ao detectar o disparo e ao enviar; padrao para o som de sistema “Glass” do macOS. Voce pode escolher qualquer arquivo carregavel por `NSSound` (por exemplo, MP3/WAV/AIFF) para cada evento ou selecionar **Sem Som**.

## Comportamento de encaminhamento

- Quando a Ativacao por Voz esta habilitada, as transcricoes sao encaminhadas para o gateway/agente ativo (o mesmo modo local vs remoto usado pelo restante do app para mac).
- As respostas sao entregues ao **provedor principal usado por ultimo** (WhatsApp/Telegram/Discord/WebChat). Se a entrega falhar, o erro e registrado e a execucao ainda fica visivel via WebChat/registros de sessao.

## Payload de encaminhamento

- `VoiceWakeForwarder.prefixedTranscript(_:)` antepoe a dica da maquina antes do envio. Compartilhado entre os caminhos de palavra de ativacao e push-to-talk.

## Verificacao rapida

- Ative o push-to-talk, segure Cmd+Fn, fale, solte: o overlay deve mostrar parciais e depois enviar.
- Enquanto estiver segurando, as orelhas da barra de menus devem permanecer ampliadas (usa `triggerVoiceEars(ttl:nil)`); elas diminuem apos soltar.
