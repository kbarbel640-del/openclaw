# Memory (Mem0) Adapter

Adaptador de memória de longo prazo para o OpenClaw, inspirado no Mem0, focado em economia de tokens e relevância contextual.

## 🧠 Como Funciona

O plugin utiliza um banco de dados SQLite local para armazenar "memórias" categorizadas em camadas. Ao contrário do histórico de chat bruto, o Mem0 destila informações importantes para reinjetar no prompt do sistema apenas quando necessário.

### Camadas de Memória (Memory Layers)
- **`pref`**: Preferências explícitas do usuário (ex: "Sempre responda em Português", "Prefira código em TypeScript").
- **`fact`**: Fatos estáveis aprendidos (ex: "O servidor de homologação está no IP 10.0.0.5").
- **`task`**: Estado e objetivos de workflows complexos em andamento.
- **`session`**: Resumos progressivos de sessões passadas (integrado ao pipeline de compaction).

## 📊 Token Economy

Este plugin ajuda a manter o contexto do agente limpo:
1. **Budgeted Retrieval**: Busca memórias relevantes respeitando um limite fixo de tokens (padrão: 900 tokens).
2. **Summarization Hook**: Escuta o evento `after_agent_compaction` para salvar o resumo da conversa no banco de memórias estáveis.

## 🛠 Ferramentas

- `memory_mem0_add`: Adiciona manualmente um fato ou preferência.
- `memory_mem0_get`: Recupera o contexto formatado para o LLM.

## 🚀 Configuração
No seu `config.json`:
```json
{
  "plugins": {
    "memory-mem0": {
      "databasePath": "./data/mem0.db"
    }
  }
}
```
