# Web3 Agentic Ecosystem with DAO Governance

## Why NEAR is the Right Choice for Diabolus

After research, NEAR Protocol is exceptionally well-positioned for what you're building. Here's why:

### 1. Native AI Agent Infrastructure
NEAR has explicitly positioned itself as "The Blockchain for AI" with purpose-built infrastructure:

- **[Shade Agents](https://pages.near.org/blog/shade-agents-the-first-truly-autonomous-ai-agents/)**: Truly autonomous AI agents with:
  - TEE (Trusted Execution Environment) verification
  - Multi-chain key management via Chain Signatures
  - On-chain code verification
  - No single points of failure

- **[NEAR Intents](https://pages.near.org/blog/introducing-near-intents/)**: A new transaction type allowing AI agents to exchange information, assets, and services with users and other agents

- **[NEAR AI Agent Studio](https://github.com/near-horizon/near-ai-agent-studio)**: Production-ready starter kit for building AI agents and multi-agent swarms

### 2. Native DAO Infrastructure
- **[Sputnik DAO V2](https://github.com/near-daos/sputnik-dao-contract)**: Battle-tested DAO framework
- **[AstroDAO](https://app.astrodao.com)**: UI for Sputnik DAOs
- AI-powered governance delegates in development (voting on behalf of members)

### 3. Technical Advantages
- Human-readable account names (e.g., `meatus.near`, `agent-001.meatus.near`)
- Built-in account abstraction
- Low fees (~$0.001 per transaction)
- Fast finality (~1-2 seconds)
- Targeting 1M TPS by end of 2025

---

## Meatus Architecture on NEAR

```
┌─────────────────────────────────────────────────────────────────────┐
│                        WEB2 FRONTEND                                │
│                   (React/Next.js Application)                       │
│         Accepts USD/Crypto payments, user dashboard                 │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     PAYMENT GATEWAY API                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │ Stripe/Fiat │  │ Crypto Rails│  │  DEX Swap   │                 │
│  │   (USD)     │  │ (BTC, ETH)  │  │(to USDC/NEAR)│                │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                 │
│         └────────────────┼────────────────┘                         │
│                          ▼                                          │
│              Unified: NEAR / USDC on NEAR                           │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      MEATUS DAO                                     │
│                  (Sputnik DAO V2 Contract)                          │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Treasury: meatus-dao.near                                    │   │
│  │ - Holds customer payments                                    │   │
│  │ - Funds agent wallets per job                                │   │
│  │ - Distributes rewards to data providers                      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Governance:                                                  │   │
│  │ - Approve new agent types                                    │   │
│  │ - Set pricing policies                                       │   │
│  │ - Vote on data source integrations                           │   │
│  │ - Upgrade agent contracts                                    │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   ORCHESTRATOR AGENT                                │
│              orchestrator.meatus-dao.near                           │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Responsibilities:                                            │   │
│  │ 1. Receives job request + payment confirmation               │   │
│  │ 2. Confirms scope with user                                  │   │
│  │ 3. Calculates required agents + costs                        │   │
│  │ 4. Spawns specialized agents with funded wallets             │   │
│  │ 5. Aggregates results                                        │   │
│  │ 6. Returns findings to user                                  │   │
│  │ 7. Settles payments to data providers                        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Smart Contract Parameters:                                         │
│  - max_execution_time: 3600 (seconds)                              │
│  - max_agent_spawn: 10                                             │
│  - min_payment: 5 USDC                                             │
│  - result_delivery: "encrypted_ipfs" | "direct"                    │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  SPECIALIZED AGENTS                                 │
│                                                                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐     │
│  │ breach-scanner  │  │ osint-collector │  │ threat-monitor  │     │
│  │ .meatus-dao.near│  │ .meatus-dao.near│  │ .meatus-dao.near│     │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘     │
│           │                    │                    │               │
│           └────────────────────┼────────────────────┘               │
│                                ▼                                    │
│                    Each agent has:                                  │
│                    - Own NEAR wallet (sub-account)                  │
│                    - TEE-verified code (Shade Agent)                │
│                    - Defined smart contract constraints             │
│                    - Budget allocation from orchestrator            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## The "Quarter in the Arcade" Flow

```
1. USER: "I want to check if my email has been breached"
   └─> Pays $10 via Stripe or sends 10 USDC

2. PAYMENT GATEWAY:
   └─> Converts to USDC on NEAR (if needed)
   └─> Deposits to meatus-dao.near treasury
   └─> Emits JobCreated event with job_id

3. ORCHESTRATOR AGENT (wakes up):
   └─> Reads job parameters from contract
   └─> Confirms with user: "I'll scan email@example.com across
       breach databases. Estimated: 3 sources, ~2 min. Proceed?"

4. USER: "Yes"
   └─> Orchestrator receives confirmation

5. ORCHESTRATOR:
   └─> Spawns breach-scanner.meatus-dao.near
   └─> Allocates 8 USDC to agent wallet (keeps 2 for overhead)
   └─> Sets contract: max_time=120s, sources=["hibp", "leakcheck", "dehashed"]

6. BREACH-SCANNER AGENT:
   └─> Queries data sources
   └─> Pays data providers from its wallet (per-query fees)
   └─> Returns results to orchestrator
   └─> Remaining balance returns to treasury

7. ORCHESTRATOR:
   └─> Aggregates findings
   └─> Encrypts with user's public key
   └─> Stores on IPFS, returns link to user
   └─> Marks job complete on-chain

8. USER:
   └─> Downloads and decrypts results
   └─> (Optional) Tips the DAO for good service
```

---

## Smart Contract Structure

### 1. Meatus DAO Contract (Sputnik V2)
```rust
// Extends Sputnik DAO V2 with agent management
pub struct MeatusDAO {
    // Standard Sputnik fields
    policy: Policy,
    proposals: LookupMap<u64, Proposal>,

    // Meatus-specific
    registered_agents: UnorderedMap<AccountId, AgentConfig>,
    active_jobs: LookupMap<JobId, Job>,
    pricing: PricingPolicy,
}

pub struct AgentConfig {
    agent_type: AgentType,
    code_hash: CryptoHash,      // TEE verification
    max_budget_per_job: Balance,
    capabilities: Vec<Capability>,
    status: AgentStatus,
}

pub struct Job {
    id: JobId,
    customer: AccountId,
    payment: Balance,
    status: JobStatus,
    assigned_agents: Vec<AccountId>,
    results_cid: Option<String>,  // IPFS CID
    created_at: Timestamp,
    completed_at: Option<Timestamp>,
}
```

### 2. Orchestrator Agent Contract
```rust
pub struct OrchestratorAgent {
    dao: AccountId,              // meatus-dao.near
    pending_jobs: Vec<JobId>,
    active_agents: UnorderedMap<JobId, Vec<AccountId>>,
}

impl OrchestratorAgent {
    pub fn process_job(&mut self, job_id: JobId) -> Promise {
        // 1. Fetch job details from DAO
        // 2. Determine required agents
        // 3. Spawn agents with budgets
        // 4. Monitor completion
        // 5. Aggregate and deliver results
    }
}
```

### 3. Specialized Agent Contract Template
```rust
pub struct InvestigationAgent {
    orchestrator: AccountId,
    job_id: JobId,
    budget: Balance,
    constraints: AgentConstraints,
    data_sources: Vec<DataSource>,
}

pub struct AgentConstraints {
    max_execution_time: Duration,
    max_queries: u32,
    allowed_sources: Vec<String>,
    result_format: ResultFormat,
}
```

---

## Learning Path: Building This System

### Phase 1: NEAR Fundamentals (Week 1-2)
1. Set up NEAR development environment
2. Create testnet accounts
3. Deploy a basic smart contract (Rust)
4. Interact with Sputnik DAO V2
5. Create your own DAO on testnet

### Phase 2: Agent Architecture (Week 3-4)
1. Clone and run [NEAR AI Agent Studio](https://github.com/near-horizon/near-ai-agent-studio)
2. Build a simple agent that:
   - Has a NEAR wallet
   - Can receive instructions via contract
   - Can make payments
   - Can return results
3. Understand Shade Agent TEE verification

### Phase 3: DAO + Agent Integration (Week 5-6)
1. Extend Sputnik DAO with agent registry
2. Build orchestrator agent
3. Implement job creation and payment flow
4. Build first specialized agent (breach scanner)

### Phase 4: Web2 Frontend + Payments (Week 7-8)
1. Build Next.js frontend
2. Integrate Stripe for fiat
3. Integrate NEAR wallet for crypto
4. Build payment conversion layer

---

## Key Resources

- [NEAR AI Agent Studio](https://github.com/near-horizon/near-ai-agent-studio) - Start here for agents
- [Sputnik DAO V2](https://github.com/near-daos/sputnik-dao-contract) - DAO smart contracts
- [NEAR Documentation](https://docs.near.org) - Official docs
- [Shade Agents Blog](https://pages.near.org/blog/shade-agents-the-first-truly-autonomous-ai-agents/) - Autonomous agent architecture
- [NEAR Intents](https://pages.near.org/blog/introducing-near-intents/) - Agent-to-agent transactions

---

## Alternatives Considered

| Platform | Pros | Cons | Verdict |
|----------|------|------|---------|
| **NEAR** | Native AI agent infra, human-readable accounts, low fees, Sputnik DAO | Smaller ecosystem than ETH | **Best fit** |
| **Ethereum L2s** | Largest ecosystem, most tooling | Higher complexity, no native agent support | Good for token liquidity |
| **Solana** | Fast, cheap | No native DAO framework, complex account model | Not ideal for DAO-first |
| **Cosmos** | IBC interoperability | Fragmented, would need custom DAO | Overkill for this use case |

---

## Next Steps

1. **Set up NEAR testnet environment**
2. **Deploy a test DAO using Sputnik V2**
3. **Run the NEAR AI Agent Studio examples**
4. **Build a minimal "hello world" agent that receives a job and returns a result**

Ready to start with any of these?
