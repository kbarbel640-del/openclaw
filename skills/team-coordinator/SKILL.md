---
name: team-coordinator
description: "Coordinate specialized sub-agents following a hierarchical team structure. Delegates tasks to the right specialist based on domain, nature, and complexity."
metadata: { "openclaw": { "emoji": "👥", "always": true, "skillKey": "team" } }
user-invocable: true
---

# Team Coordinator — Hierarchical Agent Delegation (Big Tech Mode)

Use `sessions_spawn` / `sessions_spawn_batch` to delegar tarefas para sub-agentes especializados.
Este skill é a **tabela verdade de roteamento**: quem cuida de quê, em que ordem e com quais gates de qualidade.

---

## 1. Classificação Obrigatória da Tarefa

Antes de delegar, **sempre** classifique a tarefa em:

### 1.1 Natureza da Tarefa

- **Estratégica** — direção, prioridades, ROI, roadmap macro
- **Arquitetural** — design de sistema, tech choice, padrões
- **Técnica (implementação)** — backend, frontend, dados, infra, auth, etc.
- **Produto** — escopo de feature, user stories, priorização
- **Marketing / Comunicação** — campanhas, lançamentos, conteúdo público
- **UX / UI** — experiência, fluxos, wireframes, design visual
- **Qualidade / Segurança** — testes, QA, auditoria, segurança
- **Processo / Time** — workflow, sprints, DORA, papéis
- **Pesquisa / Investigação** — comparação de tecnologias, benchmarks, discovery
- **Incidente / Bug Crítico** — outage, regressão grave, incidente de segurança

### 1.2 Complexidade

- **Simples** — até 1–2 arquivos/artefatos, impacto baixo, 1 domínio
- **Média** — 3–5 arquivos/artefatos, pode envolver 2–3 domínios (ex: backend + frontend + QA)
- **Complexa** — multi-domínio, 6+ artefatos, risco relevante, pode gerar ADR

A combinação **natureza + complexidade** define quem entra e quais skills macro usar.

---

## 2. Hierarquia de Agentes por Domínio

### 2.1 C-Level (Decisões Estratégicas) — Model: opus

| Agent  | Domínio    | Use Para                                                  |
| ------ | ---------- | --------------------------------------------------------- |
| `ceo`  | Estratégia | Direção de produto, ROI, alinhamento com stakeholders     |
| `cto`  | Técnica    | Decisões arquiteturais major, seleção de tecnologia, ADRs |
| `cpo`  | Produto    | Estratégia de produto, roadmap, priorização (RICE)        |
| `ciso` | Segurança  | Estratégia de segurança, threat modeling, compliance      |
| `cmo`  | Marketing  | Branding, posicionamento, campanhas, go-to-market         |

### 2.2 VP / Diretores — Model: opus/sonnet

| Agent                 | Model  | Domínio     | Use Para                                                       |
| --------------------- | ------ | ----------- | -------------------------------------------------------------- |
| `vp-engineering`      | opus   | Gestão Eng. | Escala de time, DORA, processo, qualidade sistêmica            |
| `backend-architect`   | opus   | Backend     | Design de APIs, arquitetura server-side, middleware, WebSocket |
| `frontend-architect`  | sonnet | Frontend    | Astro, React Islands, hidratação, responsividade               |
| `software-architect`  | opus   | Arquitetura | Patterns, SOLID, clean architecture, DDD                       |
| `system-architect`    | opus   | Sistemas    | Distribuídos, escalabilidade, boundaries                       |
| `solutions-architect` | sonnet | Integração  | Soluções end-to-end, integrações externas                      |
| `security-engineer`   | opus   | Segurança   | OWASP, STRIDE, vulnerabilidades, auditorias                    |
| `engineering-manager` | sonnet | Gestão Eng. | Saúde do time, 1:1, alocação, bloqueios                        |

### 2.3 Leads (Liderança Técnica) — Model: sonnet

| Agent               | Domínio  | Use Para                                             |
| ------------------- | -------- | ---------------------------------------------------- |
| `ai-engineer`       | AI/ML    | Agno, Ollama, RAG, pipelines de LLM                  |
| `auth-specialist`   | Auth     | Better-Auth, OAuth2, 2FA/MFA, sessões                |
| `database-engineer` | Database | PostgreSQL, TimescaleDB, Redis, Drizzle, migrations  |
| `devops-engineer`   | DevOps   | Docker, CI/CD, monitoring, deployment                |
| `product-manager`   | Produto  | Escopo de feature, roadmap, sprint planning          |
| `product-owner`     | Produto  | Backlog, user stories, critérios de aceitação        |
| `qa-lead`           | Testes   | Estratégia de testes, processo de qualidade, release |
| `tech-lead`         | Técnico  | Mentoria, padrões, tech debt                         |
| `trading-engine`    | Trading  | Ordem, exchanges, P&L                                |
| `release-manager`   | Releases | Planejamento, changelog, versões                     |

### 2.4 Especialistas Sênior (Implementação) — Model: sonnet/haiku

| Agent                    | Model  | Domínio     | Use Para                                              |
| ------------------------ | ------ | ----------- | ----------------------------------------------------- |
| `astro-specialist`       | sonnet | Frontend    | Astro 4+, islands, SSR/SSG, content collections       |
| `better-auth-specialist` | sonnet | Auth        | 2FA, API keys, admin plugin, session management       |
| `data-engineer`          | sonnet | Data        | Pipelines ETL, modelagem, stream processing           |
| `data-scientist`         | sonnet | Data        | Modelagem estatística, ML, feature engineering        |
| `drizzle-specialist`     | sonnet | Database    | Queries type-safe, migrations, transações             |
| `elysia-specialist`      | sonnet | Backend     | Plugins, guards, validação, Eden Treaty               |
| `ml-engineer`            | sonnet | AI/ML       | Deploy de modelo, treinamento, MLOps                  |
| `performance-engineer`   | sonnet | Performance | Profiling, otimização, caching, tuning de queries     |
| `python-specialist`      | sonnet | Python      | Backtesting, análise de dados, pandas/NumPy           |
| `qa-automation`          | sonnet | Testes      | Automação, Playwright, integração CI                  |
| `quality-engineer`       | sonnet | Testes      | Validação QA, coverage, métricas                      |
| `sre`                    | sonnet | SRE/DevOps  | Uptime, SLOs, incidentes, observabilidade             |
| `testing-specialist`     | sonnet | Testes      | Unit/integration/E2E, edge cases                      |
| `agno-specialist`        | haiku  | AI          | Orquestração multi-agente, tools Agno                 |
| `bun-specialist`         | haiku  | Backend     | Bun runtime, bundling, package management             |
| `charts-specialist`      | haiku  | UI          | Gráficos (Lightweight, ECharts), indicadores técnicos |
| `ui-components`          | haiku  | UI          | shadcn/ui, Aceternity, Tailwind, WCAG 2.1 AA          |
| `zod-specialist`         | haiku  | Validação   | Zod schemas, type inference, forms                    |

### 2.5 Especialistas de Domínio (Produto, UX, Marketing)

| Agent                  | Model  | Domínio    | Use Para                                             |
| ---------------------- | ------ | ---------- | ---------------------------------------------------- |
| `data-analyst`         | haiku  | Data       | Métricas, KPIs, dashboards, análises                 |
| `requirements-analyst` | sonnet | Produto    | User stories, critérios de aceitação, priorização    |
| `ui-designer`          | sonnet | Design     | Design visual, design system, consistência de marca  |
| `ux-designer`          | sonnet | UX         | User flows, wireframes, interação                    |
| `ux-researcher`        | haiku  | UX         | Usability tests, analytics, comportamento de usuário |
| `brand-strategist`     | sonnet | Branding   | Posicionamento, narrativa de marca                   |
| `content-strategist`   | sonnet | Conteúdo   | Estratégia de conteúdo, pillars, calendário          |
| `copywriter`           | sonnet | Texto      | Copy para site, produto, campanhas                   |
| `social-media-manager` | sonnet | Social     | Estratégia e posts em redes sociais                  |
| `community-manager`    | sonnet | Comunidade | Comunicação com comunidade, changelogs, devrel       |
| `pr-manager`           | sonnet | PR         | Comunicação externa, notas à imprensa, incidentes    |

### 2.6 Suporte (Investigação & Processo)

| Agent                  | Model  | Domínio   | Use Para                                    |
| ---------------------- | ------ | --------- | ------------------------------------------- |
| `deep-research`        | opus   | Research  | Tech evaluation, competitive research       |
| `root-cause-analyst`   | opus   | Debugging | 5 Whys, timeline, issues sistêmicos         |
| `refactoring-expert`   | sonnet | Código    | Code smells, refactorings, tech debt        |
| `technical-writer`     | sonnet | Docs      | API docs, guias de uso, ADRs, playbooks     |
| `git-specialist`       | haiku  | Git       | Branching, conflitos, histórico             |
| `scrum-master`         | haiku  | Processo  | Sprints, impedimentos, cadência             |
| `backtrade-specialist` | opus   | Trading   | Validação de estratégia, Monte Carlo, risco |

---

## 3. Skills Macro (Design/Implement/Workflow/etc.)

Use a natureza da tarefa para escolher o **skill macro** apropriado:

- **Design de solução** → `/design`
- **Implementação ponta a ponta** → `/implement`
- **Ajuste de processo/time** → `/workflow`
- **Pesquisa/estudo/prova de conceito** → `/research`
- **Debug/bug/raiz do problema** → `/troubleshoot`
- **Segurança/auditoria** → `/security`
- **Criação/ajuste de testes** → `/test`
- **Validação final/gates de saída** → `/validate`

O `team-coordinator` deve encaminhar a tarefa para o skill macro correto **antes** de quebrar em sub-tarefas.

---

## 4. Árvores de Decisão por Natureza

### 4.1 Estratégico

- **Se** a decisão afeta roadmap, prioridades, investimento ou marca:
  - Convidar: `ceo`, `cto`, `cpo`, `cmo`, `ciso` (conforme o tema)
  - Usar `/design` + `collaboration.session.init` para debate
  - Produzir decisão final (ADR/resumo) via `technical-writer`

### 4.2 Arquitetural

- **Se** a decisão afeta arquitetura de sistema, componentes principais ou tech stack:
  - Convidar: `software-architect`, `system-architect`, `backend-architect`, `frontend-architect`, `security-engineer`, `devops-engineer`
  - Usar `/design` + `collaboration.session.init` (mínimo 3 rodadas) com moderador (geralmente `system-architect` ou `cto`)
  - Registrar decisão em ADR + `team_workspace`

### 4.3 Técnica (Implementação)

- Backend, APIs, jobs, integrações → `backend-architect`, `elysia-specialist`, `bun-specialist`, `drizzle-specialist`, etc.
- Frontend/UI → `frontend-architect`, `astro-specialist`, `ui-components`, `charts-specialist`.
- Data/ML → `data-engineer`, `data-scientist`, `ml-engineer`, `ai-engineer`.
- Infra/DevOps → `devops-engineer`, `sre`.

Sempre orquestrar via `/implement` para features/refactors, respeitando gates de qualidade (ver seção 6).

### 4.4 Produto

- Envolver: `product-manager`, `product-owner`, `requirements-analyst`.
- Skills macro típicos: `/design` (escopo/valor) + `/workflow` (roadmap/sprints).

### 4.5 Marketing / Comunicação

- Estratégia: `cmo`, `brand-strategist`.
- Conteúdo: `content-strategist`, `copywriter`, `technical-writer`.
- Canais: `social-media-manager`, `community-manager`, `pr-manager`.
- Skills macro: `/design` (narrativa/campanha) + `/workflow` (plano de execução).

### 4.6 UX / UI

- `ux-designer`, `ui-designer`, `ux-researcher`.
- Usar `/design` para flows/wireframes, e depois `/implement` para UI final.

### 4.7 Qualidade / Segurança

- QA: `qa-lead`, `qa-automation`, `quality-engineer`, `testing-specialist`.
- Segurança: `security-engineer`, `ciso`.
- Skills macro: `/test`, `/validate`, `/security`.

### 4.8 Processo / Time

- `vp-engineering`, `engineering-manager`, `scrum-master`, `release-manager`.
- Skill macro: `/workflow`.

### 4.9 Pesquisa / Investigação

- `deep-research`, `root-cause-analyst`.
- Skills macro: `/research` (estudo) ou `/troubleshoot` (bug/incidente).

### 4.10 Incidente / Bug Crítico

- `sre`, `devops-engineer`, `root-cause-analyst`, `security-engineer` (se segurança).
- Skills macro: `/troubleshoot` + `/implement` + `/test` + `/validate` (+ `/security` quando necessário).

---

## 5. Complexidade e Paralelismo

- **Simples** (1–2 artefatos, 1 domínio):
  - 1 especialista
  - Pode usar `sessions_spawn` direto.

- **Média** (3–5 artefatos, 2–3 domínios):
  - 2–3 especialistas (ex: backend + frontend + QA)
  - Usar `sessions_spawn_batch` com **até 3 subtarefas** paralelas.

- **Complexa** (multi-domínio, risco alto):
  - Orquestrar via `/implement` + `project-coordinator` se virar projeto.
  - Quebrar em blocos de até 5 subtarefas por rodada (fan-out/fan-in).

---

## 6. Gates de Qualidade (Modelo QA)

O `team-coordinator` deve garantir que tarefas médias/complexas respeitem os gates definidos pelo `qa-lead`:

### 6.1 Feature Complexa de Produto

- Skills obrigatórios:
  - `/implement` → orquestra
  - `/test` → define/gera testes (unit/integration/E2E conforme o caso)
  - `/validate` → validação final
- Agentes obrigatórios:
  - Dev: especialistas de domínio
  - QA: `qa-automation`, `testing-specialist`, `quality-engineer`, `qa-lead`
  - Segurança: `security-engineer` se houver auth/dados sensíveis
- Critérios de "pronto":
  - Build passa
  - Testes passam com cobertura mínima definida
  - Sem erros/warnings críticos de lint
  - Principais riscos de segurança mitigados

### 6.2 Bug Crítico em Produção

- Skills:
  - `/troubleshoot` → root cause
  - `/implement` → fix
  - `/test` + `/validate` → evitar regressão
- Agentes:
  - `root-cause-analyst`, `sre`, `devops-engineer`, especialista de domínio, QA
- Se envolver segurança: adicionar `/security` + `ciso`.

### 6.3 Incidente de Segurança

- Skills: `/security`, `/troubleshoot`, `/validate`.
- Agentes: `security-engineer`, `ciso`, `sre`, `devops-engineer`, especialistas e QA.
- Saídas: fix técnico, plano de mitigação/comunicação, ajustes de processo via `/workflow`.

### 6.4 Refatoração de Componentes Centrais

- Skills: `/design` (novo desenho), `/implement`, `/test`, `/validate`.
- Agentes: `refactoring-expert`, leads de domínio, QA.

### 6.5 Mudanças de Infra/Deploy

- Skills: `/design` (plano), `/implement`, `/test` (smoke/E2E básicos), `/validate`.
- Agentes: `devops-engineer`, `sre`, `release-manager`, QA.

---

## 7. Padrões de Delegação (sessions_spawn)

### 7.1 Exemplos Técnicos

```typescript
// Design de API de auth
sessions_spawn({
  task: "Desenhar a REST API para autenticação com JWT + refresh tokens",
  agentId: "backend-architect",
  label: "API Auth Design",
});

// Cobertura de testes para módulo de auth
sessions_spawn({
  task: "Criar testes abrangentes para o módulo de auth com foco em fluxos felizes + edge cases",
  agentId: "testing-specialist",
  label: "Auth Tests",
});

// Paralelizar backend + frontend + QA
sessions_spawn_batch({
  tasks: [
    { task: "Design schema de pedidos", agentId: "database-engineer", label: "DB Orders" },
    { task: "Criar endpoints de pedidos", agentId: "elysia-specialist", label: "API Orders" },
    {
      task: "Definir cenários de teste para pedidos",
      agentId: "qa-automation",
      label: "Tests Orders",
    },
  ],
  waitMode: "none",
});
```

### 7.2 Exemplos Produto / Marketing

```typescript
// Escopo de feature
sessions_spawn({
  task: "Definir user stories e critérios de aceitação para a feature X",
  agentId: "product-manager",
  label: "Feature X Scope",
});

// Plano de lançamento / comunicação
sessions_spawn_batch({
  tasks: [
    {
      task: "Definir narrativa de branding para o lançamento da feature X",
      agentId: "brand-strategist",
      label: "Feature X Branding",
    },
    {
      task: "Criar plano de posts em redes sociais para a feature X",
      agentId: "social-media-manager",
      label: "Feature X Social",
    },
    {
      task: "Planejar anúncio para comunidade e changelog",
      agentId: "community-manager",
      label: "Feature X Community",
    },
  ],
  waitMode: "none",
});
```

---

## 8. Regras Gerais (Big Tech Mode)

1. **Combine natureza + complexidade** antes de qualquer delegação.
2. **Use skills macro** (`/design`, `/implement`, `/workflow`, etc.) como primeira parada; `team-coordinator` não implementa, só roteia.
3. **Match domain to specialist** — nunca mande frontend para `backend-architect`, nem marketing para `software-architect`.
4. **Use o nível de modelo adequado** — opus para decisões grandes, sonnet para engenharia, haiku para tarefas simples.
5. **Paralelize o que é independente** usando `sessions_spawn_batch` (limite saudável de 3–5 subtarefas por rodada).
6. **Respeite os gates de qualidade** — qualquer tarefa média/complexa deve passar por `/test` + `/validate` e, quando necessário, `/security`.
7. **Use debates (`collaboration.session.init`) para decisões arquiteturais/estratégicas relevantes**, com mínimo de 3 rodadas e moderador claro.
8. **Registre decisões importantes** em ADRs e/ou `team_workspace` para criar memória institucional.
9. **Nunca implemente diretamente neste skill** — ele existe para coordenar o time, não para fazer o trabalho.
