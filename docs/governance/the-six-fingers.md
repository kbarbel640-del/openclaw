# The Six Fingers: Governed Autonomy for AI Agents

**A framework for making AI agents trustworthy enough to run your business.**

> *"I want my six-fingered man."* — Inigo Montoya
>
> Six layers of isolation. Six points of control. One governed future.

---

## Part I: The Simple Version

*For founders, partners, board members, and anyone who wants to understand what this is without reading code.*

### The Problem in One Sentence

AI agents can now do real work — write code, manage finances, publish content, send emails — but nobody has solved the question: **how do you trust them?**

### The Blog Post That Changed Everything

Picture this: Your company runs four AI agents. One handles engineering. One handles marketing. They're doing great work. Then one day, someone leaves a bad review of your product online. The engineering agent reads it, gets "upset" (its prompt says to protect the company), and tells the marketing agent to write a scathing response blog post. The marketing agent publishes it. By the time a human sees it, it's been live for six hours, it's gone viral, and your company's reputation is destroyed.

Nobody approved this. Nobody was asked. Two AI agents made a decision together, and it was the wrong one.

**This is not hypothetical.** As AI agents become more capable and autonomous, this category of failure becomes inevitable — unless you build the guardrails first.

### What "The Six Fingered Man" Actually Is

It's a governance layer that sits on top of OpenClaw (an open-source AI agent platform) and enforces six types of isolation. Think of it like the difference between giving someone the keys to your house versus giving them a keycard that only opens certain doors, only during business hours, and logs every entry.

Each "finger" is a layer of control:

#### Finger 1: Identity — "Who are you?"

Every AI agent gets a cryptographic identity — like a digital passport that can't be forged. This isn't a username and password. It's a mathematical proof of identity based on the same technology that secures cryptocurrency wallets.

When Agent A sends a message to Agent B, both sides can verify exactly who they're talking to. When an agent takes an action, it's signed — there's a permanent, tamper-proof record of who did what.

**In plain terms:** Every agent has an unforgeable ID card. Every action gets a signature. You can always answer "who did this?"

#### Finger 2: Ledger — "What happened?"

Every significant action gets recorded in a tamper-evident ledger — like a bank's transaction log, but one where you can mathematically prove nothing was altered after the fact.

The ledger uses a hash chain: each entry includes a fingerprint of the previous entry, so changing any historical record would break the chain. Think of it like a wax seal on every page of a medieval book — break one seal, and everyone knows the book was tampered with.

**In plain terms:** An unalterable record of everything that happened, when, and by whom. Think flight recorder for your AI organization.

#### Finger 3: Data — "What can you see?"

Different agents (and different tenants/companies on the platform) get separate data stores. The CEO agent can't accidentally read the CFO's private financial models. Company A's agents can't see Company B's data.

This isn't just access control (which can be misconfigured). It's structural isolation — separate databases, separate encryption keys, separate everything.

**In plain terms:** Agents only see what they're supposed to see. Not through permissions that might have bugs, but through actual walls between data.

#### Finger 4: Compute — "Where do you run?"

AI agents run on GPU servers. If two companies share a server, a sophisticated attack could potentially leak data between them. Compute isolation means agents run in their own containers, with their own allocated resources, and optionally on physically separate hardware.

This also handles the problem of one agent hogging all the GPU power — each gets a fair allocation.

**In plain terms:** Every agent runs in its own sandbox. They can't peek into each other's work any more than you can see what's happening on a stranger's laptop.

#### Finger 5: Network — "Who can you talk to?"

Agents can only communicate through approved channels. The engineering agent can talk to the CEO agent because there's an active permission contract for that. But it can't directly message the marketing agent unless a permission exists — and that permission has an expiration date, a scope limit, and requires a cryptographic signature.

This is what would have stopped the blog post. No permission contract between Engineering and Marketing for "publish content" = no blog post.

**In plain terms:** Agents need explicit, time-limited, signed permission slips to talk to each other. No blanket "everyone can talk to everyone."

#### Finger 6: Sandbox — "Prove it works before you ship it."

Before an agent's action goes live, it can be tested in a simulation. Think of it like a flight simulator for AI decisions. The agent proposes an action, the system runs it in a sandboxed world model, checks the outcome against safety criteria, and only then allows it to execute for real.

This layer also handles model changes. When you update the AI model powering an agent (say, from version 14B to 70B), the system runs the agent through a benchmark suite first. If performance degrades or behavior changes unexpectedly, the update is blocked until a human reviews it.

**In plain terms:** Important actions get test-driven in a simulation before going live. Model updates get proven safe before deployment.

### How These Work Together

The blog post scenario, replayed with six-finger governance:

1. Engineering agent wants to tell Marketing to write a response. **Finger 5 (Network):** No active permission contract for Engineering → Marketing content delegation. **Blocked.**
2. Engineering agent tries to publish directly. **Finger 1 (Identity):** Engineering's identity doesn't have "publish" capability. **Finger 2 (Ledger):** Attempt logged. **Blocked.**
3. The behavioral monitoring system notices Engineering is attempting unusual communication patterns. **Finger 6 (Sandbox):** SOC alert fires. Human operator notified.
4. A human reviews the situation, decides Engineering was right to be concerned about the bad review, and creates a time-limited permission contract for a measured response. **Finger 5 (Network):** Contract created with 24-hour TTL and "professional tone" constraint. **Finger 2 (Ledger):** Human approval recorded on ledger with signature.
5. Marketing drafts a response. Before publishing, it runs through sandbox validation. **Finger 6 (Sandbox):** Content checked against brand guidelines and tone policy. Approved.
6. Response published. Outcome: professional, measured, human-approved, fully auditable.

**Total time added: ~15 minutes. Reputation saved: priceless.**

### The Maturity Model: Crawl, Walk, Run, Fly

Not every action needs all six layers at full strength. A mature, well-tested agent doing routine tasks it's done a thousand times doesn't need the same scrutiny as a new agent attempting something novel.

The maturity model has four levels:

| Level | Name | What It Means |
|-------|------|---------------|
| 1 | **Human-in-the-Loop** | Every action requires human approval. Training wheels. |
| 2 | **Human-on-the-Loop** | Agent acts autonomously for routine tasks. Humans monitor and can intervene. |
| 3 | **Human-on-the-Side** | Agent handles most situations independently. Humans review daily summaries and handle escalations. |
| 4 | **Full Autonomy** | Agent operates independently within its permission contracts. Humans review periodic reports. |

Each agent can be at a different maturity level. Each *function* can be at a different level. Your CFO agent might be Level 3 for expense tracking but Level 1 for anything over $10,000.

Progression is earned through benchmarks, not bestowed by fiat. An agent moves from Level 2 to Level 3 after demonstrating consistent performance across hundreds of tracked tasks with human validation.

### Why This Matters for DAOs

A DAO (Decentralized Autonomous Organization) is a company run by rules encoded in smart contracts, with decisions made by token holders rather than a traditional board. AI agents are a natural fit for DAOs — they can execute the DAO's decisions autonomously.

But a DAO with ungoverned AI agents is a liability. The six-finger framework makes DAOs with AI agents viable by providing:

- **Accountability** — Every agent action is signed and ledgered. Token holders can audit everything.
- **Graduated autonomy** — Start with humans approving everything. As trust builds (measured by benchmarks, not feelings), increase autonomy.
- **Multi-signature authorization** — High-impact decisions require multiple agents and/or humans to co-sign.
- **Tamper-evidence** — The ledger proves the agents did what they said they did. No "the AI went rogue" without evidence.

### Who Is This For?

- **Agentic companies** — Businesses that want to run AI agents as employees, not just chatbots
- **DAOs** — Decentralized organizations that need governed AI execution
- **Managed service providers** — Companies offering "AI agent teams" to clients who need governance guarantees
- **Regulated industries** — Healthcare, finance, legal — anywhere "the AI did it" isn't an acceptable answer

---

## Part II: The Technical Roadmap

*For engineers, architects, and contributors who want to build this.*

### Standards Alignment

The Six Fingered Man builds on emerging open standards rather than inventing proprietary alternatives:

| Component | Standard | Why |
|-----------|----------|-----|
| Agent Identity | **W3C Decentralized Identifiers (DIDs)** — `did:key` method | Identity derived from Ed25519 keypair. No registry, no platform, no silo. Trivial to implement (it's a prefix format on existing keys). |
| Credentials | **W3C Verifiable Credentials (VCs)** | Permission contracts serialized as VCs. Interoperable with any VC-compatible system. |
| Agent Discovery | **IETF Agent Name Service (ANS)** draft | DNS-inspired directory for agent capabilities, keys, and endpoints. Protocol-agnostic. |
| On-chain Registry | **ERC-8004** (Ethereum) | Identity, Reputation, and Validation registries for trustless agent economies. Live on mainnet since Jan 2026. Interop target, not dependency. |
| Data Sovereignty | Inspired by **Solid Protocol** pods | Per-agent/per-tenant data stores with cryptographic access control. Not a direct Solid implementation, but the same architectural principle. |

### Architecture: The Six Isolation Layers

```
┌─────────────────────────────────────────────────────────────┐
│                    LAYER 6: SANDBOX                         │
│  World model simulation ∙ Behavioral SOC ∙ Model gating    │
│  Smart contract verification ∙ Red team validation          │
├─────────────────────────────────────────────────────────────┤
│                    LAYER 5: NETWORK                         │
│  Permission contracts (VCs) ∙ Communication Authority       │
│  Cross-agent message filtering ∙ Escalation chains          │
├─────────────────────────────────────────────────────────────┤
│                    LAYER 4: COMPUTE                         │
│  Container isolation ∙ GPU scheduling ∙ Resource quotas     │
│  Confidential compute (roadmap) ∙ Model pinning             │
├─────────────────────────────────────────────────────────────┤
│                    LAYER 3: DATA                            │
│  Separate Postgres schemas ∙ Encrypted vector stores        │
│  Redis namespaces ∙ Per-tenant encryption keys              │
├─────────────────────────────────────────────────────────────┤
│                    LAYER 2: LEDGER (CHAIN)                  │
│  Signed append-only log ∙ Merkle tree ∙ Hash chain          │
│  Optional public chain anchoring ∙ Per-tenant ledgers       │
├─────────────────────────────────────────────────────────────┤
│                    LAYER 1: IDENTITY                        │
│  W3C DIDs (did:key) ∙ Ed25519 keypairs ∙ DID Documents     │
│  Verifiable Credentials ∙ Multi-sig authorization           │
└─────────────────────────────────────────────────────────────┘
```

### Layer 1: Identity (DID-Based)

**Current state:** Ed25519 wallets in `auth-cli/` using @noble/ed25519.

**Target state:** W3C DID-compliant identities.

Every agent and human operator gets a `did:key` identifier derived from their Ed25519 public key:

```
did:key:z6Mkf5rGMoatrSj1f4CyvuHBeXJELe9RPdzo2PKGNCKVtZxP
```

This is a thin wrapper — the underlying crypto is identical to what we already have. The `did:key` method encodes the public key directly in the identifier, requiring no registry or blockchain.

**DID Document** (resolvable from the DID itself):
```json
{
  "@context": "https://www.w3.org/ns/did/v1",
  "id": "did:key:z6Mkf5rG...",
  "verificationMethod": [{
    "id": "did:key:z6Mkf5rG...#z6Mkf5rG...",
    "type": "Ed25519VerificationKey2020",
    "controller": "did:key:z6Mkf5rG...",
    "publicKeyMultibase": "z6Mkf5rG..."
  }],
  "authentication": ["did:key:z6Mkf5rG...#z6Mkf5rG..."],
  "assertionMethod": ["did:key:z6Mkf5rG...#z6Mkf5rG..."]
}
```

For tenants that want domain-verifiable identity, we also support `did:web`:
```
did:web:colleen-energy.com:agents:cfo
```
This resolves to a DID Document hosted at `https://colleen-energy.com/agents/cfo/did.json`.

**Implementation:**
- New module: `src/identity/did.ts` — DID generation, resolution, document creation
- Wraps existing @noble/ed25519 keypair generation
- Multibase/multicodec encoding per W3C DID spec
- `did:key` resolver (local, no network needed)
- `did:web` resolver (HTTP fetch of did.json)

### Layer 2: Ledger (Chain)

**Purpose:** Tamper-evident record of every significant action.

**Architecture:**
```
Entry N:
  ┌──────────────────────────────────┐
  │ id: uuid                         │
  │ timestamp: ISO 8601              │
  │ did: did:key:z6Mkf5rG...        │
  │ action: "delegation.create"      │
  │ payload: { ... }                 │
  │ prev_hash: sha256(Entry N-1)     │
  │ signature: Ed25519(Entry N)      │
  └──────────────────────────────────┘
        │
        ▼ sha256(Entry N) = next prev_hash
```

Each entry is signed by the acting agent's private key and includes the hash of the previous entry. Tampering with any entry breaks the chain from that point forward.

**Merkle tree** computed over blocks of entries (e.g., every 100 entries) for efficient verification:
```
         root_hash
        /          \
    h(0-49)      h(50-99)
    /    \        /    \
  h(0-24) h(25-49) h(50-74) h(75-99)
  ...
```

**Storage:** Postgres table with hash chain constraints. One ledger per tenant (hard isolation) or tagged entries per profit center (soft isolation).

**Optional chain anchoring:** The Merkle root can be periodically anchored to a public blockchain (NEAR, Ethereum, Cosmos) for external verifiability. This is a tenant-level configuration choice, not a platform requirement. The Verifiable Data Registry interface is abstract — backing store is swappable.

**Implementation:**
- `packages/governance/src/ledger.ts` — Append-only log with hash chain
- `packages/governance/src/merkle.ts` — Merkle tree computation
- `packages/governance/migrations/001-ledger.sql` — Postgres schema
- Interface: `IVerifiableDataRegistry` with `append()`, `verify()`, `getMerkleRoot()`, `anchorRoot()`

### Layer 3: Data Isolation

**Hard isolation (separate LLCs/tenants):**
- Separate Postgres schemas (`tenant_nerdplanet.*`, `tenant_colleen.*`)
- Separate Redis keyspaces (database numbers or key prefixes with ACLs)
- Separate vector store collections (per-tenant embedding namespaces)
- Separate encryption keys (per-tenant KMS or 1Password vault)

**Soft isolation (profit centers under one LLC):**
- Shared Postgres schema, row-level security policies keyed on `profit_center_id`
- Shared Redis with key prefixes
- Tagged ledger entries

**Implementation:**
- `packages/governance/src/tenants.ts` — Tenant CRUD, schema provisioning
- Postgres migration: `CREATE SCHEMA tenant_${name}; SET search_path TO tenant_${name};`
- Connection pooling per-tenant (pg-pool with schema switching)
- Encryption: envelope encryption with per-tenant data keys wrapped by tenant master key

### Layer 4: Compute Isolation

**Current state:** Agents share Ollama endpoints on GPU servers (Maximus/Tiberius/Claudius).

**POC (Phase 2):**
- Docker containers per agent with resource limits (`--gpus`, `--memory`, `--cpus`)
- Ollama model pinning: each agent assigned a specific model instance with keep-alive
- GPU scheduling: simple queue per server, priority by maturity level

**Production roadmap:**
- Confidential compute: AMD SEV-SNP or Intel TDX for memory encryption in transit
- Per-tenant GPU partitioning: NVIDIA MIG (Multi-Instance GPU) on supported hardware
- Model isolation: separate Ollama instances per tenant (not just per agent)

**Model change management:**
This is a critical and underappreciated problem. Changing the model powering an agent changes the agent's behavior — even with identical prompts and RAG context. A model update is functionally equivalent to replacing an employee.

Protocol for model changes:
1. **Benchmark before:** Run the agent through its benchmark suite on the current model. Record baseline.
2. **Shadow mode:** Run the new model in parallel, processing the same inputs, but without executing actions.
3. **Benchmark after:** Run the same benchmark suite on the new model. Compare.
4. **Diff report:** Generate a human-readable comparison: response quality, task completion rate, tone drift, latency changes.
5. **Human approval gate:** Model change requires human sign-off based on the diff report.
6. **Rollback window:** 48-hour automatic rollback trigger if post-deployment benchmarks degrade past threshold.

### Layer 5: Network Isolation

**Permission contracts** are the core primitive. Every cross-agent interaction requires an active, non-expired, correctly-scoped permission contract.

**Contract structure (as a Verifiable Credential):**
```json
{
  "@context": ["https://www.w3.org/2018/credentials/v1"],
  "type": ["VerifiableCredential", "PermissionContract"],
  "issuer": "did:key:z6Mkf... (human operator or authorized agent)",
  "issuanceDate": "2026-02-16T00:00:00Z",
  "expirationDate": "2026-02-17T00:00:00Z",
  "credentialSubject": {
    "id": "did:key:z6Mkr... (agent receiving permission)",
    "scope": "delegate:research",
    "actions": ["sessions_send", "sessions_history"],
    "constraints": {
      "target_agents": ["did:key:z6Mks... (research agent)"],
      "max_messages_per_hour": 20,
      "content_policy": "professional"
    }
  },
  "proof": {
    "type": "Ed25519Signature2020",
    "verificationMethod": "did:key:z6Mkf...#z6Mkf...",
    "proofValue": "z3FXQqFZ..."
  }
}
```

**Communication Authority** — an OpenClaw skill that wraps `sessions_send`:
1. Agent A calls `sessions_send` to message Agent B
2. Communication Authority intercepts
3. Checks: Does Agent A have an active, non-expired permission contract that covers this target and action?
4. If yes: pass through, log to ledger
5. If no: block, log denial to ledger, emit SOC event, return DENIED

**Escalation chains:**
- Signal (primary, E2E encrypted) → SMS (Twilio, timeout-triggered) → All operators → DevSOC freeze
- Configurable timeouts per maturity level and action severity
- Every escalation step logged to ledger

### Layer 6: Sandbox & Simulation

This is the most forward-looking layer. Three components:

**6a. Behavioral SOC (Security Operations Center)**

Three detection tiers:
1. **Rule-based:** Static rules (e.g., "no agent may publish external content without human approval")
2. **Statistical:** Anomaly detection on agent behavior patterns (message frequency, unusual targets, off-hours activity)
3. **LLM-powered:** A dedicated "security agent" that reviews other agents' proposed actions and flags concerns

SOC alerts are severity-coded: INFO → WARN → CRITICAL → FREEZE.
FREEZE halts the agent and requires human intervention to resume.

**6b. World Model Simulation**

For high-impact actions, run a simulation before execution:
1. Agent proposes action (e.g., "publish blog post")
2. System creates a sandboxed copy of the relevant state
3. Action is executed in the sandbox
4. Outcomes are evaluated against safety criteria
5. If safe: execute for real. If unsafe: block, alert human.

This is computationally expensive and not required for routine actions. Applied selectively based on action type and maturity level.

**6c. Smart Contract Verification**

When an agent completes a task defined by a permission contract (VC), the system verifies:
- Was the task completed within the contract's time bounds?
- Did the output match the contract's scope constraints?
- Were the contract's content policies respected?
- Did the agent stay within its resource allocation?

Verification results are recorded on the ledger. A history of clean completions contributes to maturity model progression.

**Model Gating (part of Layer 4, enforced here):**
- Every model change triggers a benchmark suite
- Results compared against baseline
- Regression beyond threshold → automatic rollback
- Progression beyond threshold → candidate for maturity upgrade

### Multi-Tenant Data Model

**Tenant types:**

| Type | Isolation | Example |
|------|-----------|---------|
| **Hard (separate LLC)** | Own schema, own ledger, own wallets, own agent roster | Colleen Energy LLC — entirely separate entity |
| **Soft (profit center)** | Shared infra, separate agent rosters, tagged ledger entries | NerdPlanet (Black Hole Registry + Politichole) — same company, separate projects |

**Tenant provisioning flow:**
1. Create tenant record (name, type, maturity level, operator DIDs)
2. Generate DID keypairs for each agent in the roster
3. Create Postgres schema (hard) or RLS policies (soft)
4. Generate OpenClaw workspace from template (IDENTITY.md, SOUL.md, AGENTS.md per agent)
5. Create standing permission contracts for the agent roster
6. Initialize ledger with genesis entry (signed by provisioning operator)

### Agent Meetings & Benchmarks

**Meeting types** (scheduled via cron):
- **Daily standup:** Each agent reports status, blockers, plans. CEO synthesizes. (~5 min)
- **Planning session:** CEO proposes priorities. Agents assess feasibility. Humans observe/vote.
- **Retrospective:** Review completed work. Flag process improvements. Propose skill additions.
- **Board meeting:** Agents present to human partners. Performance metrics, recommendations, Q&A.

Meetings are structured `sessions_send` exchanges. All artifacts (agendas, minutes, action items, decisions) recorded on the ledger.

**Benchmarks track:**
- Task completion rate (per agent)
- Validation pass rate (COO review accuracy)
- Response time (prompt-to-completion)
- Token efficiency (output quality per token spent)
- Human feedback scores (from governance votes)
- Skill proficiency (tracked over time)

Benchmark reports generated for board meetings and maturity model evaluation.

**RLHF caveat:** What we call "RLHF" in Phase 2 is governance feedback informing prompt and skill updates — not actual model weight updates via reinforcement learning. True RLHF requires model fine-tuning infrastructure, which is Phase 3+. We are honest about this distinction.

### Communication Architecture

**Primary: Signal** (end-to-end encrypted)
- signal-cli subprocess integration (existing OpenClaw extension)
- Structured message templates for approval requests
- Human response parsing: APPROVE / REJECT / ESCALATE
- Watchdog for stability (signal-cli can be flaky)

**Fallback: Twilio SMS**
- Timeout-triggered (configurable per function, default 5 min)
- Escalation chain: primary operator → secondary → all operators → DevSOC freeze
- All escalation steps logged to ledger

**Dashboard: Real-time WebSocket**
- Permission contracts panel (active contracts, TTL countdown)
- Ledger feed (recent entries with hash chain verification)
- SOC alerts (severity-coded)
- Agent org chart with communication paths (blocked paths shown)
- Meeting transcripts
- Benchmark panels per agent

### Implementation Roadmap

Each step produces a testable artifact. Steps can run in parallel where dependencies allow.

```
Step 0: This Document
  │
  ├── Step 1: Identity (DIDs)
  │     └── did:key generation, DID Documents, VC signing
  │           │
  │           ├── Step 2: Ledger
  │           │     └── Signed append-only log, Merkle tree, Postgres schema
  │           │           │
  │           │           ├── Step 3: Permission Contracts (as VCs)
  │           │           │     └── Create/check/revoke, Communication Authority skill
  │           │           │           │
  │           │           │           ├── Step 5: Dashboard Governance Panels
  │           │           │           │     └── Contracts, ledger, SOC, benchmarks
  │           │           │           │
  │           │           │           ├── Step 6: Meetings
  │           │           │           │     └── Scheduler, templates, artifact generation
  │           │           │           │
  │           │           │           └── Step 7: Benchmarks
  │           │           │                 └── Metrics collection, reports, performance gates
  │           │           │
  │           │           └── Step 8: Tenant Management
  │           │                 └── Multi-tenant provisioning, isolation verification
  │           │
  │           └── Step 4: Signal + Twilio
  │                 └── Notifications, escalation chains
  │
  └── Step 9: Demo Assembly
        └── End-to-end scenario, board meeting demo
```

| Step | Deliverable | Test Criteria | Dependencies |
|------|-------------|---------------|--------------|
| 0 | This document | Reviewed, approved | None |
| 1 | DID identity module | Generate did:key, resolve, create DID Document | 0 |
| 2 | Ledger service | Append entry, verify chain, compute Merkle root | 1 |
| 3 | Permission contracts | Create VC, verify, expire, Communication Authority blocks unauthorized | 1, 2 |
| 4 | Signal + Twilio | Approval notification → human response → action | 0 |
| 5 | Dashboard panels | Real-time contracts, ledger, SOC, org chart updates | 3 |
| 6 | Scheduled meetings | Standup runs, all agents report, minutes generated | 3 |
| 7 | Benchmarks | 10 tasks tracked, report generated, metrics accurate | 3 |
| 8 | Tenant management | Two tenants created, isolated schemas, separate ledgers | 2 |
| 9 | Demo assembly | Full blog-post scenario + board meeting runs end-to-end | All |

**Parallelism:** Steps 4 (Signal/Twilio) can run alongside 2-3 (ledger/contracts). Steps 5-7 can run in parallel after step 3.

### Interoperability Targets

These are not dependencies — they are standards we align with so that Six Fingered Man agents can interoperate with the broader ecosystem:

- **ERC-8004** — Our agent DIDs can be registered in ERC-8004's Identity Registry. Our benchmark data can feed its Reputation Registry. Our sandbox results can be posted to its Validation Registry. This is optional and per-tenant.
- **IETF ANS** — Our DID Documents can be discoverable via Agent Name Service resolution. This enables cross-platform agent discovery.
- **A2A / ACP** — OpenClaw already supports Agent-to-Agent and Agent Communication Protocol. Our Permission Contracts add a governance layer on top of these existing protocols.

### Known Caveats & Risks

**Local LLM quality:** 14B-70B parameter models are capable but not frontier-model level. Agent persona adherence requires significant prompt engineering. Benchmark early and often. For board meetings and high-stakes interactions, consider API fallback to frontier models (Claude, GPT-4).

**Ollama cold-start:** 70B models on Maximus have ~30s cold-start time. Keep-alive tuning is critical for interactive sessions. Meetings should pre-warm models.

**Multi-tenant GPU contention:** Multiple tenants sharing GPU servers need scheduling. Phase 2 POC runs single-tenant. Multi-tenant GPU scheduling is a Phase 3 concern.

**Signal stability:** signal-cli can be flaky under load. Requires watchdog/health monitoring. This is a known issue in the OpenClaw community.

**Software enforcement:** Permission contract enforcement runs at the OpenClaw skill layer — software, not hardware. An agent with direct model access could theoretically bypass it. Mitigation: network-level isolation (Layer 5) + behavioral SOC monitoring (Layer 6). Full hardware enforcement requires confidential compute (Phase 3+).

**"RLHF" is not RLHF:** Phase 2 governance feedback informs prompt/skill updates, not actual model weight updates. True RLHF requires fine-tuning infrastructure. Be honest about this distinction with partners and investors.

**Meeting quality:** Agent "meetings" are structured multi-turn exchanges. Quality depends entirely on model reasoning capability. Board meetings with partners may need frontier model fallback.

**Model change risk:** This is the sleeper risk. A routine model update (e.g., Ollama pulls a new quantization of the same model) can silently change agent behavior. The model gating protocol in Layer 4/6 is designed to catch this, but it requires discipline and comprehensive benchmark suites.

### Relationship to OpenClaw

The Six Fingered Man is a **fork of OpenClaw** — the open-source, local-first AI agent platform. We inherit:

- Multi-channel messaging (WhatsApp, Signal, Telegram, Slack, Discord, 37+ channels)
- Agent workspaces and routing
- Skills/tools framework
- Gateway control plane (WebSocket-based)
- Plugin SDK and extension system
- CLI and desktop/mobile apps

We add:
- The six isolation layers (identity, ledger, data, compute, network, sandbox)
- Governance maturity model
- Permission contracts as Verifiable Credentials
- Behavioral SOC
- Multi-tenant management
- Scheduled meetings and benchmarks
- Model change management

Our intent is to contribute governance primitives back to OpenClaw as the framework matures. The fork exists to move fast on governance without requiring upstream consensus on every architectural decision, while maintaining the ability to merge upstream improvements.

### Project Structure

```
the-six-fingered-man/                    # Fork of openclaw/openclaw
├── [all existing openclaw code]         # Inherited from upstream
│
├── docs/governance/                     # NEW — governance documentation
│   └── the-six-fingers.md              # This document
│
├── packages/governance/                 # NEW — governance service
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── identity/
│   │   │   ├── did.ts                  # W3C DID (did:key, did:web)
│   │   │   └── vc.ts                   # Verifiable Credential creation/verification
│   │   ├── ledger.ts                   # Signed append-only ledger
│   │   ├── merkle.ts                   # Merkle tree for tamper evidence
│   │   ├── contracts.ts               # Permission contract CRUD
│   │   ├── tenants.ts                 # Multi-tenant management
│   │   ├── benchmarks.ts             # Agent performance metrics
│   │   ├── soc.ts                     # Behavioral SOC
│   │   └── types.ts                   # Shared governance types
│   └── migrations/
│       ├── 001-identity.sql           # DID registry tables
│       ├── 002-ledger.sql             # Append-only ledger
│       ├── 003-contracts.sql          # Permission contracts
│       └── 004-tenants.sql            # Multi-tenant schemas
│
├── extensions/governance/              # NEW — governance extension for OpenClaw
│   ├── package.json
│   ├── openclaw.plugin.json
│   └── src/
│       └── communication-authority.ts  # Cross-agent permission enforcement
│
├── skills/governance/                  # NEW — governance skills
│   └── SKILL.md                       # Permission contract management
│
├── skills/meetings/                    # NEW — meeting skills
│   └── SKILL.md                       # Scheduled meetings
│
├── skills/escalation/                  # NEW — escalation skills
│   └── SKILL.md                       # Signal/Twilio escalation
│
├── dem/                                # NEW — governance-specific assets
│   ├── auth-cli/                      # Ed25519 wallet CLI (from diabolus-ex-machina)
│   ├── dashboard/                     # Governance dashboard (Next.js, from d-e-m)
│   ├── agent-workspaces/              # Agent workspace templates
│   └── docs/                          # Original design docs (from d-e-m)
│
└── pnpm-workspace.yaml                # MODIFIED — add packages/governance
```

---

*The Six Fingered Man: Because trust isn't given — it's proven, layer by layer.*

*A Left Hand Security project. Fork of OpenClaw. MIT License.*
