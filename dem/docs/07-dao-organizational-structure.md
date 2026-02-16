# DAO Organizational Structure: Agents as Executives

## Core Insight

A DAO is not just a treasury with voting - it's an **organization**. In Meatus, agents don't just use the DAO, they **ARE** the organization:

- Agents hold executive roles (CEO, Treasurer)
- Agents have multisig authority
- Humans receive payments but agents execute
- Partners can join and offer services (B2B model)

---

## Organizational Chart

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MEATUS DAO                                        │
│                    meatus-dao.sputnikv2.near                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     GOVERNANCE LAYER                                 │   │
│  │                     (Human Oversight)                                │   │
│  │                                                                      │   │
│  │  Founders/Council (Humans)                                          │   │
│  │  - Set policy, approve major changes                                │   │
│  │  - Vetting/onboarding of partner agents                             │   │
│  │  - Emergency override capability                                    │   │
│  │  - Profit distribution recipients                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     EXECUTIVE LAYER                                  │   │
│  │                     (Agent Officers)                                 │   │
│  │                                                                      │   │
│  │  ┌───────────────────────┐    ┌───────────────────────┐             │   │
│  │  │ ORCHESTRATOR AGENT    │    │ TREASURER AGENT       │             │   │
│  │  │ (Chief Execution      │    │ (Chief Financial      │             │   │
│  │  │  Officer)             │    │  Officer)             │             │   │
│  │  │                       │    │                       │             │   │
│  │  │ • Accepts payments    │    │ • Manages treasury    │             │   │
│  │  │ • Coordinates workers │    │ • Tracks revenue/cost │             │   │
│  │  │ • Assigns jobs        │    │ • Executes payouts    │             │   │
│  │  │ • Quality control     │    │ • Financial reporting │             │   │
│  │  │                       │    │ • Budget enforcement  │             │   │
│  │  │ Wallet: multisig 1/2  │    │ Wallet: multisig 1/2  │             │   │
│  │  └───────────────────────┘    └───────────────────────┘             │   │
│  │                                                                      │   │
│  │  Together: 2-of-2 for large transactions                            │   │
│  │  Either alone: small operational transactions                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     WORKER LAYER                                     │   │
│  │                                                                      │   │
│  │  INTERNAL WORKERS (Owned by DAO)                                    │   │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │   │
│  │  │ Breach      │ │ OSINT       │ │ Criminal    │ │ Social      │   │   │
│  │  │ Scanner     │ │ Collector   │ │ Records     │ │ Analyzer    │   │   │
│  │  │ Agent       │ │ Agent       │ │ Agent       │ │ Agent       │   │   │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘   │   │
│  │                                                                      │   │
│  │  • Not DAO members (no voting rights)                               │   │
│  │  • Receive task allocation from Orchestrator                        │   │
│  │  • Have limited wallets (budget per job)                            │   │
│  │  • Report results back to Orchestrator                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     PARTNER LAYER                                    │   │
│  │                     (B2B / App Store Model)                          │   │
│  │                                                                      │   │
│  │  PARTNER AGENTS (External, Vetted)                                  │   │
│  │  ┌─────────────────────────────────────────────────────────────┐    │   │
│  │  │ Partner DAO: dark-web-intel.sputnikv2.near                  │    │   │
│  │  │                                                              │    │   │
│  │  │ Services Offered:                                            │    │   │
│  │  │ • Premium dark web data feeds                                │    │   │
│  │  │ • Real-time breach monitoring                                │    │   │
│  │  │                                                              │    │   │
│  │  │ Revenue Split:                                               │    │   │
│  │  │ • 70% → Partner DAO                                          │    │   │
│  │  │ • 30% → Meatus DAO (platform fee)                            │    │   │
│  │  │                                                              │    │   │
│  │  │ Vetting Status: ✅ Approved by Council                       │    │   │
│  │  └─────────────────────────────────────────────────────────────┘    │   │
│  │                                                                      │   │
│  │  ┌─────────────────────────────────────────────────────────────┐    │   │
│  │  │ Partner DAO: credit-bureau-api.sputnikv2.near               │    │   │
│  │  │                                                              │    │   │
│  │  │ Services Offered:                                            │    │   │
│  │  │ • Credit header data                                         │    │   │
│  │  │ • Financial risk scoring                                     │    │   │
│  │  │                                                              │    │   │
│  │  │ Revenue Split: 70/30                                         │    │   │
│  │  │ Vetting Status: ✅ Approved by Council                       │    │   │
│  │  └─────────────────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     HUMAN MEMBERS                                    │   │
│  │                     (Wallets with Voting + Payouts)                  │   │
│  │                                                                      │   │
│  │  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐       │   │
│  │  │ Founder 1       │ │ Founder 2       │ │ Infra Provider  │       │   │
│  │  │                 │ │                 │ │                 │       │   │
│  │  │ Provides:       │ │ Provides:       │ │ Provides:       │       │   │
│  │  │ • Capital       │ │ • Capital       │ │ • GPU cluster   │       │   │
│  │  │ • Governance    │ │ • Expertise     │ │ • API hosting   │       │   │
│  │  │                 │ │                 │ │ • Databases     │       │   │
│  │  │ Receives:       │ │ Receives:       │ │                 │       │   │
│  │  │ • Profit share  │ │ • Profit share  │ │ Receives:       │       │   │
│  │  │ • Voting rights │ │ • Voting rights │ │ • Infra fees    │       │   │
│  │  │                 │ │                 │ │ • Profit share  │       │   │
│  │  │                 │ │                 │ │ • Voting rights │       │   │
│  │  └─────────────────┘ └─────────────────┘ └─────────────────┘       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Role Definitions

### Orchestrator Agent (CEO)

**Identity:** `orchestrator.meatus-dao.near`

**Responsibilities:**
- Accept and validate incoming payments
- Parse customer requests
- Coordinate worker agents
- Assign jobs based on requirements
- Aggregate results from workers
- Quality control before delivery
- Customer communication

**Wallet Authority:**
- Can spend up to X NEAR per transaction autonomously
- Requires Treasurer co-sign for amounts > X
- Can create worker agent wallets
- Can pay partner agents for services

**DAO Role:** `executive` (not `council`)
- Cannot vote on governance
- Can execute operational transactions
- Can call approved contract methods

### Treasurer Agent (CFO)

**Identity:** `treasurer.meatus-dao.near`

**Responsibilities:**
- Track all revenue and expenses
- Manage treasury balance
- Execute scheduled payouts to humans
- Financial reporting
- Budget enforcement (prevent overspend)
- Partner revenue share calculations
- Audit trail maintenance

**Wallet Authority:**
- Can spend up to X NEAR autonomously
- Requires Orchestrator co-sign for amounts > X
- Executes profit distribution to founders
- Holds reserve funds

**DAO Role:** `executive`
- Cannot vote on governance
- Can execute financial transactions
- Can query all financial contract methods

### Worker Agents (Employees)

**Identity:** `worker-001.meatus-dao.near`, etc.

**Responsibilities:**
- Execute specific investigation tasks
- Query data sources
- Return structured results
- Report costs incurred

**Wallet Authority:**
- Receive per-job budget from Orchestrator
- Can only spend on approved data sources
- Return unused funds

**DAO Role:** None
- Not DAO members
- No voting rights
- Controlled by Orchestrator

### Partner Agents (B2B)

**Identity:** Their own DAO, e.g., `partner.sputnikv2.near`

**Responsibilities:**
- Offer specialized services
- Maintain their own infrastructure
- Deliver data/results via API or contract

**Revenue Model:**
```
Customer pays $100 for investigation
├── $40 goes to Partner for dark web data
│   ├── $28 (70%) → Partner DAO
│   └── $12 (30%) → Meatus DAO (platform fee)
└── $60 handled internally by Meatus
```

**Vetting Process:**
1. Partner applies to join ecosystem
2. Council reviews capabilities, security, reputation
3. Council votes to approve/reject
4. If approved, Partner added to approved registry
5. Orchestrator can now route work to Partner
6. Ongoing quality monitoring

**DAO Role:** `partner`
- Can receive payments from Meatus DAO
- Can be removed by Council vote
- Subject to SLA enforcement

### Human Members (Governance + Infrastructure)

**Identity:** `founder1.near`, `infra-provider.near`, etc.

**What Humans Provide:**
- **Governance**: Voting rights, policy decisions, oversight
- **Infrastructure**: Servers, GPUs, API access, data feeds
- **Capital**: Initial funding, ongoing investment
- **Expertise**: Domain knowledge, compliance guidance

**Payout Types:**
```
Human Wallet
├── Profit Share (equity-like)
│   └── % of net revenue after costs
│
├── Infrastructure Fees (service-like)
│   └── Payment for compute, storage, APIs provided
│
└── Bounties (task-like)
    └── One-time payments for specific contributions
```

**Example: Infrastructure Provider**
```
infra-provider.near provides:
- GPU cluster for AI inference
- API gateway hosting
- Database infrastructure

Receives:
- $X/month infrastructure fee (cost-based)
- Y% profit share (equity-based)
- Voting rights on infrastructure decisions
```

**DAO Role:** `council`
- Full voting rights
- Can propose any action
- Multisig threshold (e.g., 2-of-3)
- Can override agent decisions (emergency)

---

## Multisig Configuration

### Operational Transactions (Day-to-Day)

```
Transaction Type          | Required Signatures
--------------------------|--------------------
Small payment (<$100)     | Orchestrator OR Treasurer (1 of 2)
Medium payment ($100-1k)  | Orchestrator AND Treasurer (2 of 2)
Large payment (>$1k)      | Orchestrator + Treasurer + 1 Council (3 of 4)
```

### Governance Transactions

```
Transaction Type          | Required Signatures
--------------------------|--------------------
Add worker agent          | Orchestrator (1 of 1, operational)
Add partner agent         | Council 2-of-3 (governance)
Remove partner agent      | Council 2-of-3 (governance)
Change revenue split      | Council 3-of-3 (unanimous)
Upgrade contracts         | Council 3-of-3 (unanimous)
Emergency shutdown        | Any 1 Council (emergency)
```

---

## Sputnik DAO Role Configuration

```json
{
  "policy": {
    "roles": [
      {
        "name": "council",
        "kind": {
          "Group": [
            "founder1.near",
            "founder2.near",
            "founder3.near"
          ]
        },
        "permissions": ["*:*"],
        "vote_policy": {
          "*:*": {
            "weight_kind": "RoleWeight",
            "quorum": "0",
            "threshold": [2, 3]
          }
        }
      },
      {
        "name": "executive",
        "kind": {
          "Group": [
            "orchestrator.meatus-dao.near",
            "treasurer.meatus-dao.near"
          ]
        },
        "permissions": [
          "call:create_job",
          "call:complete_job",
          "call:pay_worker",
          "call:pay_partner",
          "transfer:*"
        ],
        "vote_policy": {
          "transfer:*": {
            "weight_kind": "RoleWeight",
            "quorum": "0",
            "threshold": [2, 2]
          }
        }
      },
      {
        "name": "partner",
        "kind": {
          "Group": []
        },
        "permissions": [
          "call:submit_result",
          "call:claim_payment"
        ],
        "vote_policy": {}
      }
    ],
    "default_vote_policy": {
      "weight_kind": "RoleWeight",
      "quorum": "0",
      "threshold": [2, 3]
    },
    "proposal_bond": "100000000000000000000000",
    "proposal_period": "604800000000000",
    "bounty_bond": "100000000000000000000000",
    "bounty_forgiveness_period": "604800000000000"
  }
}
```

---

## Payment Flow with Roles

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 1: Customer Payment                                                    │
│                                                                             │
│   Customer pays $100 → Meatus DAO Treasury                                 │
│                                                                             │
│   Orchestrator Agent detects payment, creates job                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 2: Job Execution                                                       │
│                                                                             │
│   Orchestrator analyzes request:                                           │
│   - Needs breach data (Worker Agent)                                       │
│   - Needs dark web intel (Partner Agent)                                   │
│   - Needs criminal records (Worker Agent)                                  │
│                                                                             │
│   Orchestrator allocates budget:                                           │
│   - $20 to Breach Scanner Worker                                           │
│   - $40 to Dark Web Intel Partner                                          │
│   - $15 to Criminal Records Worker                                         │
│   - $25 reserved (profit + overhead)                                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 3: Worker Execution                                                    │
│                                                                             │
│   Breach Scanner:                                                          │
│   - Receives $20 budget                                                    │
│   - Spends $15 on API calls                                                │
│   - Returns results + $5 unused                                            │
│                                                                             │
│   Criminal Records:                                                        │
│   - Receives $15 budget                                                    │
│   - Spends $12 on queries                                                  │
│   - Returns results + $3 unused                                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 4: Partner Execution                                                   │
│                                                                             │
│   Dark Web Intel Partner:                                                  │
│   - Receives request from Orchestrator                                     │
│   - Executes their own agents                                              │
│   - Returns results                                                        │
│                                                                             │
│   Payment: $40 total                                                       │
│   - $28 (70%) → Partner DAO                                                │
│   - $12 (30%) → Meatus DAO (platform fee)                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 5: Result Aggregation                                                  │
│                                                                             │
│   Orchestrator:                                                            │
│   - Collects all results                                                   │
│   - Validates completeness                                                 │
│   - Generates final report                                                 │
│   - Delivers to customer                                                   │
│   - Marks job complete                                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ STEP 6: Financial Settlement (Treasurer)                                    │
│                                                                             │
│   Revenue: $100                                                            │
│   Expenses:                                                                │
│   - Worker costs: $27 ($15 + $12)                                          │
│   - Partner payment: $28 (70% of $40)                                      │
│   - Platform fee kept: $12 (30% of $40)                                    │
│   - Unused returned: $8 ($5 + $3)                                          │
│                                                                             │
│   Profit calculation:                                                      │
│   $100 - $27 - $28 + $8 = $53 gross profit                                 │
│                                                                             │
│   Distribution:                                                            │
│   - Infrastructure reserve: $10 (19%)                                      │
│   - DAO treasury: $15 (28%)                                                │
│   - Founder profit share: $28 (53%)                                        │
│     - Founder 1: $9.33                                                     │
│     - Founder 2: $9.33                                                     │
│     - Founder 3: $9.33                                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Partner Onboarding (App Store Model)

### Application Process

```
1. Partner submits application
   - DAO address
   - Services offered
   - Pricing model
   - Security attestation
   - Sample results

2. Council reviews
   - Technical capability
   - Security posture
   - Reputation check
   - Legal compliance

3. Council votes (2-of-3)
   - Approve → Add to partner registry
   - Reject → Provide feedback

4. Integration
   - Partner added to approved list
   - API/contract endpoints registered
   - Revenue split configured (default 70/30)
   - SLA terms established

5. Ongoing monitoring
   - Quality metrics tracked
   - Customer feedback collected
   - Violations flagged
   - Council can vote to remove
```

### Partner Registry Contract

```rust
pub struct PartnerRegistry {
    partners: LookupMap<AccountId, Partner>,
    approved_partners: UnorderedSet<AccountId>,
}

pub struct Partner {
    dao_id: AccountId,
    services: Vec<ServiceType>,
    revenue_split: u8,  // Partner's share (e.g., 70)
    status: PartnerStatus,
    metrics: PartnerMetrics,
    joined_at: Timestamp,
}

pub enum PartnerStatus {
    Pending,
    Approved,
    Suspended,
    Removed,
}

pub struct PartnerMetrics {
    total_jobs: u64,
    success_rate: f32,
    avg_response_time: Duration,
    customer_rating: f32,
}
```

---

## Key Design Principles

1. **Agents ARE the organization** - Not just tools, they hold executive roles
2. **Humans govern, agents execute** - Council sets policy, agents run operations
3. **Multisig for trust** - Large transactions require multiple agent signatures
4. **Partners extend capability** - B2B model with revenue sharing
5. **Transparent accounting** - All flows on-chain, auditable
6. **Emergency override** - Humans can always intervene

---

## Open Questions

1. **Agent key management** - How do agents securely hold keys?
   - TEE (Trusted Execution Environment)?
   - Threshold signatures?
   - Hardware security modules?

2. **Agent upgrade path** - How to upgrade agent code safely?
   - Council approval required?
   - Gradual rollout?
   - Rollback capability?

3. **Dispute resolution** - What if agent makes a mistake?
   - Customer refund process?
   - Partner dispute arbitration?
   - Insurance fund?

4. **Regulatory compliance** - How to handle different jurisdictions?
   - KYC requirements for certain data?
   - Law enforcement cooperation?
   - Data retention policies?

---

*Next: Design the smart contracts that implement these roles*
