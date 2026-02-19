---
id: evidenceops
name: EvidenceOps
description: Gestão de evidências digitais com Vault local, cadeia de custódia e manifestos determinísticos.
status: stable
category: security
author: OpenClaw Fork
---

# EvidenceOps Skill

Esta skill capacita o agente a gerenciar evidências digitais de forma forense, utilizando um Vault local append-only.

## Runbook

### 1. Inicialização de Caso
Sempre verifique se existe um `caseId` ativo. Se não, peça ao usuário para definir um ou gere um baseado no contexto (ex: `CASE-2024-001`).

### 2. Ingestão de Evidência
Ao receber um arquivo ou caminho de arquivo:
- Use `evidence_ingest(filePath, caseId, sensitivity)`.
- **Regra de Ouro**: Nunca mova o arquivo original manualmente; deixe a ferramenta copiar para o Vault para preservar metadados de criação.
- Informe ao usuário o `evidenceId` e o `sha256` gerado.

### 3. Verificação de Integridade
Para auditorias de rotina ou antes de exportar:
- Use `evidence_verify(evidenceId)` para garantir que o arquivo no Vault não foi alterado.

### 4. Geração de Manifesto e Exportação
Ao finalizar uma fase da investigação:
- Use `evidence_manifest(caseId)` para revisar os itens.
- Use `evidence_export(caseId)` para gerar um pacote ZIP contendo os arquivos e o manifesto assinado (hash).

## SECURITY POSTURE
- **Local-First**: Nenhum dado sai da máquina host.
- **Append-Only**: O Vault não permite sobrescrever ou deletar evidências via ferramentas padrão.
- **Redaction**: Logs de auditoria ocultam caminhos absolutos sensíveis, mostrando apenas o nome do arquivo e o hash.

## PRIVACY
- Sensibilidade `high` deve ser tratada com retenção estrita.
- O agente não deve exibir o conteúdo de evidências `high` no chat a menos que explicitamente solicitado após ingestão.

## Troubleshooting
- **Erro de Permissão**: Verifique se o OpenClaw tem escrita no diretório configurado em `vaultPath`.
- **Hash Mismatch**: Indica corrupção externa no Vault. Acione o protocolo de incidente e não use o arquivo para perícia.
