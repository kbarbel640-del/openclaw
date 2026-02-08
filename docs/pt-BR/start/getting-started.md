---
summary: "Instale o OpenClaw e inicie seu primeiro chat em poucos minutos."
read_when:
  - Primeira configuração do zero
  - Quer o caminho mais rápido para um chat funcionando
title: "Primeiros Passos"
x-i18n:
  generated_at: "2026-02-08T22:00:00Z"
  model: claude-sonnet-4
  provider: pi
  source_hash: 6c93ffa2625c5778e4d8534284eadac80d8d052bab0333185cce495d2acecf01
  source_path: start/getting-started.md
  workflow: 15
---

# Primeiros Passos

Objetivo: partir do zero e chegar a um primeiro chat funcionando com configuração mínima.

<Info>
Chat mais rápido: abra a Control UI (sem configuração de canal necessária). Execute `openclaw dashboard`
e converse no navegador, ou abra `http://127.0.0.1:18789/` no
<Tooltip headline="Host do Gateway" tip="A máquina que executa o serviço gateway do OpenClaw.">host do Gateway</Tooltip>.
Documentação: [Dashboard](/web/dashboard) e [Control UI](/web/control-ui).
</Info>

## Pré-requisitos

- Node 22 ou superior

<Tip>
Verifique sua versão do Node com `node --version` se não tiver certeza.
</Tip>

## Configuração rápida (CLI)

<Steps>
  <Step title="Instale o OpenClaw (recomendado)">
    <Tabs>
      <Tab title="macOS/Linux">
        ```bash
        curl -fsSL https://openclaw.ai/install.sh | bash
        ```
      </Tab>
      <Tab title="Windows (PowerShell)">
        ```powershell
        iwr -useb https://openclaw.ai/install.ps1 | iex
        ```
      </Tab>
    </Tabs>

    <Note>
    Outros métodos de instalação e requisitos: [Instalação](/install).
    </Note>

  </Step>
  <Step title="Execute o wizard de onboarding">
    ```bash
    openclaw onboard --install-daemon
    ```

    O wizard configura autenticação, configurações do gateway e canais opcionais.
    Veja [Wizard de Onboarding](/start/wizard) para detalhes.

  </Step>
  <Step title="Verifique o Gateway">
    Se você instalou o serviço, ele já deve estar rodando:

    ```bash
    openclaw gateway status
    ```

  </Step>
  <Step title="Abra a Control UI">
    ```bash
    openclaw dashboard
    ```
  </Step>
</Steps>

<Check>
Se a Control UI carregar, seu Gateway está pronto para uso.
</Check>

## Verificações opcionais e extras

<AccordionGroup>
  <Accordion title="Execute o Gateway em primeiro plano">
    Útil para testes rápidos ou resolução de problemas.

    ```bash
    openclaw gateway --port 18789
    ```

  </Accordion>
  <Accordion title="Envie uma mensagem de teste">
    Requer um canal configurado.

    ```bash
    openclaw message send --target +15555550123 --message "Olá do OpenClaw"
    ```

  </Accordion>
</AccordionGroup>

## Variáveis de ambiente úteis

Se você executa o OpenClaw como conta de serviço ou quer caminhos personalizados para configuração/estado:

- `OPENCLAW_HOME` define o diretório home usado para resolução de caminhos internos.
- `OPENCLAW_STATE_DIR` sobrescreve o diretório de estado.
- `OPENCLAW_CONFIG_PATH` sobrescreve o caminho do arquivo de configuração.

Referência completa de variáveis de ambiente: [Variáveis de ambiente](/help/environment).

## Aprofunde-se

<Columns>
  <Card title="Wizard de Onboarding (detalhes)" href="/start/wizard">
    Referência completa do wizard CLI e opções avançadas.
  </Card>
  <Card title="Onboarding do app macOS" href="/start/onboarding">
    Fluxo de primeira execução do app macOS.
  </Card>
</Columns>

## O que você terá

- Um Gateway rodando
- Autenticação configurada
- Acesso à Control UI ou um canal conectado

## Próximos passos

- Segurança de DMs e aprovações: [Pareamento](/channels/pairing)
- Conectar mais canais: [Canais](/channels)
- Fluxos avançados e a partir do código-fonte: [Configuração](/start/setup)
