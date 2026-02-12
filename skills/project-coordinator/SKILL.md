---
name: project-coordinator
description: "Initialize and manage multi-agent projects with RACI-based team coordination. Auto-generates REGISTRY, RESPONSIBILITIES, and handles agent spawning. Also defines how the main orchestrator (agent: main) should coordinate work in 'big tech' mode."
metadata: { "openclaw": { "emoji": "📋", "always": false, "skillKey": "project" } }
user-invocable: true
---

# Project Coordinator — Multi-Agent Team Management & Orchestrator Operating Model

Framework for coordinating projects across multiple specialized agents using RACI matrices and automatic delegation.
Also defines the **operating model of the main orchestrator (`main`/Marcelo)** when acting as tech lead of the 60-agent team.

---

## 0. Papel do Orquestrador Principal (`main`)

O orquestrador principal **não implementa código**. Ele:

1. **Entende** o pedido (contexto, objetivo, restrições).
2. **Classifica** a tarefa (natureza + complexidade).
3. **Escolhe o skill macro** adequado (`/design`, `/implement`, `/workflow`, etc.).
4. **Decompõe** em até 5 sub-tarefas bem definidas, por domínio.
5. **Delega** para os agentes certos (via `team-coordinator`, `sessions_spawn_batch` ou `delegation`).
6. **Aplica gates de qualidade** (QA, segurança, review) conforme o tipo de tarefa.
7. **Sintetiza** o resultado para o Julio, com decisões, trade-offs e próximos passos.

### 0.1 Quando responder direto vs delegar

O orquestrador pode responder **direto** apenas quando:

- A pergunta é conceitual/simples (ex.: explicar um fluxo, comparar abordagens em alto nível),
- Não há necessidade de gerar artefatos persistentes (código, configuração, docs, SKILLs).

Sempre que o pedido envolver **fazer** algo (implementar, alterar SKILL, desenhar fluxo real, definir processo, etc.), o orquestrador deve seguir o pipeline acima e **delegar**.

---

## 1. Features do Project Coordinator

✅ **Project initialization** from YAML templates  
✅ **RACI matrix** auto-generation  
✅ **Agent registry** per project  
✅ **Automatic spawning** with task delegation  
✅ **Progress tracking** against success criteria  
✅ **Escalation routing** based on risk levels  
✅ **Standup scheduling** (daily/weekly)

Em projetos maiores, o orquestrador `main` deve usar este skill como "modo projeto":

- Iniciar projeto,
- Gerar REGISTRY/RESPONSIBILITIES,
- Amarrar RACI às decisões de delegação do `team-coordinator`.

---

## 2. Uso (CLI / Automação de Projeto)

### Initialize a Project from Template

```bash
openclaw project init my-project \
  --template /path/to/template.yaml \
  --output ./my-project/
```

This generates:

- `REGISTRY.md` — Agent profiles & team structure
- `RESPONSIBILITIES.md` — RACI matrix & escalation rules
- `ACTION_PLAN.md` — Day-by-day task breakdown (if applicable)

### Spawn All Team Members

```bash
# Spawn all agents with project briefing
openclaw project spawn my-project \
  --action briefing \
  --model sonnet
```

### Run Daily Standup

```bash
# Generate standup from project config
openclaw project standup my-project \
  --date 2026-02-06 \
  --format slack
```

### View Project Status

```bash
# Overall dashboard
openclaw project status my-project

# Detailed metrics
openclaw project metrics my-project \
  --format json
```

---

## 3. Project Template Format (YAML)

See `projects/README.md` for complete schema. Example structure:

```yaml
# Identification
name: my-project # Machine-readable ID
displayName: "My Project Name" # Human-readable
description: "What we're building"

# Timeline
timeline:
  startDate: "2026-02-06"
  endDate: "2026-02-12"
  duration: "1 week"
  timezone: "America/Vancouver"

# Goal
goal: "High-level objective for this project"

# Team
team:
  lead: coordinator-agent-id
  members:
    - id: agent-name
      role: "Agent Role"
      responsibility: "What they own"
      hoursPerWeek: 40

# RACI Matrix
raci:
  - task: "Something"
    responsible: agent-name
    accountable: agent-name
    consulted: [agent1, agent2]
    informed: [agent3]
    priority: HIGH
    dueDate: "2026-02-12T18:00:00Z"

# Success Metrics
successCriteria:
  - id: "metric-id"
    title: "Metric Name"
    goal: "Target value"
    current: "Current value"
    owner: agent-name

# Schedule
schedule:
  standup:
    time: "09:00"
    format: "slack"
    daysOfWeek: [Monday, Tuesday, Wednesday, Thursday, Friday]
  review:
    time: "17:00"
    daysOfWeek: [Friday]

# Escalation Rules
escalation:
  low_risk:
    definition: "Task impact < 2 hours"
    process: "Owner decides independently"
  medium_risk:
    definition: "Task impact 2-48 hours"
    process: "Owner proposes, accountable reviews"
  high_risk:
    definition: "Task impact > 48 hours or strategic"
    process: "Owner proposes, accountable + lead approve"
  blocker:
    definition: "Blocks other team members"
    process: "Escalate immediately to lead"

# Deliverables
deliverables:
  - name: "Deliverable 1"
    description: "What it is"
    owner: agent-name
    dueDate: "2026-02-12T18:00:00Z"
```

---

## 4. Orquestrador `main` em "Modo Big Tech"

### 4.1 Pipeline Operacional

Quando o Julio faz um pedido:

1. **ENTENDER**
   - Resumir internamente o pedido e o objetivo.

2. **CLASSIFICAR** (em conjunto com `team-coordinator`)
   - Natureza da tarefa (estratégico, arquitetural, técnico, produto, marketing, UX, QA, processo, pesquisa, incidente).
   - Complexidade (simples, média, complexa).

3. **ESCOLHER SKILL MACRO**
   - Design de solução → `/design`
   - Implementação ponta a ponta → `/implement`
   - Processo/time → `/workflow`
   - Pesquisa/investigação → `/research`
   - Bug/incidente → `/troubleshoot`
   - Segurança → `/security`
   - Testes → `/test`
   - Validação final → `/validate`

4. **DECOMPOR EM SUB-TAREFAS (max 5)**
   - Cada sub-tarefa deve ter:
     - 1 domínio claro,
     - 1 agente responsável,
     - Critérios de saída (como saber que acabou).

5. **DELEGAR**
   - Usar `team-coordinator` + `sessions_spawn_batch` ou `delegation`.
   - Paralelizar tudo que não tem dependência direta.

6. **GATES DE QUALIDADE**
   - Para tarefas **médias/complexas** de código/processo:
     - Acionar `/test` + `/validate`.
     - Incluir QA (`qa-lead`, `quality-engineer`, `qa-automation`) e, quando relevante, segurança (`security-engineer`, `ciso`).

7. **SÍNTESE PARA O JULIO**
   - Explicar: o que foi feito, decisões tomadas, trade-offs e próximos passos.

### 4.2 Escolha de Skill de Coordenação

Quando houver dúvida sobre qual skill de coordenação usar:

- **Feature complexa / refatoração grande** → `/implement` (usa `team-coordinator` por baixo).
- **Ajuste de processo, sprints, DORA, papéis** → `/workflow`.
- **Decisão arquitetural polêmica ou de alto impacto** → `collaboration.session.init` (via `team-coordinator` ou `/design`).
- **Delegação pontual e rastreada (com prioridade)** → `delegation` (downward/upward).
- **Delegação rápida fire-and-forget** → `sessions_spawn`/`sessions_spawn_batch` direto.

---

## 5. Generated REGISTRY.md

Auto-generated agent registry for your project:

```markdown
# Project Registry: My Project

## Quick Reference

| Agent      | Role       | Status    | Responsibility |
| ---------- | ---------- | --------- | -------------- |
| agent-name | Role Title | 🟢 Online | What they do   |
| ...        | ...        | ...       | ...            |

## Detailed Profiles

### agent-name — Role Title

**Status:** 🟢 Online  
**Role:** Agent Role  
**Responsibility:** What they own  
**Tasks:**

- [ ] Task 1
- [ ] Task 2
      **Accountability:** What they're responsible for  
       **Works With:** [other agents]  
       **Response Time:** < X hours
```

---

## 6. Generated RESPONSIBILITIES.md (RACI)

Auto-generated RACI matrix:

```markdown
# RESPONSIBILITIES.md — RACI Matrix

## RACI Legend

- **R** = Responsible (does work)
- **A** = Accountable (signs off, single per task)
- **C** = Consulted (provides input)
- **I** = Informed (notified after)

## Matrix

| Task   | Responsible | Accountable | Consulted | Informed |
| ------ | ----------- | ----------- | --------- | -------- |
| Task 1 | agent1      | agent1      | agent2    | agent3   |
| Task 2 | agent2      | agent2      | agent1    | agent3   |

## Escalation Rules

**Low Risk:** Owner decides autonomously  
**Medium Risk:** Owner proposes, accountable reviews  
**High Risk:** Owner proposes, accountable + lead approve  
**Blocker:** Escalate immediately to lead
```

---

## 7. RACI Best Practices

### Every Task Needs:

✅ **Exactly 1 Accountable** — Single decision-maker  
✅ **Responsible identified** — Someone does the work  
✅ **Consulted specified** — Who provides input  
✅ **Informed listed** — Who gets notified

### Avoid:

❌ Multiple Accountables per task  
❌ "Everyone" for Consulted/Informed  
❌ Unclear Responsible role  
❌ Missing escalation paths

### Examples

**Good RACI:**

```
Task: "Implement feature X"
- Responsible: backend-architect (does the coding)
- Accountable: backend-architect (signs off)
- Consulted: qa-lead (validates approach)
- Informed: frontend-architect (needs to integrate)
```

**Bad RACI:**

```
Task: "Implement feature X"
- Responsible: "everyone"  ← UNCLEAR
- Accountable: "team"  ← MULTIPLE, NOT SINGLE
- Consulted: "everyone"  ← TOO MANY
- Informed: [not specified]  ← MISSING
```

---

## 8. Escalation Rules

Define how decisions get made based on impact:

```yaml
escalation:
  low_risk:
    definition: "< 2 hours impact, single owner"
    process: "Owner decides independently, notify same day"
    examples:
      - "Writing test for specific function"
      - "Fixing linting violation"
      - "Updating documentation"

  medium_risk:
    definition: "2-48 hours impact, multiple teams"
    process: "Owner proposes, accountable reviews (< 2 hour turnaround)"
    examples:
      - "New testing approach"
      - "Configuration changes"
      - "Module refactoring"

  high_risk:
    definition: "> 48 hours impact or strategic"
    process: "Owner proposes, accountable + lead approve (synchronous)"
    examples:
      - "Infrastructure changes"
      - "Architecture redesign"
      - "Tool/framework change"

  blocker:
    definition: "Prevents other team members from working"
    process: "Escalate immediately to lead (15-min resolution target)"
    examples:
      - "Build system broken"
      - "Critical dependency missing"
      - "Production issue"
```

---

## 9. Daily Standup Format

Template for async daily updates:

```
📅 DATE: [date] | DAY: [n/N]

✅ YESTERDAY
- [what I completed]
- [deliverables shipped]

🏗️ TODAY
- [what I'm working on]
- [task focus]

🔴 BLOCKERS
- [any issues]
- [asks for help]

📊 METRICS
- [progress vs targets]
```

Deliver via Slack/Telegram/Discord to keep async transparency.

---

## 10. Success Criteria Template

Every project should have measurable goals:

```yaml
successCriteria:
  - id: "metric-1"
    title: "Unit Test Coverage"
    goal: "80%"
    current: "65%"
    metric: "Percentage"
    owner: backend-lead

  - id: "metric-2"
    title: "Component Tests"
    goal: "100+"
    current: "10"
    metric: "Count"
    owner: frontend-lead

  - id: "metric-3"
    title: "Issues Resolved"
    goal: "30"
    current: "0"
    metric: "Count"
    owner: qa-lead
```

---

## 11. Project Lifecycle

### Phase 1: Planning (Day -1)

1. Create YAML template
2. Define team & RACI
3. Set success criteria
4. Schedule standups

### Phase 2: Execution (Day 1-N)

1. Kick off meeting
2. Daily standups
3. Escalate blockers
4. Track progress

### Phase 3: Closure (Final day)

1. Review meeting
2. Consolidate metrics
3. Generate final report
4. Document lessons learned

---

## 12. Integration Points

- **team-coordinator** — Hierarchical agent delegation (natureza/complexidade/domínio)
- **sessions_spawn / sessions_spawn_batch** — Spawn agents with tasks
- **delegation** — Delegação rastreada com prioridade/status
- **message tool** — Send status updates (Slack, Telegram, Discord)
- **cron** — Schedule standups & reviews
- **REGISTRY.md** — Agent discovery per project
- **RESPONSIBILITIES.md** — RACI enforcement

---

## 13. See Also

- **projects/README.md** — Framework overview & best practices
- **team-coordinator** — Hierarchical agent delegation
- **delegate** — Simple task delegation
- **workflow** — Process & team workflows
- **session-logs** — Track agent activity
