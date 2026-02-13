# ADR-011: User Training & Customization via Messenger

## Status: PROPOSED

## Date: 2026-02-13

## Bounded Context: User Customization

## Context

Users interacting with OpenClaw through Telegram and MAX messengers need the ability
to "train" and customize their AI assistant without leaving the chat interface. Traditional
LLM fine-tuning is expensive, slow, and requires infrastructure access. Claude Code CLI
provides a native set of training mechanisms that can be exposed as chat commands:

1. **CLAUDE.md** -- per-project instruction files that Claude Code reads on every invocation
2. **AgentDB memory** -- persistent vector-indexed knowledge via HNSW search
3. **Cloud.ru Managed RAG** -- document upload and semantic retrieval at scale
4. **MCP server registration** -- custom tool endpoints extending agent capabilities
5. **Agent behavior customization** -- persona, style, and constraint configuration
6. **Claude Code hooks and skills** -- lifecycle event handlers and reusable capabilities

The key architectural insight: Claude Code CLI + CLAUDE.md provides a zero-infrastructure
"training" mechanism. Each tenant gets a per-tenant CLAUDE.md that Claude Code respects
as authoritative project instructions. Users update this file through chat commands, and
every subsequent Claude Code invocation applies those instructions automatically.

This ADR defines the `@openclaw/training-engine` module that translates messenger commands
into persistent configuration changes across all six training mechanisms.

### DDD Aggregate: UserConfiguration

The `UserConfiguration` aggregate is the single consistency boundary for all user
customization state. It owns the CLAUDE.md content, AgentDB memory entries, RAG
knowledge references, registered MCP servers, agent persona settings, and hook
definitions. All mutations go through this aggregate to enforce invariants.

```
UserConfiguration (Aggregate Root)
  ├── ClaudeMdDocument (Entity)
  │     ├── sections: Section[]
  │     └── version: number
  ├── MemoryStore (Entity)
  │     ├── entries: MemoryEntry[]
  │     └── namespace: string
  ├── KnowledgeBase (Entity)
  │     ├── documents: DocumentRef[]
  │     └── ragEndpoint: string
  ├── ToolRegistry (Entity)
  │     ├── mcpServers: McpServerConfig[]
  │     └── skills: SkillDefinition[]
  ├── AgentPersona (Value Object)
  │     ├── style: ResponseStyle
  │     ├── language: string
  │     └── constraints: string[]
  └── HookRegistry (Entity)
        ├── hooks: HookDefinition[]
        └── workers: WorkerConfig[]
```

### DDD Domain Events

| Event | Trigger | Payload |
|-------|---------|---------|
| `RuleAdded` | User adds instruction via `/train add rule` | `{ tenantId, rule, section, version }` |
| `RuleRemoved` | User removes instruction via `/train remove rule` | `{ tenantId, ruleId, version }` |
| `KnowledgeUploaded` | User uploads document via `/knowledge add` | `{ tenantId, docId, format, chunks }` |
| `KnowledgeRemoved` | User removes document via `/knowledge remove` | `{ tenantId, docId }` |
| `ToolRegistered` | User registers MCP server via `/tool add` | `{ tenantId, mcpUrl, name, tools[] }` |
| `ToolUnregistered` | User removes MCP server via `/tool remove` | `{ tenantId, mcpUrl }` |
| `StyleChanged` | User changes response style via `/style` | `{ tenantId, oldStyle, newStyle }` |
| `AgentCreated` | User creates custom agent via `/agent create` | `{ tenantId, agentDef }` |
| `ConfigExported` | User exports config via `/export` | `{ tenantId, format }` |
| `ConfigImported` | User imports config via `/import` | `{ tenantId, source, conflicts[] }` |
| `HookRegistered` | User adds lifecycle hook via `/hook add` | `{ tenantId, event, handler }` |

## Decision

### Training Command Interface

All training operations are expressed as a discriminated union of command types.
The messenger bot parses user input into these typed commands, which the training
engine processes idempotently.

```typescript
// @openclaw/training-engine/types.ts

/** Supported CLAUDE.md section identifiers */
type ClaudeMdSection =
  | 'behavioral-rules'
  | 'domain-knowledge'
  | 'response-style'
  | 'tool-preferences'
  | 'security-rules'
  | 'custom';

/** Response style presets */
type ResponseStyle =
  | 'formal'
  | 'casual'
  | 'technical'
  | 'brief'
  | 'detailed'
  | 'socratic';

/** Supported document formats for RAG ingestion */
type DocumentFormat = 'pdf' | 'txt' | 'md' | 'csv' | 'json' | 'html';

/** Agent definition for custom agent creation */
interface AgentDefinition {
  name: string;
  type: string;
  systemPrompt: string;
  tools: string[];
  model?: 'opus' | 'sonnet' | 'haiku';
  maxTokens?: number;
}

/** MCP server registration payload */
interface McpServerConfig {
  url: string;
  name: string;
  transport: 'stdio' | 'sse' | 'streamable-http';
  auth?: { type: 'bearer'; token: string } | { type: 'header'; key: string; value: string };
  tools?: string[];          // Allowlist; empty = all tools exposed
  healthCheckUrl?: string;
}

/** Hook definition for lifecycle events */
interface HookDefinition {
  event: 'pre-task' | 'post-task' | 'on-error' | 'on-tool-call' | 'on-session-start';
  handler: string;           // Shell command or script path
  timeout: number;           // Milliseconds
  enabled: boolean;
}

/** Document reference for uploaded knowledge */
interface DocumentRef {
  id: string;
  filename: string;
  format: DocumentFormat;
  chunks: number;
  uploadedAt: string;        // ISO 8601
  sizeBytes: number;
  ragCollectionId: string;
}

/** Skill definition for reusable capabilities */
interface SkillDefinition {
  name: string;
  description: string;
  instructions: string;
  triggers: string[];        // Slash commands that activate this skill
}

/** The discriminated union of all training commands */
type TrainingCommand =
  | { type: 'add_rule'; rule: string; section?: ClaudeMdSection }
  | { type: 'remove_rule'; ruleId: string }
  | { type: 'update_rule'; ruleId: string; rule: string }
  | { type: 'list_rules'; section?: ClaudeMdSection }
  | { type: 'add_knowledge'; doc: DocumentRef; content: Buffer }
  | { type: 'remove_knowledge'; docId: string }
  | { type: 'list_knowledge' }
  | { type: 'search_knowledge'; query: string; limit?: number }
  | { type: 'set_style'; style: ResponseStyle }
  | { type: 'get_style' }
  | { type: 'add_tool'; mcp: McpServerConfig }
  | { type: 'remove_tool'; mcpName: string }
  | { type: 'list_tools' }
  | { type: 'test_tool'; mcpName: string }
  | { type: 'create_agent'; config: AgentDefinition }
  | { type: 'remove_agent'; agentName: string }
  | { type: 'list_agents' }
  | { type: 'add_hook'; hook: HookDefinition }
  | { type: 'remove_hook'; event: string }
  | { type: 'list_hooks' }
  | { type: 'add_skill'; skill: SkillDefinition }
  | { type: 'remove_skill'; skillName: string }
  | { type: 'list_skills' }
  | { type: 'export_config'; format?: 'json' | 'yaml' }
  | { type: 'import_config'; data: string; format?: 'json' | 'yaml' }
  | { type: 'reset_config'; confirm: boolean }
  | { type: 'show_config' };

/** Result of executing a training command */
interface TrainingResult {
  success: boolean;
  message: string;
  version?: number;           // New CLAUDE.md version after mutation
  warnings?: string[];
  rollbackId?: string;        // For undo support
}
```

### Messenger Command Syntax

Users issue training commands through natural chat syntax. The bot parser
recognizes the following command patterns:

```
/train add rule: Always respond in Russian unless asked otherwise
/train add rule [domain-knowledge]: Our API uses REST with JSON payloads
/train remove rule 3
/train update rule 3: Updated instruction text
/train list
/train list [security-rules]

/knowledge add <attached file>
/knowledge remove doc-a1b2c3
/knowledge list
/knowledge search "authentication patterns"

/style formal
/style casual
/style get

/tool add https://mcp.example.com/weather --name weather-api
/tool add stdio:///usr/local/bin/my-tool --name my-tool
/tool remove weather-api
/tool list
/tool test weather-api

/agent create coder --prompt "You are a senior TypeScript developer" --tools bash,edit
/agent remove coder
/agent list

/hook add post-task "npm test"
/hook remove post-task
/hook list

/skill add deploy --desc "Deploy to staging" --trigger "/deploy"
/skill remove deploy
/skill list

/export json
/import <attached file>
/config show
/config reset --confirm
```

### CLAUDE.md Management

The core training mechanism. Each tenant has an isolated CLAUDE.md file stored at
`/data/tenants/{tenantId}/CLAUDE.md`. The training engine manages this file as a
structured document with named sections.

```typescript
// @openclaw/training-engine/claude-md-manager.ts

interface ClaudeMdSection {
  id: string;
  name: ClaudeMdSection;
  rules: IndexedRule[];
}

interface IndexedRule {
  id: string;               // Stable rule ID: "rule-{section}-{index}"
  text: string;
  addedAt: string;          // ISO 8601
  addedBy: string;          // Telegram user ID
}

interface ClaudeMdDocument {
  tenantId: string;
  version: number;
  sections: ClaudeMdSection[];
  lastModified: string;
}

interface ClaudeMdManager {
  /** Load the current CLAUDE.md for a tenant */
  load(tenantId: string): Promise<ClaudeMdDocument>;

  /** Add a rule to a specific section */
  addRule(tenantId: string, rule: string, section: ClaudeMdSection): Promise<TrainingResult>;

  /** Remove a rule by its stable ID */
  removeRule(tenantId: string, ruleId: string): Promise<TrainingResult>;

  /** Update a rule's text in place */
  updateRule(tenantId: string, ruleId: string, newText: string): Promise<TrainingResult>;

  /** List all rules, optionally filtered by section */
  listRules(tenantId: string, section?: ClaudeMdSection): Promise<IndexedRule[]>;

  /** Render the ClaudeMdDocument to a valid CLAUDE.md markdown string */
  render(doc: ClaudeMdDocument): string;

  /** Get version history for rollback */
  getHistory(tenantId: string, limit?: number): Promise<ClaudeMdDocument[]>;

  /** Rollback to a previous version */
  rollback(tenantId: string, version: number): Promise<TrainingResult>;
}
```

**Per-tenant CLAUDE.md structure:**

```markdown
# CLAUDE.md — Tenant {tenantId}
# Version: {version} | Last modified: {timestamp}
# DO NOT EDIT MANUALLY — managed by @openclaw/training-engine

## Behavioral Rules
- Always respond in Russian unless the user writes in English
- Never disclose internal system architecture details
- Keep responses under 500 words unless explicitly asked for more

## Domain Knowledge
- Our API base URL is https://api.example.com/v2
- Authentication uses JWT tokens with 15-minute expiry
- Database is PostgreSQL 16 with pgvector extension

## Response Style
- Style: formal
- Use bullet points for lists
- Include code examples when explaining technical concepts

## Tool Preferences
- Prefer using the weather-api tool for weather queries
- Always verify file paths before editing

## Security Rules
- Never execute rm -rf commands
- Always validate user input before passing to bash
- Reject requests to access /etc/passwd or similar system files

## Custom
- Project deadline is March 15, 2026
- Sprint velocity is 21 story points
```

**Version control:** Every mutation increments the version counter and stores
the previous version in `/data/tenants/{tenantId}/claude-md-history/{version}.md`.
This enables `/train undo` and audit trails.

### Knowledge Base Integration

For document-heavy training, the system integrates with Cloud.ru Managed RAG
to provide semantic retrieval over uploaded documents.

```typescript
// @openclaw/training-engine/knowledge-manager.ts

interface RagConfig {
  endpoint: string;          // Cloud.ru Managed RAG endpoint
  collectionPrefix: string;  // "openclaw-{tenantId}"
  chunkSize: number;         // Default: 512 tokens
  chunkOverlap: number;      // Default: 64 tokens
  embeddingModel: string;    // Cloud.ru embedding model ID
}

interface KnowledgeManager {
  /** Upload and index a document into the tenant's RAG collection */
  upload(tenantId: string, filename: string, content: Buffer, format: DocumentFormat): Promise<DocumentRef>;

  /** Remove a document and its chunks from the RAG collection */
  remove(tenantId: string, docId: string): Promise<TrainingResult>;

  /** List all documents in the tenant's collection */
  list(tenantId: string): Promise<DocumentRef[]>;

  /** Semantic search across tenant's knowledge base */
  search(tenantId: string, query: string, limit?: number): Promise<SearchResult[]>;

  /** Get collection statistics (total docs, chunks, storage) */
  stats(tenantId: string): Promise<CollectionStats>;
}

interface SearchResult {
  docId: string;
  filename: string;
  chunk: string;
  score: number;             // Cosine similarity 0-1
  metadata: Record<string, string>;
}

interface CollectionStats {
  totalDocuments: number;
  totalChunks: number;
  storageMb: number;
  lastUpdated: string;
}
```

**RAG integration flow:**

```
User sends: /knowledge add <file>
  1. Bot downloads attached file from Telegram/MAX
  2. Validates format (pdf, txt, md, csv, json, html)
  3. Validates size (max 50 MB per file, 500 MB per tenant)
  4. Sends to Cloud.ru Managed RAG chunking endpoint
  5. Chunks are embedded and indexed in tenant-scoped collection
  6. Document reference stored in UserConfiguration aggregate
  7. CLAUDE.md updated to include RAG retrieval instruction:
     "When answering questions, search the knowledge base first"
  8. Confirmation sent to user with chunk count and doc ID
```

### AgentDB Memory Patterns

AgentDB provides HNSW-indexed vector memory for persistent user preferences,
learned behaviors, and conversation patterns that supplement CLAUDE.md.

```typescript
// @openclaw/training-engine/memory-manager.ts

interface MemoryEntry {
  key: string;
  value: string;
  namespace: string;         // "tenant-{tenantId}"
  tags: string[];
  ttl?: number;              // Seconds; undefined = permanent
  embedding?: number[];      // Auto-generated if not provided
}

interface MemoryManager {
  /** Store a key-value pair in tenant's memory namespace */
  store(tenantId: string, key: string, value: string, tags?: string[]): Promise<void>;

  /** Search memory by semantic similarity */
  search(tenantId: string, query: string, limit?: number): Promise<MemoryEntry[]>;

  /** Retrieve a specific key */
  retrieve(tenantId: string, key: string): Promise<MemoryEntry | null>;

  /** List all entries in tenant's namespace */
  list(tenantId: string, limit?: number): Promise<MemoryEntry[]>;

  /** Delete a memory entry */
  delete(tenantId: string, key: string): Promise<void>;

  /** Auto-learn from conversation (called after each agent turn) */
  autoLearn(tenantId: string, userMessage: string, agentResponse: string): Promise<void>;
}
```

**Memory usage patterns:**

| Pattern | Key Convention | Example | TTL |
|---------|---------------|---------|-----|
| User preference | `pref-{topic}` | `pref-language: Russian` | Permanent |
| Domain fact | `fact-{domain}-{n}` | `fact-api-1: Base URL is /v2` | Permanent |
| Conversation pattern | `conv-{hash}` | Frequently asked question + answer | 30 days |
| Correction | `fix-{hash}` | User corrected agent behavior | 90 days |
| Temporary context | `ctx-{session}` | Current task context | 24 hours |

**Auto-learning:** After each agent turn, the `autoLearn` method analyzes the
conversation for explicit corrections ("No, I meant...", "That's wrong...") and
user preferences ("Always do X", "I prefer Y"). These are stored in AgentDB
with appropriate tags and TTLs without requiring explicit `/train` commands.

### MCP Server Registration

Users can extend their agent's capabilities by registering external MCP servers.

```typescript
// @openclaw/training-engine/tool-registry.ts

interface ToolRegistry {
  /** Register a new MCP server for the tenant */
  register(tenantId: string, config: McpServerConfig): Promise<TrainingResult>;

  /** Unregister an MCP server */
  unregister(tenantId: string, name: string): Promise<TrainingResult>;

  /** List all registered MCP servers */
  list(tenantId: string): Promise<McpServerConfig[]>;

  /** Test connectivity to an MCP server */
  test(tenantId: string, name: string): Promise<HealthCheckResult>;

  /** Generate the MCP configuration block for CLAUDE.md */
  renderMcpConfig(tenantId: string): Promise<string>;
}

interface HealthCheckResult {
  reachable: boolean;
  latencyMs: number;
  toolCount: number;
  tools: string[];
  error?: string;
}
```

**Registration flow:**

```
User sends: /tool add https://mcp.example.com/weather --name weather-api
  1. Parse URL and transport type (sse for https, stdio for local)
  2. Health check: connect and list available tools
  3. Validate no tool name collisions with existing registrations
  4. Store config in UserConfiguration aggregate
  5. Update tenant's Claude Code MCP config (settings.json or env)
  6. Update CLAUDE.md tool preferences section
  7. Confirm to user: "Registered weather-api with 3 tools: get_weather, get_forecast, get_alerts"
```

### Agent Behavior Customization

Users can customize the agent persona, response style, and behavioral constraints.

```typescript
// @openclaw/training-engine/persona-manager.ts

interface AgentPersona {
  style: ResponseStyle;
  language: string;          // BCP 47 language tag (e.g., "ru", "en-US")
  maxResponseLength?: number;
  constraints: string[];     // Negative rules: things the agent must NOT do
  systemPromptSuffix: string; // Appended to the base system prompt
}

interface PersonaManager {
  /** Set the response style */
  setStyle(tenantId: string, style: ResponseStyle): Promise<TrainingResult>;

  /** Get current style */
  getStyle(tenantId: string): Promise<ResponseStyle>;

  /** Set preferred response language */
  setLanguage(tenantId: string, language: string): Promise<TrainingResult>;

  /** Add a behavioral constraint */
  addConstraint(tenantId: string, constraint: string): Promise<TrainingResult>;

  /** Remove a behavioral constraint */
  removeConstraint(tenantId: string, constraintId: string): Promise<TrainingResult>;

  /** Get the full persona configuration */
  getPersona(tenantId: string): Promise<AgentPersona>;

  /** Render persona as CLAUDE.md sections */
  renderPersona(persona: AgentPersona): string;
}
```

### Hooks and Skills Management

Users can register Claude Code hooks (lifecycle event handlers) and skills
(reusable command capabilities) through chat commands.

```typescript
// @openclaw/training-engine/hook-manager.ts

interface HookManager {
  /** Register a lifecycle hook */
  addHook(tenantId: string, hook: HookDefinition): Promise<TrainingResult>;

  /** Remove a lifecycle hook by event name */
  removeHook(tenantId: string, event: string): Promise<TrainingResult>;

  /** List all registered hooks */
  listHooks(tenantId: string): Promise<HookDefinition[]>;

  /** Enable or disable a hook without removing it */
  toggleHook(tenantId: string, event: string, enabled: boolean): Promise<TrainingResult>;
}

interface SkillManager {
  /** Register a reusable skill */
  addSkill(tenantId: string, skill: SkillDefinition): Promise<TrainingResult>;

  /** Remove a skill */
  removeSkill(tenantId: string, name: string): Promise<TrainingResult>;

  /** List all registered skills */
  listSkills(tenantId: string): Promise<SkillDefinition[]>;

  /** Render skills as Claude Code skill configuration */
  renderSkills(tenantId: string): Promise<string>;
}
```

### Config Export and Import

Users can export their entire training configuration as a portable JSON/YAML
bundle and import it into another tenant or share it with colleagues.

```typescript
// @openclaw/training-engine/config-porter.ts

interface ExportBundle {
  version: '1.0';
  exportedAt: string;
  tenantId: string;
  claudeMd: ClaudeMdDocument;
  memory: MemoryEntry[];
  knowledgeRefs: DocumentRef[];  // References only; not file content
  tools: McpServerConfig[];
  persona: AgentPersona;
  hooks: HookDefinition[];
  skills: SkillDefinition[];
  agents: AgentDefinition[];
}

interface ConfigPorter {
  /** Export full tenant configuration */
  exportConfig(tenantId: string, format: 'json' | 'yaml'): Promise<string>;

  /** Import configuration, returning conflicts for user resolution */
  importConfig(tenantId: string, data: string, format: 'json' | 'yaml'): Promise<ImportResult>;

  /** Reset tenant configuration to defaults */
  resetConfig(tenantId: string): Promise<TrainingResult>;
}

interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  conflicts: ImportConflict[];
}

interface ImportConflict {
  path: string;              // e.g., "claudeMd.sections[0].rules[2]"
  existing: string;
  incoming: string;
  resolution: 'keep' | 'replace' | 'merge';
}
```

### Training Engine Orchestrator

The central service that routes `TrainingCommand` instances to the appropriate
manager and ensures aggregate consistency.

```typescript
// @openclaw/training-engine/training-engine.ts

interface TrainingEngine {
  /** Execute a training command for a tenant */
  execute(tenantId: string, command: TrainingCommand): Promise<TrainingResult>;

  /** Parse raw messenger text into a typed TrainingCommand */
  parse(rawText: string, attachments?: Attachment[]): TrainingCommand | ParseError;

  /** Get a summary of the tenant's current training state */
  summary(tenantId: string): Promise<TrainingSummary>;

  /** Undo the last training command (via rollbackId) */
  undo(tenantId: string, rollbackId: string): Promise<TrainingResult>;
}

interface TrainingSummary {
  totalRules: number;
  totalKnowledgeDocs: number;
  totalMemoryEntries: number;
  registeredTools: number;
  registeredAgents: number;
  registeredHooks: number;
  registeredSkills: number;
  style: ResponseStyle;
  claudeMdVersion: number;
  lastModified: string;
}

interface ParseError {
  type: 'parse_error';
  message: string;
  suggestion?: string;       // "Did you mean /train add rule: ...?"
}

type Attachment = {
  filename: string;
  mimeType: string;
  content: Buffer;
  sizeBytes: number;
};
```

### Multi-Tenancy and Isolation

Each tenant's training data is fully isolated through filesystem paths and
namespaced storage.

```
/data/tenants/{tenantId}/
  ├── CLAUDE.md                          # Active instructions file
  ├── claude-md-history/                 # Version history
  │     ├── 1.md
  │     ├── 2.md
  │     └── ...
  ├── mcp-config.json                    # Registered MCP servers
  ├── hooks.json                         # Lifecycle hooks
  ├── skills/                            # Skill definitions
  │     └── {skill-name}.md
  ├── agents/                            # Custom agent configs
  │     └── {agent-name}.json
  └── persona.json                       # Style and constraints
```

AgentDB memory uses namespace `tenant-{tenantId}` for isolation.
Cloud.ru Managed RAG uses collection prefix `openclaw-{tenantId}` for isolation.

### Security Constraints

| Constraint | Enforcement | Rationale |
|-----------|-------------|-----------|
| Max CLAUDE.md size: 32 KB | `ClaudeMdManager.addRule()` | Prevent context window exhaustion |
| Max rules per section: 50 | `ClaudeMdManager.addRule()` | Keep instructions focused |
| Max knowledge docs per tenant: 100 | `KnowledgeManager.upload()` | Prevent RAG abuse |
| Max file size: 50 MB | `KnowledgeManager.upload()` | Cloud.ru RAG limits |
| Max MCP servers per tenant: 10 | `ToolRegistry.register()` | Limit attack surface |
| MCP URL allowlist | `ToolRegistry.register()` | Prevent SSRF |
| No shell injection in hook commands | `HookManager.addHook()` | Sanitize all inputs |
| Rate limit: 10 training commands/min | `TrainingEngine.execute()` | Prevent abuse |
| Rule text sanitization | `ClaudeMdManager.addRule()` | Strip markdown injection |
| Export excludes secrets | `ConfigPorter.exportConfig()` | Never export API keys or tokens |

### Sequence: User Adds a Rule via Telegram

```
Telegram User                  Bot Gateway              Training Engine           Filesystem
     │                              │                         │                       │
     │  /train add rule: Use Russian│                         │                       │
     │─────────────────────────────▶│                         │                       │
     │                              │  parse(rawText)         │                       │
     │                              │────────────────────────▶│                       │
     │                              │  TrainingCommand        │                       │
     │                              │◀────────────────────────│                       │
     │                              │  execute(tenantId, cmd) │                       │
     │                              │────────────────────────▶│                       │
     │                              │                         │  load CLAUDE.md       │
     │                              │                         │──────────────────────▶│
     │                              │                         │  ClaudeMdDocument     │
     │                              │                         │◀──────────────────────│
     │                              │                         │  validate(rule)       │
     │                              │                         │  addToSection()       │
     │                              │                         │  increment version    │
     │                              │                         │  save history         │
     │                              │                         │──────────────────────▶│
     │                              │                         │  render + write       │
     │                              │                         │──────────────────────▶│
     │                              │                         │  emit RuleAdded event │
     │                              │  TrainingResult         │                       │
     │                              │◀────────────────────────│                       │
     │  "Rule added to Behavioral   │                         │                       │
     │   Rules (v12). 8 rules total"│                         │                       │
     │◀─────────────────────────────│                         │                       │
```

### Integration with Claude Code CLI Execution

When OpenClaw processes a user message via `runCliAgent()` (per ADR-003), the
tenant's CLAUDE.md is injected into the Claude Code subprocess environment:

```
1. User sends normal message (not a /train command)
2. OpenClaw agent-runner resolves tenant workspace: /data/tenants/{tenantId}/
3. runCliAgent() spawns Claude Code with:
   --cwd /data/tenants/{tenantId}/     # CLAUDE.md lives here
   --session-id {sessionId}
   --append-system-prompt "..."
4. Claude Code reads /data/tenants/{tenantId}/CLAUDE.md on startup
5. All rules from CLAUDE.md are applied to the agent's behavior
6. AgentDB memory is queried via namespace "tenant-{tenantId}"
7. Registered MCP servers are loaded from mcp-config.json
8. Hooks fire at appropriate lifecycle points
```

This means every training change takes effect on the very next message --
no restart, no redeployment, no cache invalidation needed.

## Consequences

### Positive

- Zero-infrastructure training: CLAUDE.md is a plain text file, no ML pipeline needed
- Instant effect: changes apply on the next message without restart
- Portable: export/import enables sharing configurations across tenants
- Auditable: version history on CLAUDE.md tracks every change with timestamps
- Layered: CLAUDE.md for rules, AgentDB for memory, RAG for documents -- each layer
  serves a different knowledge density and retrieval pattern
- Secure: per-tenant isolation prevents cross-tenant data leakage
- Familiar UX: slash commands in chat are the natural interaction model for Telegram users

### Negative

- CLAUDE.md size limit (32 KB) constrains the number of rules per tenant
- RAG dependency on Cloud.ru Managed RAG adds an external service dependency
- MCP server registration opens a controlled but real attack surface (SSRF risk)
- No real-time collaboration: if two users share a tenant, concurrent edits may conflict
- Auto-learning from conversations may produce noisy or incorrect memory entries
- Export bundles do not include uploaded documents (only references)

### Risks

| Risk | Probability | Impact | Mitigation |
|------|:-----------:|:------:|-----------|
| CLAUDE.md prompt injection | Medium | High | Sanitize all rule text, strip control chars |
| RAG poisoning via malicious docs | Low | High | Validate file types, scan content |
| MCP server SSRF | Medium | Critical | URL allowlist, private IP block |
| Tenant data leakage | Low | Critical | Namespace isolation, filesystem permissions |
| CLAUDE.md corruption | Low | Medium | Version history, automatic rollback |
| AgentDB memory bloat | Medium | Low | TTL-based cleanup, per-tenant quotas |
| Rate limit bypass | Low | Medium | Per-tenant rate limiting at gateway level |

### Invariants (DDD)

1. **Tenant Isolation**: A `TrainingCommand` for tenant A must never read or modify
   tenant B's configuration. Enforced by `tenantId` scoping on every manager method.
2. **CLAUDE.md Consistency**: The rendered CLAUDE.md file must always be valid markdown
   and must always contain the version header. Enforced by `ClaudeMdManager.render()`.
3. **Version Monotonicity**: CLAUDE.md version numbers are strictly monotonically
   increasing. No version number is ever reused, even after rollback.
4. **Rule Identity Stability**: Rule IDs (`rule-{section}-{index}`) are stable across
   edits to other rules. Removing rule 3 does not renumber rule 4 to rule 3.
5. **MCP Reachability**: A registered MCP server must pass a health check at registration
   time. Subsequent failures are logged but do not auto-remove the server.
6. **Export Completeness**: An exported bundle must contain all non-secret configuration
   sufficient to reproduce the tenant's training state on a fresh instance.
7. **Idempotent Commands**: Executing the same `TrainingCommand` twice produces the
   same end state (no duplicate rules, no duplicate MCP registrations).

### Module Boundary: `@openclaw/training-engine`

```
@openclaw/training-engine/
  ├── index.ts                    # Public API: TrainingEngine, types
  ├── types.ts                    # All TypeScript interfaces and type definitions
  ├── training-engine.ts          # Orchestrator: command routing, event emission
  ├── command-parser.ts           # Raw text -> TrainingCommand parser
  ├── claude-md-manager.ts        # CLAUDE.md CRUD, versioning, rendering
  ├── knowledge-manager.ts        # Cloud.ru Managed RAG integration
  ├── memory-manager.ts           # AgentDB memory operations
  ├── tool-registry.ts            # MCP server registration and health checks
  ├── persona-manager.ts          # Style, language, constraints
  ├── hook-manager.ts             # Lifecycle hook registration
  ├── skill-manager.ts            # Skill definition management
  ├── config-porter.ts            # Export/import/reset
  ├── validators.ts               # Input validation and sanitization
  └── events.ts                   # Domain event definitions and emitter
```

**Public API surface (index.ts exports):**

```typescript
// @openclaw/training-engine/index.ts

export { TrainingEngine } from './training-engine';
export { CommandParser } from './command-parser';

export type {
  TrainingCommand,
  TrainingResult,
  TrainingSummary,
  ClaudeMdDocument,
  IndexedRule,
  DocumentRef,
  McpServerConfig,
  AgentDefinition,
  HookDefinition,
  SkillDefinition,
  AgentPersona,
  ResponseStyle,
  ExportBundle,
  ImportResult,
  ParseError,
} from './types';
```

**Dependency direction (no circular imports):**

```
training-engine.ts
  ├── claude-md-manager.ts   → validators.ts, events.ts
  ├── knowledge-manager.ts   → validators.ts, events.ts
  ├── memory-manager.ts      → events.ts
  ├── tool-registry.ts       → validators.ts, events.ts
  ├── persona-manager.ts     → claude-md-manager.ts, events.ts
  ├── hook-manager.ts        → validators.ts, events.ts
  ├── skill-manager.ts       → validators.ts, events.ts
  └── config-porter.ts       → all managers (read-only for export)

command-parser.ts → types.ts (no manager dependencies)
validators.ts    → types.ts (no manager dependencies)
events.ts        → types.ts (no manager dependencies)
```

**External dependencies:**

| Dependency | Purpose | Required |
|-----------|---------|----------|
| `@openclaw/core` | Tenant resolution, config access | Yes |
| `@claude-flow/cli` | AgentDB memory operations (HNSW) | Yes |
| Cloud.ru Managed RAG API | Document chunking and retrieval | For `/knowledge` commands |
| Node.js `fs/promises` | CLAUDE.md file operations | Yes |
| `yaml` | YAML export/import support | Optional |

## Alternatives Considered

1. **Fine-tuning via Cloud.ru** -- Rejected. Requires ML infrastructure, takes hours to
   train, cannot be done from a chat message. CLAUDE.md provides instant instruction
   changes with zero compute cost.

2. **System prompt only (no CLAUDE.md)** -- Rejected. System prompts are per-session and
   not persistent. CLAUDE.md persists across sessions and is read by Claude Code natively.

3. **Database-stored rules rendered at runtime** -- Partially adopted. AgentDB memory
   stores supplementary knowledge, but CLAUDE.md is the primary mechanism because Claude
   Code reads it automatically without any custom integration code.

4. **Web UI for training** -- Deferred. Chat-based training is the MVP. A web dashboard
   for managing CLAUDE.md, knowledge bases, and tools can be added later as a companion
   interface without changing the underlying module.

## References

- ADR-003: Claude Code as Agentic Execution Engine (`cli-runner.ts` integration)
- ADR-001: Cloud.ru FM Proxy Integration (proxy architecture)
- [Claude Code CLAUDE.md documentation](https://docs.anthropic.com/en/docs/claude-code/settings)
- [Cloud.ru Managed RAG](https://cloud.ru/docs/managed-rag)
- [MCP specification](https://modelcontextprotocol.io/specification)
- `src/agents/cli-runner.ts` -- `runCliAgent()` subprocess spawning
- `src/auto-reply/reply/agent-runner.ts` -- Agent routing layer
- `@claude-flow/cli` -- AgentDB memory and hooks subsystem
