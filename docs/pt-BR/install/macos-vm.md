---
summary: "Execute o OpenClaw em uma VM macOS em sandbox (local ou hospedada) quando voce precisar de isolamento ou iMessage"
read_when:
  - Voce quer o OpenClaw isolado do seu ambiente macOS principal
  - Voce quer integracao com iMessage (BlueBubbles) em uma sandbox
  - Voce quer um ambiente macOS redefinivel que possa ser clonado
  - Voce quer comparar opcoes de VM macOS local vs hospedada
title: "VMs macOS"
x-i18n:
  source_path: install/macos-vm.md
  source_hash: 4d1c85a5e4945f9f
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:44Z
---

# OpenClaw em VMs macOS (Sandboxing)

## Padrao recomendado (maioria dos usuarios)

- **VPS Linux pequeno** para um Gateway sempre ligado e baixo custo. Veja [VPS hosting](/vps).
- **Hardware dedicado** (Mac mini ou caixa Linux) se voce quiser controle total e um **IP residencial** para automacao de navegador. Muitos sites bloqueiam IPs de data center, entao a navegacao local costuma funcionar melhor.
- **Hibrido:** mantenha o Gateway em um VPS barato e conecte seu Mac como um **node** quando precisar de automacao de navegador/UI. Veja [Nodes](/nodes) e [Gateway remote](/gateway/remote).

Use uma VM macOS quando voce precisar especificamente de recursos exclusivos do macOS (iMessage/BlueBubbles) ou quiser isolamento rigoroso do seu Mac do dia a dia.

## Opcoes de VM macOS

### VM local no seu Mac Apple Silicon (Lume)

Execute o OpenClaw em uma VM macOS em sandbox no seu Mac Apple Silicon existente usando o [Lume](https://cua.ai/docs/lume).

Isso oferece:

- Ambiente macOS completo em isolamento (seu host permanece limpo)
- Suporte a iMessage via BlueBubbles (impossivel no Linux/Windows)
- Reset instantaneo clonando VMs
- Sem custos extras de hardware ou nuvem

### Provedores de Mac hospedado (nuvem)

Se voce quiser macOS na nuvem, provedores de Mac hospedado tambem funcionam:

- [MacStadium](https://www.macstadium.com/) (Macs hospedados)
- Outros fornecedores de Mac hospedado tambem funcionam; siga a documentacao deles de VM + SSH

Depois de ter acesso SSH a uma VM macOS, continue no passo 6 abaixo.

---

## Caminho rapido (Lume, usuarios experientes)

1. Instale o Lume
2. `lume create openclaw --os macos --ipsw latest`
3. Conclua o Assistente de Configuracao, ative o Login Remoto (SSH)
4. `lume run openclaw --no-display`
5. Acesse via SSH, instale o OpenClaw, configure os canais
6. Pronto

---

## O que voce precisa (Lume)

- Mac Apple Silicon (M1/M2/M3/M4)
- macOS Sequoia ou posterior no host
- ~60 GB de espaco livre em disco por VM
- ~20 minutos

---

## 1) Instalar o Lume

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/trycua/cua/main/libs/lume/scripts/install.sh)"
```

Se `~/.local/bin` nao estiver no seu PATH:

```bash
echo 'export PATH="$PATH:$HOME/.local/bin"' >> ~/.zshrc && source ~/.zshrc
```

Verifique:

```bash
lume --version
```

Docs: [Instalacao do Lume](https://cua.ai/docs/lume/guide/getting-started/installation)

---

## 2) Criar a VM macOS

```bash
lume create openclaw --os macos --ipsw latest
```

Isso baixa o macOS e cria a VM. Uma janela VNC abre automaticamente.

Nota: O download pode levar um tempo dependendo da sua conexao.

---

## 3) Concluir o Assistente de Configuracao

Na janela VNC:

1. Selecione idioma e regiao
2. Pule o Apple ID (ou faca login se quiser iMessage depois)
3. Crie uma conta de usuario (lembre-se do nome de usuario e senha)
4. Pule todos os recursos opcionais

Depois que a configuracao terminar, ative o SSH:

1. Abra Ajustes do Sistema → Geral → Compartilhamento
2. Ative "Login Remoto"

---

## 4) Obter o endereco IP da VM

```bash
lume get openclaw
```

Procure o endereco IP (geralmente `192.168.64.x`).

---

## 5) Acessar a VM via SSH

```bash
ssh youruser@192.168.64.X
```

Substitua `youruser` pela conta que voce criou e o IP pelo IP da sua VM.

---

## 6) Instalar o OpenClaw

Dentro da VM:

```bash
npm install -g openclaw@latest
openclaw onboard --install-daemon
```

Siga os prompts de integracao inicial para configurar seu provedor de modelo (Anthropic, OpenAI, etc.).

---

## 7) Configurar canais

Edite o arquivo de configuracao:

```bash
nano ~/.openclaw/openclaw.json
```

Adicione seus canais:

```json
{
  "channels": {
    "whatsapp": {
      "dmPolicy": "allowlist",
      "allowFrom": ["+15551234567"]
    },
    "telegram": {
      "botToken": "YOUR_BOT_TOKEN"
    }
  }
}
```

Em seguida, faca login no WhatsApp (escaneie o QR):

```bash
openclaw channels login
```

---

## 8) Executar a VM sem interface grafica

Pare a VM e reinicie sem exibicao:

```bash
lume stop openclaw
lume run openclaw --no-display
```

A VM roda em segundo plano. O daemon do OpenClaw mantem o gateway em execucao.

Para verificar o status:

```bash
ssh youruser@192.168.64.X "openclaw status"
```

---

## Bonus: integracao com iMessage

Este e o grande diferencial de rodar no macOS. Use o [BlueBubbles](https://bluebubbles.app) para adicionar iMessage ao OpenClaw.

Dentro da VM:

1. Baixe o BlueBubbles em bluebubbles.app
2. Faca login com seu Apple ID
3. Ative a Web API e defina uma senha
4. Aponte os webhooks do BlueBubbles para seu gateway (exemplo: `https://your-gateway-host:3000/bluebubbles-webhook?password=<password>`)

Adicione ao seu arquivo de configuracao do OpenClaw:

```json
{
  "channels": {
    "bluebubbles": {
      "serverUrl": "http://localhost:1234",
      "password": "your-api-password",
      "webhookPath": "/bluebubbles-webhook"
    }
  }
}
```

Reinicie o gateway. Agora seu agente pode enviar e receber iMessages.

Detalhes completos de configuracao: [Canal BlueBubbles](/channels/bluebubbles)

---

## Salvar uma imagem dourada

Antes de personalizar mais, capture um snapshot do estado limpo:

```bash
lume stop openclaw
lume clone openclaw openclaw-golden
```

Restaure a qualquer momento:

```bash
lume stop openclaw && lume delete openclaw
lume clone openclaw-golden openclaw
lume run openclaw --no-display
```

---

## Execucao 24/7

Mantenha a VM em execucao:

- Mantendo seu Mac conectado a energia
- Desativando o repouso em Ajustes do Sistema → Economia de Energia
- Usando `caffeinate` se necessario

Para verdadeiro sempre ligado, considere um Mac mini dedicado ou um VPS pequeno. Veja [VPS hosting](/vps).

---

## Solucao de problemas

| Problema                         | Solucao                                                                                |
| -------------------------------- | -------------------------------------------------------------------------------------- |
| Nao consigo acessar a VM via SSH | Verifique se "Login Remoto" esta ativado nos Ajustes do Sistema da VM                  |
| IP da VM nao aparece             | Aguarde a VM inicializar completamente e execute `lume get openclaw` novamente         |
| Comando do Lume nao encontrado   | Adicione `~/.local/bin` ao seu PATH                                                    |
| QR do WhatsApp nao escaneia      | Garanta que voce esta logado na VM (nao no host) ao executar `openclaw channels login` |

---

## Documentos relacionados

- [VPS hosting](/vps)
- [Nodes](/nodes)
- [Gateway remote](/gateway/remote)
- [Canal BlueBubbles](/channels/bluebubbles)
- [Inicio Rapido do Lume](https://cua.ai/docs/lume/guide/getting-started/quickstart)
- [Referencia da CLI do Lume](https://cua.ai/docs/lume/reference/cli-reference)
- [Configuracao de VM sem atendimento](https://cua.ai/docs/lume/guide/fundamentals/unattended-setup) (avancado)
- [Docker Sandboxing](/install/docker) (abordagem alternativa de isolamento)
