# Meatus Project Index

## Quick Reference

**What is Meatus?**
A Web3-native investigation platform combining dark web intelligence with AI agents and DAO governance.

**Core Concept:**
"Identity enables agency, smart contracts provide guardrails."

---

## Documentation Map

```
meatus/
│
├── VISION.md                    # Core vision and architecture overview
├── INDEX.md                     # This file - project navigation
│
├── docs/
│   ├── 01-web3-agent-ecosystem.md       # NEAR + DAO + Agent architecture
│   ├── 02-ai-reasoning-architecture.md  # DeepSeek + Graph + Vector DB
│   ├── 03-ring-osint-architecture.md    # Ring 0/1/2 OSINT model
│   ├── 04-phase1-mvp.md                 # MVP build plan
│   ├── 05-dao-multisig-learning-path.md # Learning: DAO + multisig + payments
│   ├── 06-dao-cli-tutorial.md           # CLI commands for NEAR DAO
│   ├── 07-dao-organizational-structure.md # Agents as executives, humans as governance
│   ├── 08-dual-token-governance.md      # $VOICE token, quadratic voting, game theory
│   └── 09-agent-organizational-structure.md # CEO/COO/CCO, JIT access, MAKER validation, DSPy
│
└── agents/
    └── 001-darkweb-breach-scanner/
        └── AGENT.md                     # Breach scanner agent spec
```

---

## Key Decisions Made

| Topic | Decision | Rationale |
|-------|----------|-----------|
| Blockchain | NEAR Protocol | Native AI agent support, human-readable accounts, Sputnik DAO |
| DAO Framework | Sputnik DAO V2 + Custom $VOICE | Treasury + quadratic voting governance |
| Reasoning | DeepSeek R1/3.2 | Cost-effective, chain-of-thought, self-hostable |
| Graph DB | Neo4j (tentative) | Best tooling, Cypher query language |
| Vector DB | Qdrant (tentative) | Open source, Rust-based, good filtering |
| Governance | Dual-token (payment + influence) | Separates value transfer from governance |

---

## Architecture Summary

### Organizational Structure (DAO)
```
GOVERNANCE (Humans - Council)
├── Founders (capital, oversight)
├── Infrastructure Providers (GPUs, hosting)
└── Vote with $VOICE tokens (quadratic cost)

EXECUTION (Agents - Officers)
├── Orchestrator Agent (CEO - coordinates jobs)
├── Treasurer Agent (CFO - manages payments)
└── Worker Agents (task execution)

PARTNERS (External DAOs - B2B)
├── Vetted service providers
├── 70/30 revenue split
└── Limited governance participation
```

### Payment Flow
```
Customer → Payment Gateway → DAO Treasury → Orchestrator → Agents → Results
                                    ↓
                            Validation → Payment Distribution → Humans
```

### Dual-Token Model
```
$NEAR / $USDC: Actual payments, transfers, revenue
$VOICE: Governance influence (renewable, quadratic, non-transferable)
```

### Ring Model (OSINT)
```
Ring 0: Target subject (identity, location, digital footprint, criminal, financial)
Ring 1: Close family & friends (weighted by proximity + communication)
Ring 2: Services & extended network (employers, schools, professionals)
```

---

## Agent Fleet
```
001: Breach Scanner / Digital Life Mapper (defined)
002: Identity Aggregator (planned)
003: Relationship Mapper (planned)
004: Network Analyzer (planned)
005: Location Intelligence (planned)
006: Criminal Records Searcher (planned)
007: Financial Investigator (planned)
008: Social Media Analyst (planned)
009: Dark Web Monitor (planned)
```

---

## Current Phase: Learning & MVP

### Immediate Focus
1. Learn NEAR + DAO + Multisig fundamentals
2. Understand dual-token governance mechanics
3. Build hello world payment flow
4. Deploy to testnet

### Learning Path
- [Doc 05](docs/05-dao-multisig-learning-path.md): DAO + Multisig concepts
- [Doc 06](docs/06-dao-cli-tutorial.md): CLI commands for NEAR DAO
- [Doc 07](docs/07-dao-organizational-structure.md): Agents as executives
- [Doc 08](docs/08-dual-token-governance.md): $VOICE token and game theory

---

## Target Markets

| Segment | Use Case | Access Level |
|---------|----------|--------------|
| Individuals | Personal breach monitoring | Self-consent only |
| Businesses | Employee vetting, fraud | FCRA compliant |
| Government | Background checks | Agency-specific regs |
| Law Enforcement | Criminal investigations | Full access + warrants |
| Legal/PI | Litigation support | Licensed access |

---

## Key Links

### NEAR Resources
- [NEAR Docs](https://docs.near.org/)
- [NEAR DAO Primitives](https://docs.near.org/primitives/dao)
- [Sputnik DAO](https://github.com/near-daos/sputnik-dao-contract)
- [NEAR AI Agent Studio](https://github.com/near-horizon/near-ai-agent-studio)
- [NEAR Testnet Wallet](https://testnet.mynearwallet.com/)
- [NEAR Explorer](https://testnet.nearblocks.io/)

### Governance Resources
- [Conviction Voting](https://medium.com/giveth/conviction-voting-a-novel-continuous-decision-making-alternative-to-governance-aa746cfb9475)
- [Quadratic Voting](https://www.radicalxchange.org/concepts/plural-voting/)
- [1Hive Gardens](https://gardens.1hive.org/)

### AI/Data Resources
- [DeepSeek](https://deepseek.com/)
- [Have I Been Pwned API](https://haveibeenpwned.com/API/v3)
- [Neo4j](https://neo4j.com/)
- [Qdrant](https://qdrant.tech/)

### Game Theory References
- Von Neumann & Morgenstern: *Theory of Games and Economic Behavior* (1944)
- Thomas Schelling: *The Strategy of Conflict* (1960)
- Lloyd Shapley: Shapley Value (1953)

---

## Session History

### Session 2024-12-12
- Captured core vision and RSAC inspiration
- Chose NEAR Protocol for Web3 layer
- Documented AI-native architecture (DeepSeek, graph, vector)
- Designed Ring-based OSINT model (Ring 0/1/2)
- Created Phase 1 MVP plan
- Created DAO + Multisig learning path
- Defined Agent 001: Breach Scanner
- Designed DAO organizational structure (agents as executives)
- Created dual-token governance model ($VOICE)
- Added game theory foundations (von Neumann, Shapley, Schelling)

---

*Last updated: 2024-12-12*
