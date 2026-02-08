---
summary: "Uso da ferramenta Exec, modos de stdin e suporte a TTY"
read_when:
  - Ao usar ou modificar a ferramenta exec
  - Ao depurar comportamento de stdin ou TTY
title: "Ferramenta Exec"
x-i18n:
  source_path: tools/exec.md
  source_hash: 3b32238dd8dce93d
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:47Z
---

# Ferramenta Exec

Execute comandos de shell no workspace. Oferece suporte a execução em primeiro plano + segundo plano via `process`.
Se `process` não for permitido, `exec` é executado de forma síncrona e ignora `yieldMs`/`background`.
As sessões em segundo plano são delimitadas por agente; `process` vê apenas sessões do mesmo agente.

## Parâmetros

- `command` (obrigatório)
- `workdir` (padrão: cwd)
- `env` (substituições chave/valor)
- `yieldMs` (padrão 10000): ir automaticamente para segundo plano após atraso
- `background` (bool): ir imediatamente para segundo plano
- `timeout` (segundos, padrão 1800): encerrar ao expirar
- `pty` (bool): executar em um pseudo-terminal quando disponível (CLIs somente TTY, agentes de codificação, UIs de terminal)
- `host` (`sandbox | gateway | node`): onde executar
- `security` (`deny | allowlist | full`): modo de aplicação para `gateway`/`node`
- `ask` (`off | on-miss | always`): prompts de aprovação para `gateway`/`node`
- `node` (string): id/nome do nó para `host=node`
- `elevated` (bool): solicitar modo elevado (host do gateway); `security=full` só é forçado quando elevado resolve para `full`

Notas:

- `host` usa `sandbox` por padrão.
- `elevated` é ignorado quando o sandboxing está desligado (o exec já roda no host).
- As aprovações de `gateway`/`node` são controladas por `~/.openclaw/exec-approvals.json`.
- `node` requer um nó pareado (aplicativo complementar ou host de nó headless).
- Se houver vários nós disponíveis, defina `exec.node` ou `tools.exec.node` para selecionar um.
- Em hosts não Windows, o exec usa `SHELL` quando definido; se `SHELL` for `fish`, ele prefere `bash` (ou `sh`)
  de `PATH` para evitar scripts incompatíveis com fish, e então faz fallback para `SHELL` se nenhum existir.
- A execução no host (`gateway`/`node`) rejeita `env.PATH` e substituições de loader (`LD_*`/`DYLD_*`) para
  evitar sequestro de binários ou código injetado.
- Importante: o sandboxing está **desligado por padrão**. Se o sandboxing estiver desligado, `host=sandbox` executa diretamente no
  host do gateway (sem contêiner) e **não requer aprovações**. Para exigir aprovações, execute com
  `host=gateway` e configure aprovações de exec (ou habilite o sandboxing).

## Configuracao

- `tools.exec.notifyOnExit` (padrão: true): quando true, sessões de exec em segundo plano enfileiram um evento do sistema e solicitam um heartbeat na saída.
- `tools.exec.approvalRunningNoticeMs` (padrão: 10000): emite um único aviso “em execução” quando um exec com aprovação obrigatória roda por mais tempo que isso (0 desativa).
- `tools.exec.host` (padrão: `sandbox`)
- `tools.exec.security` (padrão: `deny` para sandbox, `allowlist` para gateway + nó quando não definido)
- `tools.exec.ask` (padrão: `on-miss`)
- `tools.exec.node` (padrão: não definido)
- `tools.exec.pathPrepend`: lista de diretórios a serem prefixados em `PATH` para execuções de exec.
- `tools.exec.safeBins`: binários seguros somente de stdin que podem rodar sem entradas explícitas na allowlist.

Exemplo:

```json5
{
  tools: {
    exec: {
      pathPrepend: ["~/bin", "/opt/oss/bin"],
    },
  },
}
```

### Manipulação de PATH

- `host=gateway`: mescla o `PATH` do seu shell de login no ambiente de exec. Substituições de `env.PATH` são
  rejeitadas para execução no host. O daemon em si ainda roda com um `PATH` mínimo:
  - macOS: `/opt/homebrew/bin`, `/usr/local/bin`, `/usr/bin`, `/bin`
  - Linux: `/usr/local/bin`, `/usr/bin`, `/bin`
- `host=sandbox`: executa `sh -lc` (shell de login) dentro do contêiner, então `/etc/profile` pode redefinir `PATH`.
  O OpenClaw prefixa `env.PATH` após o sourcing do perfil via uma variável de ambiente interna (sem interpolação de shell);
  `tools.exec.pathPrepend` também se aplica aqui.
- `host=node`: apenas substituições de env não bloqueadas que você passa são enviadas ao nó. Substituições de `env.PATH` são
  rejeitadas para execução no host. Hosts de nó headless aceitam `PATH` apenas quando ele prefixa o PATH do host do nó
  (sem substituição). Nós macOS descartam completamente substituições de `PATH`.

Vinculação de nó por agente (use o índice da lista de agentes na configuracao):

```bash
openclaw config get agents.list
openclaw config set agents.list[0].tools.exec.node "node-id-or-name"
```

UI de controle: a aba Nodes inclui um pequeno painel “Exec node binding” para as mesmas configurações.

## Substituições de sessão (`/exec`)

Use `/exec` para definir padrões **por sessão** para `host`, `security`, `ask` e `node`.
Envie `/exec` sem argumentos para mostrar os valores atuais.

Exemplo:

```
/exec host=gateway security=allowlist ask=on-miss node=mac-1
```

## Modelo de autorizacao

`/exec` só é respeitado para **remetentes autorizados** (allowlists de canal/pareamento mais `commands.useAccessGroups`).
Ele atualiza **apenas o estado da sessão** e não grava configuracao. Para desativar o exec de forma rígida, negue-o via política
da ferramenta (`tools.deny: ["exec"]` ou por agente). As aprovações do host ainda se aplicam, a menos que você defina explicitamente
`security=full` e `ask=off`.

## Aprovações de exec (aplicativo complementar / host do nó)

Agentes em sandbox podem exigir aprovação por solicitação antes que `exec` execute no host do gateway ou do nó.
Veja [Exec approvals](/tools/exec-approvals) para a política, a allowlist e o fluxo de UI.

Quando aprovações são exigidas, a ferramenta exec retorna imediatamente com
`status: "approval-pending"` e um id de aprovação. Após aprovado (ou negado / expirado),
o Gateway emite eventos do sistema (`Exec finished` / `Exec denied`). Se o comando ainda estiver
em execução após `tools.exec.approvalRunningNoticeMs`, um único aviso `Exec running` é emitido.

## Allowlist + bins seguros

A aplicação da allowlist corresponde **apenas a caminhos de binários resolvidos** (sem correspondência por basename). Quando
`security=allowlist`, comandos de shell são automaticamente permitidos apenas se cada segmento do pipeline estiver
na allowlist ou for um bin seguro. Encadeamento (`;`, `&&`, `||`) e redirecionamentos são rejeitados no
modo allowlist.

## Exemplos

Primeiro plano:

```json
{ "tool": "exec", "command": "ls -la" }
```

Segundo plano + consulta:

```json
{"tool":"exec","command":"npm run build","yieldMs":1000}
{"tool":"process","action":"poll","sessionId":"<id>"}
```

Enviar teclas (estilo tmux):

```json
{"tool":"process","action":"send-keys","sessionId":"<id>","keys":["Enter"]}
{"tool":"process","action":"send-keys","sessionId":"<id>","keys":["C-c"]}
{"tool":"process","action":"send-keys","sessionId":"<id>","keys":["Up","Up","Enter"]}
```

Enviar (apenas enviar CR):

```json
{ "tool": "process", "action": "submit", "sessionId": "<id>" }
```

Colar (delimitado por padrão):

```json
{ "tool": "process", "action": "paste", "sessionId": "<id>", "text": "line1\nline2\n" }
```

## apply_patch (experimental)

`apply_patch` é uma subferramenta de `exec` para edições estruturadas em vários arquivos.
Habilite-a explicitamente:

```json5
{
  tools: {
    exec: {
      applyPatch: { enabled: true, allowModels: ["gpt-5.2"] },
    },
  },
}
```

Notas:

- Disponível apenas para modelos OpenAI/OpenAI Codex.
- A política da ferramenta ainda se aplica; `allow: ["exec"]` permite implicitamente `apply_patch`.
- A configuracao fica em `tools.exec.applyPatch`.
