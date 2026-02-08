---
summary: "persistência de permissões no macOS (TCC) e requisitos de assinatura"
read_when:
  - Depuração de prompts de permissões do macOS ausentes ou travados
  - Empacotamento ou assinatura do app para macOS
  - Alteração de IDs de bundle ou caminhos de instalação do app
title: "Permissões do macOS"
x-i18n:
  source_path: platforms/mac/permissions.md
  source_hash: d012589c0583dd0b
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:54Z
---

# permissões do macOS (TCC)

As concessões de permissão do macOS são frágeis. O TCC associa uma concessão de permissão à
assinatura de código do app, ao identificador do bundle e ao caminho no disco. Se qualquer um desses mudar,
o macOS trata o app como novo e pode remover ou ocultar os prompts.

## Requisitos para permissões estáveis

- Mesmo caminho: execute o app a partir de um local fixo (para o OpenClaw, `dist/OpenClaw.app`).
- Mesmo identificador de bundle: alterar o ID do bundle cria uma nova identidade de permissão.
- App assinado: builds não assinados ou com assinatura ad-hoc não persistem permissões.
- Assinatura consistente: use um certificado real de Apple Development ou Developer ID
  para que a assinatura permaneça estável entre rebuilds.

Assinaturas ad-hoc geram uma nova identidade a cada build. O macOS esquecerá concessões anteriores,
e os prompts podem desaparecer completamente até que as entradas obsoletas sejam limpas.

## Checklist de recuperação quando os prompts desaparecem

1. Encerre o app.
2. Remova a entrada do app em Ajustes do Sistema -> Privacidade e Segurança.
3. Reabra o app a partir do mesmo caminho e conceda as permissões novamente.
4. Se o prompt ainda não aparecer, redefina as entradas do TCC com `tccutil` e tente novamente.
5. Algumas permissões só reaparecem após uma reinicialização completa do macOS.

Exemplos de redefinição (substitua o ID do bundle conforme necessário):

```bash
sudo tccutil reset Accessibility bot.molt.mac
sudo tccutil reset ScreenCapture bot.molt.mac
sudo tccutil reset AppleEvents
```

Se voce estiver testando permissões, sempre assine com um certificado real. Builds ad-hoc
são aceitáveis apenas para execuções locais rápidas em que as permissões não importam.
