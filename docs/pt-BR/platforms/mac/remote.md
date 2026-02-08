---
summary: "Fluxo do app macOS para controlar um Gateway OpenClaw remoto via SSH"
read_when:
  - Configurando ou depurando controle remoto do mac
title: "Controle Remoto"
x-i18n:
  source_path: platforms/mac/remote.md
  source_hash: 61b43707250d5515
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:02Z
---

# OpenClaw remoto (macOS ⇄ host remoto)

Este fluxo permite que o app macOS atue como um controle remoto completo para um Gateway OpenClaw em execucao em outro host (desktop/servidor). Este e o recurso **Remote over SSH** (execucao remota) do app. Todos os recursos — verificacoes de saude, encaminhamento de Voice Wake e Web Chat — reutilizam a mesma configuracao remota de SSH em _Settings → General_.

## Modos

- **Local (este Mac)**: Tudo roda no laptop. Sem SSH.
- **Remote over SSH (padrao)**: Comandos do OpenClaw sao executados no host remoto. O app mac abre uma conexao SSH com `-o BatchMode` mais a identidade/chave escolhida e um encaminhamento de porta local.
- **Remote direct (ws/wss)**: Sem tunel SSH. O app mac conecta diretamente ao URL do gateway (por exemplo, via Tailscale Serve ou um reverse proxy HTTPS publico).

## Transportes remotos

O modo remoto oferece suporte a dois transportes:

- **Tunel SSH** (padrao): Usa `ssh -N -L ...` para encaminhar a porta do gateway para localhost. O gateway vera o IP do node como `127.0.0.1` porque o tunel e loopback.
- **Direto (ws/wss)**: Conecta diretamente ao URL do gateway. O gateway ve o IP real do cliente.

## Pre-requisitos no host remoto

1. Instale Node + pnpm e construa/instale a CLI do OpenClaw (`pnpm install && pnpm build && pnpm link --global`).
2. Garanta que `openclaw` esteja no PATH para shells nao interativos (crie um symlink em `/usr/local/bin` ou `/opt/homebrew/bin` se necessario).
3. Abra o SSH com autenticacao por chave. Recomendamos IPs do **Tailscale** para alcance estavel fora da LAN.

## Configuracao do app macOS

1. Abra _Settings → General_.
2. Em **OpenClaw runs**, escolha **Remote over SSH** e defina:
   - **Transport**: **Tunel SSH** ou **Direto (ws/wss)**.
   - **SSH target**: `user@host` (opcional `:port`).
     - Se o gateway estiver na mesma LAN e anunciar Bonjour, selecione-o na lista descoberta para preencher este campo automaticamente.
   - **Gateway URL** (somente Direto): `wss://gateway.example.ts.net` (ou `ws://...` para local/LAN).
   - **Identity file** (avancado): caminho para sua chave.
   - **Project root** (avancado): caminho do checkout remoto usado para comandos.
   - **CLI path** (avancado): caminho opcional para um entrypoint/binario executavel `openclaw` (preenchido automaticamente quando anunciado).
3. Clique em **Test remote**. Sucesso indica que o `openclaw status --json` remoto executa corretamente. Falhas normalmente indicam problemas de PATH/CLI; saida 127 significa que a CLI nao foi encontrada remotamente.
4. As verificacoes de saude e o Web Chat agora rodarao automaticamente por este tunel SSH.

## Web Chat

- **Tunel SSH**: O Web Chat conecta ao gateway pela porta de controle WebSocket encaminhada (padrao 18789).
- **Direto (ws/wss)**: O Web Chat conecta diretamente ao URL do gateway configurado.
- Nao existe mais um servidor HTTP separado de WebChat.

## Permissoes

- O host remoto precisa das mesmas aprovacoes de TCC que o local (Automacao, Acessibilidade, Gravacao de Tela, Microfone, Reconhecimento de Fala, Notificacoes). Execute a integracao inicial nessa maquina para conceder uma vez.
- Nodes anunciam seu estado de permissoes via `node.list` / `node.describe` para que os agentes saibam o que esta disponivel.

## Notas de seguranca

- Prefira binds em loopback no host remoto e conecte via SSH ou Tailscale.
- Se voce fizer bind do Gateway a uma interface nao loopback, exija autenticacao por token/senha.
- Veja [Security](/gateway/security) e [Tailscale](/gateway/tailscale).

## Fluxo de login do WhatsApp (remoto)

- Execute `openclaw channels login --verbose` **no host remoto**. Escaneie o QR com o WhatsApp no seu telefone.
- Reexecute o login nesse host se a autenticacao expirar. A verificacao de saude mostrara problemas de vinculacao.

## Solucao de problemas

- **exit 127 / not found**: `openclaw` nao esta no PATH para shells sem login. Adicione-o a `/etc/paths`, ao rc do seu shell, ou crie um symlink em `/usr/local/bin`/`/opt/homebrew/bin`.
- **Health probe failed**: verifique a conectividade SSH, o PATH e se o Baileys esta logado (`openclaw status --json`).
- **Web Chat travado**: confirme que o gateway esta rodando no host remoto e que a porta encaminhada corresponde a porta WS do gateway; a UI exige uma conexao WS saudavel.
- **IP do node mostra 127.0.0.1**: esperado com o tunel SSH. Mude **Transport** para **Direto (ws/wss)** se voce quiser que o gateway veja o IP real do cliente.
- **Voice Wake**: frases de ativacao sao encaminhadas automaticamente no modo remoto; nao e necessario um encaminhador separado.

## Sons de notificacao

Escolha sons por notificacao a partir de scripts com `openclaw` e `node.invoke`, por exemplo:

```bash
openclaw nodes notify --node <id> --title "Ping" --body "Remote gateway ready" --sound Glass
```

Nao ha mais uma alternancia global de “som padrao” no app; os chamadores escolhem um som (ou nenhum) por solicitacao.
