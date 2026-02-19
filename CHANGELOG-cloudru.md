# Changelog — Cloud.ru Integration Branch

All notable changes from the `claude/review-openclaw-messenger-docs-Rwr8i` branch (66 commits on top of `main`).

## MAX Messenger Extension

- **feat(max): implement MAX Messenger extension (M1-M7)** — full channel integration for VK Teams / eXpress with webhook verification, media pipeline, and group routing
- **feat(max): wire MAX runtime methods into createPluginRuntime()** — probe, send, and monitor adapters
- **feat(max): implement runtime adapter (probe, send, monitor)** — runtime bridge for gateway control plane
- **feat(max): add retry/rate-limit support for MAX Bot API sends** — exponential backoff and rate limiting
- **feat(max): add onboarding wizard adapter and document webhook verification**
- **feat(max): add channel docs, platform dock, and update QE Queen to 89/100**
- **feat(max): add MAX to CHAT_CHANNEL_ORDER and CHAT_CHANNEL_META in platform registry**
- **feat(max): update accounts and config schema, add agent skills**
- **test(max): add 109 unit tests and fix logoutAccount tokenFile clearing**
- **test(max): add 32 integration tests for MAX runtime adapter**
- **fix(max): resolve critical/medium issues from brutal honesty review**
- **fix(max): resolve gaps from final gap check (G-01..G-05)**
- **fix(max): resolve lint errors in runtime adapter**
- **fix(docs): resolve 8 review issues in ccli-max-cloudru-fm docs**

## Cloud.ru AI Fabric

- **feat(ai-fabric): add constants and types** — IAM auth, pagination, agent/system/MCP types
- **feat(ai-fabric): add IAM token management** — CloudruTokenProvider with auto-refresh
- **feat(ai-fabric): add base HTTP client with retry** — CloudruClient with exponential backoff
- **feat(ai-fabric): add Agent, AgentSystem, MCP clients** — CRUD for agents, systems, MCP servers
- **feat(ai-fabric): add barrel exports** — public API surface via `src/ai-fabric/index.ts`
- **feat(ai-fabric): integrate AI Fabric wizard step with MCP auto-discovery**
- **feat(ai-fabric): add A2A client and fix IAM auth in CloudruSimpleClient**
- **feat(ai-fabric): add A2A agent discovery to onboard wizard**
- **feat(ai-fabric): add agent status monitoring module** — health mapping, drift detection
- **feat: E2E onboard tests, agent-status CLI integration, insight-logger docs** — wired agent-status into `openclaw status`
- **fix(ai-fabric): wire CLI flags and Zod schema for AI Fabric**
- **fix(ai-fabric): improve network error diagnostics in discovery wizard**

## Cloud.ru Foundation Models Proxy

- **feat: add Cloud.ru FM integration files to upstream openclaw** — initial proxy config, Docker Compose template
- **feat: auto-start Cloud.ru proxy during onboarding** — wizard launches proxy after config generation
- **feat(cloudru-fm): add GPT-OSS-120B preset to onboard wizard**
- **feat(cloudru-fm): improve onboard wizard and proxy health checks**
- **fix(cloudru-fm): migrate from GLM-4.7 to gpt-oss-120b, fix proxy Docker issues** — `:latest` tag, removed incompatible `read_only`/`user`
- **fix: Cloud.ru FM proxy connectivity and model config issues**
- **fix: add Cloud.ru FM support to non-interactive onboarding**
- **fix: integrate proxy health check into runtime + wire rollback CLI**

## Developer Experience

- **feat(commands): add /deploy command for gateway lifecycle** — prod/dev deploy via Claude Code slash command
- **feat(commands): add /feature command for quality-driven dev cycle**
- **feat: add bundled insight-logger hook** — auto-extracts operational insights from sessions
- **fix: document /dock-max commands, remove lint warning, add Cloud.ru tests** — proxy-health (11 tests), rollback (10 tests), E2E onboard (4 tests), Docker Compose template (15 tests)

## Documentation

- **docs(ru): add comprehensive Russian documentation for MAX extension**
- **docs(ru): add Cloud.ru AI Fabric documentation in Russian**
- **docs(ru): add Foundation Models proxy docs to docs/ru/**
- **docs(ru): consolidate all Russian docs under docs/ru/**
- **docs(ru): add full onboard wizard setup guide**
- **docs(ru): add dev-mode troubleshooting for Telegram channel**
- **docs(ru): add manual endpoint entry guide for AI Fabric wizard**
- **docs(ru): add insight notes and onboard flow diagrams**
- **docs(adr): add ADR-006 MAX Messenger Extension (DDD analysis)**
- **docs(adr): add ADR-007 Cloud.ru A2A integration (PROPOSED)**
- **docs: ADR-008 Cloud.ru AI Fabric bounded context**
- **ADR v2: Rewrite ADR-001..005 with DDD+research, delete orphaned ADR-006..013**
- **docs(quality): add shift-left testing, QCSD ideation, requirements validation, QE Queen assessments**

## Chores

- **chore: add project config, claudeignore, and setup script**
- **chore: remove orphaned packages/ccli-max-cloudru-fm package**
- **chore: add Claude Code config archive for on-prem setup**
- **fix: remove "tools disabled" override from CLI runner**
- **fix: remove unused CLOUDRU_FM_PRESETS import**
- **fix(lint): remove no-useless-catch in cli-runner proxy health check**
