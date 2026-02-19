# Evidence Vault (Local)

Plugin de armazenamento forense local-first para o OpenClaw. Projetado para investigações que exigem cadeia de custódia e integridade absoluta sem dependência de nuvem.

## ✨ Funcionalidades

- **Append-Only Storage**: Uma vez ingerida, a evidência não pode ser alterada ou excluída via API.
- **Deduplicação por Hash**: Armazenamento baseado em SHA-256. Arquivos idênticos ocupam espaço apenas uma vez.
- **Cadeia de Custódia**: Log de auditoria duplo (SQLite + JSONL imutável) registrando quem (actor), quando e o quê.
- **Manifestos Determinísticos**: Gera um JSON assinado com o estado atual de um caso.
- **Exportação Forense**: Empacotamento ZIP com hashes verificáveis e manifesto incluso.

## 🛠 Ferramentas Disponibilizadas

### `evidence_ingest`
Copia um arquivo local para o vault.
- **Inputs**: `filePath`, `caseId`, `sensitivity` (low|medium|high).
- **Output**: `evidenceId`, `sha256`, `vaultPath`.

### `evidence_verify`
Verifica se o arquivo no disco ainda corresponde ao hash original.
- **Inputs**: `evidenceId`.
- **Output**: `ok: boolean`.

### `evidence_export`
Gera um pacote de exportação para um caso específico.
- **Inputs**: `caseId`.

## 🔒 Segurança e Privacidade
Este plugin opera estritamente em **Localhost**. 
- Os objetos são armazenados em `~/.openclaw/vault/objects/`.
- O catálogo de auditoria reside em `~/.openclaw/vault/catalog.db`.
- Caminhos originais são redigidos nos logs de auditoria para proteger a estrutura de pastas do host.

## 🚀 Instalação (Manual)
Como este é um plugin de prateleira para o fork:
1. Certifique-se de que a pasta está em `extensions/evidence-vault-local`.
2. O OpenClaw carregará automaticamente via `loader.ts` se estiver habilitado no seu `config.json`.
