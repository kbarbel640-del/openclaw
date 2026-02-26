# AGENTS.md - ru docs translation workspace

## Read When

- Maintaining `docs/ru/**`
- Updating the Russian translation pipeline (glossary/TM/prompt)
- Handling Russian translation feedback or regressions

## Pipeline (docs-i18n)

- Source docs: `docs/**/*.md`
- Target docs: `docs/ru/**/*.md`
- Glossary: `docs/.i18n/glossary.ru.json`
- Translation memory: `docs/.i18n/ru.tm.jsonl`
- Prompt rules: `scripts/docs-i18n/prompt.go`

Common runs:

```bash
# Bulk (doc mode; parallel OK)
cd scripts/docs-i18n
go run . -docs ../../docs -lang ru -mode doc -parallel 6 ../../docs/**/*.md

# Single file
cd scripts/docs-i18n
go run . -docs ../../docs -lang ru -mode doc ../../docs/start/getting-started.md

# Small patches (segment mode; uses TM; no parallel)
cd scripts/docs-i18n
go run . -docs ../../docs -lang ru -mode segment ../../docs/start/getting-started.md
```

Notes:

- Prefer `doc` mode for whole-page translation; `segment` mode for small fixes.
- If a very large file times out, do targeted edits or split the page before rerunning.
- After translation, spot-check: code spans/blocks unchanged, links/anchors unchanged, placeholders preserved.
