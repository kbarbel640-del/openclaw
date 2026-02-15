# Health Monitor Agent - Plano de Implementação

## 📋 Resumo Executivo

Criar um **System Health Monitor** (agent ID: `health-monitor`) que:

1. **Monitora** continuamente segurança, qualidade, testes, dependências e infraestrutura
2. **Detecta** problemas automaticamente através de scans periódicos
3. **Prioriza** issues (critical/high/medium/low) com base em impacto
4. **Coordena** correções delegando para especialistas ou iniciando debates
5. **Reporta** métricas e status de saúde do sistema

## 🎯 Objetivos

- ✅ **Detecção proativa** de problemas antes que afetem produção
- ✅ **Resposta rápida** (< 4h para critical, < 24h para high)
- ✅ **Qualidade consistente** (manter coverage > 70%, zero vulns critical)
- ✅ **Visibilidade total** de saúde do sistema
- ✅ **Automação máxima** (mínima intervenção humana)

---

## 📦 Artefatos Criados

### ✅ Documentação

- [x] `docs/agents/system-health-monitor.md` - Especificação completa
- [x] `.agent/workflows/health-monitor.md` - Workflow operacional
- [x] `docs/agents/IMPLEMENTATION_PLAN.md` - Este arquivo

### ✅ Scripts

- [x] `scripts/health-check.ts` - Script executável de health check

### ⏳ Próximos Passos (A Implementar)

- [ ] Configuração do agente em `agents/`
- [ ] Integração com `HEARTBEAT.md`
- [ ] Configuração de cron jobs
- [ ] Dashboard de métricas (opcional)

---

## 🗓️ Fases de Implementação

### **Fase 1: Foundation (Semana 1)** ✅

**Objetivo:** Criar base estrutural e documentação

**Tarefas Completadas:**

- ✅ Especificar arquitetura do Health Monitor
- ✅ Documentar workflows e processos
- ✅ Criar script base de health check
- ✅ Definir matriz de escalação
- ✅ Documentar templates de resposta

**Entregáveis:**

- ✅ Documentação completa
- ✅ Script funcional de health check
- ✅ Plano de implementação

---

### **Fase 2: Core Implementation (Semana 2)** 🔄

**Objetivo:** Implementar funcionalidade core do agente

**Tarefas:**

1. **Criar Agent Profile**

   ```bash
   # Criar agents/health-monitor.json
   {
     "id": "health-monitor",
     "name": "System Health Monitor",
     "role": "lead",
     "emoji": "🏥",
     "expertise": ["monitoring", "security", "quality"],
     "reports_to": "cto",
     "manages": ["security-engineer", "qa-lead", "performance-engineer"]
   }
   ```

2. **Integrar Security APIs**
   - [ ] Conectar `security_audit`, `security_stats`, `security_alerts`
   - [ ] Implementar detecção de vulnerabilities críticas
   - [ ] Criar fluxo de escalação para CISO

3. **Integrar Quality Checks**
   - [ ] Executar `pnpm check` automaticamente
   - [ ] Monitorar cobertura de testes
   - [ ] Detectar degradação de qualidade

4. **Configurar Heartbeat**

   ```markdown
   # HEARTBEAT.md

   Health Monitor - Scan every 30min:

   1. security_stats (check alerts)
   2. Gateway status
   3. Quick quality check

   If issues: escalate/delegate
   If clear: HEARTBEAT_OK
   ```

5. **Criar Cron Jobs**
   ```json
   {
     "name": "health-monitor-scan",
     "schedule": { "kind": "every", "everyMs": 1800000 },
     "payload": {
       "kind": "agentTurn",
       "message": "Run automated health scan",
       "model": "anthropic/claude-sonnet-4-5"
     },
     "sessionTarget": "isolated"
   }
   ```

**Deliverables:**

- [ ] Agent configurado e funcional
- [ ] Scans automáticos rodando
- [ ] Integração com security/quality APIs

**Testes:**

- [ ] Executar scan manual: `bun scripts/health-check.ts`
- [ ] Verificar heartbeat responde corretamente
- [ ] Simular issue crítico e verificar escalação

---

### **Fase 3: Team Integration (Semana 3)**

**Objetivo:** Integrar com sistema de colaboração multi-agente

**Tarefas:**

1. **Implementar Escalation Logic**

   ```typescript
   async function escalateIssue(issue: CriticalIssue) {
     // Start collaboration debate
     const session = await collaboration({
       action: "session.init",
       topic: `Critical: ${issue.description}`,
       agents: getRelevantAgents(issue.category),
       moderator: "cto",
     });

     // Publish proposal
     await collaboration({
       action: "proposal.publish",
       sessionKey: session.sessionKey,
       decisionTopic: issue.category,
       proposal: issue.recommendedAction,
       reasoning: issue.analysis,
     });
   }
   ```

2. **Implementar Delegation Logic**

   ```typescript
   async function delegateIssue(issue: HighPriorityIssue) {
     const specialist = ESCALATION_MAP[issue.category].high.agents[0];

     await sessions_spawn({
       task: formatTaskDescription(issue),
       agentId: specialist,
       label: `Fix: ${issue.category}`,
       runTimeoutSeconds: 3600, // 1 hour
     });
   }
   ```

3. **Implementar Workspace Logging**

   ```typescript
   async function logIssue(issue: MediumLowIssue) {
     await team_workspace({
       action: "write_artifact",
       name: `health-issue-${Date.now()}.md`,
       content: formatIssueReport(issue),
       description: `Health monitoring issue - ${issue.severity}`,
       tags: ["health", "monitoring", issue.category],
     });
   }
   ```

4. **Criar Templates de Comunicação**
   - [ ] Template para critical issues
   - [ ] Template para high priority
   - [ ] Template para relatórios diários

**Deliverables:**

- [ ] Escalação automática funcionando
- [ ] Delegação para especialistas ativa
- [ ] Logs salvos em workspace

**Testes:**

- [ ] Simular vulnerabilidade crítica → verificar debate iniciado
- [ ] Simular queda de coverage → verificar delegação para QA
- [ ] Verificar logs salvos corretamente

---

### **Fase 4: Advanced Features (Semana 4)**

**Objetivo:** Adicionar features avançadas e otimizações

**Tarefas:**

1. **Performance Monitoring**

   ```typescript
   async function monitorPerformance() {
     const gatewayStart = Date.now();
     await exec("pnpm openclaw status");
     const responseTime = Date.now() - gatewayStart;

     if (responseTime > THRESHOLDS.responseTime.critical) {
       escalatePerformanceIssue(responseTime);
     }
   }
   ```

2. **Dependency Tracking**

   ```typescript
   async function trackDependencies() {
     const audit = await exec("npm audit --json");
     const outdated = await exec("pnpm outdated --json");

     // Analyze and create recommendations
     const recommendations = analyzeDependencies(audit, outdated);

     if (recommendations.criticalUpdates.length > 0) {
       delegateToBackendArchitect(recommendations);
     }
   }
   ```

3. **Trending Analysis**
   - [ ] Track metrics over time
   - [ ] Detect degradation trends
   - [ ] Predict future issues

4. **Daily/Weekly Reports**

   ```typescript
   async function generateDailyReport() {
     const report = {
       date: new Date().toISOString(),
       scans: getScansToday(),
       issues: getIssuesToday(),
       resolved: getResolvedToday(),
       metrics: getCurrentMetrics(),
     };

     await team_workspace({
       action: "write_artifact",
       name: `daily-report-${formatDate(new Date())}.md`,
       content: formatDailyReport(report),
       tags: ["report", "daily", "health"],
     });
   }
   ```

**Deliverables:**

- [ ] Performance monitoring ativo
- [ ] Dependency tracking configurado
- [ ] Relatórios automáticos gerados

**Testes:**

- [ ] Verificar relatório diário gerado
- [ ] Simular performance degradation
- [ ] Verificar trending detection

---

### **Fase 5: Optimization & Polish (Semana 5)**

**Objetivo:** Otimizar performance e adicionar polish

**Tarefas:**

1. **Performance Optimization**
   - [ ] Reduzir overhead de scans
   - [ ] Implementar caching inteligente
   - [ ] Otimizar queries

2. **False Positive Reduction**
   - [ ] Ajustar thresholds baseado em dados reais
   - [ ] Implementar whitelist para conhecidos
   - [ ] Melhorar detecção de contexto

3. **User Experience**
   - [ ] Melhorar formato de mensagens
   - [ ] Adicionar actionable links
   - [ ] Criar dashboard web (opcional)

4. **Documentation Polish**
   - [ ] Atualizar docs com exemplos reais
   - [ ] Criar troubleshooting guide
   - [ ] Documentar métricas e KPIs

**Deliverables:**

- [ ] Sistema otimizado e performático
- [ ] Documentação completa atualizada
- [ ] Dashboard (se aplicável)

**Testes:**

- [ ] Load test do monitoring system
- [ ] Verificar precisão de detecção
- [ ] Validar UX com time

---

## 🎯 Métricas de Sucesso

### KPIs Principais

1. **Detecção**
   - Target: < 30 min para detectar critical issues
   - Baseline: (estabelecer na Fase 2)

2. **Resolução**
   - Critical: < 4 horas
   - High: < 24 horas
   - Medium: < 1 semana
   - Baseline: (estabelecer na Fase 3)

3. **Qualidade**
   - Coverage: manter > 70%
   - Vulnerabilidades: zero critical/high em releases
   - Build health: > 95% success rate

4. **Disponibilidade**
   - Gateway uptime: > 99.9%
   - Response time p99: < 500ms

### Métricas de Processo

- **False Positive Rate:** < 10%
- **Agent Response Time:** < 5 min para escalações
- **Daily Scan Completion:** 100%
- **Report Generation:** 100% on-time

---

## 🚀 Quick Start (Após Implementação)

### Setup Inicial

```bash
# 1. Instalar dependências (se necessário)
pnpm install

# 2. Executar health check manual
bun scripts/health-check.ts --deep

# 3. Configurar heartbeat
# Editar HEARTBEAT.md conforme template

# 4. Registrar cron job
pnpm openclaw cron add --job health-monitor-scan.json

# 5. Verificar status
pnpm openclaw session-status --agent health-monitor
```

### Comandos Úteis

```bash
# Health check rápido
bun scripts/health-check.ts --quick

# Health check completo
bun scripts/health-check.ts --deep

# Check específico
bun scripts/health-check.ts --category=security

# Ver jobs ativos
pnpm openclaw cron list

# Forçar scan manual
pnpm openclaw cron run --job health-monitor-scan

# Ver últimos relatórios
ls -lt team_workspace/artifacts/ | grep health-report
```

---

## 🔧 Configuração

### Thresholds Recomendados

```json
{
  "health-monitor": {
    "thresholds": {
      "coverage": {
        "critical": 50,
        "high": 60,
        "medium": 70
      },
      "security": {
        "critical": ["critical"],
        "high": ["high"],
        "medium": ["medium"]
      },
      "responseTime": {
        "critical": 5000,
        "high": 2000,
        "medium": 1000
      },
      "errorRate": {
        "critical": 10,
        "high": 5,
        "medium": 2
      }
    },
    "schedule": {
      "quickScan": "*/30 * * * *",
      "deepScan": "0 */6 * * *",
      "weeklyReport": "0 9 * * 1"
    }
  }
}
```

### Agent Configuration

```json
{
  "agents": {
    "list": [
      {
        "id": "health-monitor",
        "identity": {
          "name": "System Health Monitor",
          "theme": "guardian of code quality",
          "emoji": "🏥"
        },
        "subagents": {
          "allowAgents": [
            "security-engineer",
            "qa-lead",
            "performance-engineer",
            "backend-architect"
          ],
          "maxConcurrent": 4
        }
      }
    ]
  }
}
```

---

## 📊 Relatórios

### Daily Report Template

```markdown
# Health Report - [DATE]

## Summary

- Scans: X/Y completed
- Issues: Z detected (X critical, Y high, Z medium)
- Resolved: W issues

## Security

- Alerts: X
- Blocked: Y
- Vulnerabilities: Z

## Quality

- Coverage: X%
- Lint: Y errors
- Type: Z errors

## Performance

- Gateway uptime: X%
- Avg response: Yms
- p99 latency: Zms

## Actions Taken

1. [action]
2. [action]
```

### Weekly Report Template

```markdown
# Weekly Health Report - Week [N]

## Highlights

- Total scans: X
- Issues detected: Y
- Issues resolved: Z
- Avg resolution time: Wh

## Trends

- Coverage: +/-X%
- Vulnerabilities: +/-Y
- Response time: +/-Zms

## Top Issues

1. [issue + resolution]
2. [issue + resolution]

## Recommendations

1. [recommendation]
2. [recommendation]
```

---

## 🐛 Troubleshooting

### Common Issues

**Health Monitor não responde:**

```bash
# Check session status
pnpm openclaw sessions-list --agent health-monitor

# Check cron jobs
pnpm openclaw cron list

# Restart monitoring
pnpm openclaw cron run --job health-monitor-scan
```

**Scans falhando:**

```bash
# Check logs
tail -f ~/.openclaw/logs/health-monitor.log

# Run manual test
bun scripts/health-check.ts --deep

# Check dependencies
pnpm install
```

**Muitos false positives:**

```bash
# Adjust thresholds in config
# Whitelist known issues
# Review detection logic
```

---

## 📚 Referências

- [System Health Monitor Spec](./system-health-monitor.md)
- [Health Monitor Workflow](./.agent/workflows/health-monitor.md)
- [Agent Collaboration System](../../AGENT_COLLABORATION.md)
- [Security Tools](../security/)
- [Sub-agents Guide](../tools/subagents.md)

---

## ✅ Checklist de Implementação

### Fase 1: Foundation ✅

- [x] Documentação criada
- [x] Script base implementado
- [x] Plano definido

### Fase 2: Core

- [ ] Agent profile criado
- [ ] Security APIs integradas
- [ ] Quality checks configurados
- [ ] Heartbeat configurado
- [ ] Cron jobs registrados

### Fase 3: Integration

- [ ] Escalation logic implementada
- [ ] Delegation funcionando
- [ ] Workspace logging ativo
- [ ] Templates criados

### Fase 4: Advanced

- [ ] Performance monitoring
- [ ] Dependency tracking
- [ ] Trending analysis
- [ ] Reports automáticos

### Fase 5: Polish

- [ ] Performance otimizada
- [ ] False positives reduzidos
- [ ] UX melhorada
- [ ] Docs atualizadas

---

**Status:** Fase 1 completa ✅ | Próximo: Fase 2 - Core Implementation

**Owner:** @main (orchestrator)  
**Colaboradores:** @cto, @ciso, @vp-engineering, @qa-lead

**Última atualização:** 2026-02-12
