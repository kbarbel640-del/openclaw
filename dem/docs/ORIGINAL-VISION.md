# Meatus: Web3 Investigation Platform

## Vision
A decentralized investigation platform combining dark web intelligence (like SpyCloud) with Web3 agent architecture and DAO governance. The key insight: **identity enables agency, and smart contracts provide guardrails**.

## Origin
- Inspired by RSAC conversations with companies like SpyCloud
- Goal: Take dark web investigations to a new level through Agents and a DAO

## Core Architecture

### Payment Flow (The "Quarter in the Arcade" Model)
```
User (Web2 Frontend)
    |
    v
Payment Gateway API
    - Accepts: USD, Crypto (any currency)
    - Converts to: USDT, USDC, BTC, or ETH
    |
    v
DAO Treasury
    |
    v
Agent Wallet (funded per task)
    |
    v
Smart Contract Parameters Set
    |
    v
Orchestrator Agent Activated
```

### Agent Hierarchy
```
Orchestrator Agent (Container)
    |
    +-- User Confirmation
    |
    +-- Initializes Specialized Agents (built incrementally)
```

## Why Web3 for Agents?

1. **Identity = Agency**: Agents need verifiable identity to act autonomously
2. **Smart Contract Guardrails**: Programmatic constraints on agent behavior
3. **Transparent Execution**: All actions recorded on-chain
4. **Trustless Coordination**: Agents can transact without central authority
5. **Economic Incentives**: Token economics align agent behavior

## AI-Native Investigation (Not Elasticsearch)

This is NOT a traditional search system. It's AI-native:

- **Reasoning Engine**: DeepSeek R1/3.2 for chain-of-thought investigation
- **Deep Graph**: Knowledge graph for entity relationships and inference
- **Vector Search**: Semantic similarity, fuzzy matching, entity resolution
- **Natural Language**: Input can be partial ("John Smith, maybe Denver, wife Sarah")
- **Inference**: Surface connections from related data even when direct info missing

## Ring-Based OSINT Model

Comprehensive investigation through concentric relationship rings:

```
RING 0 - TARGET SUBJECT
├── Identity (names, DOB, SSN, aliases, photos)
├── Location (addresses, property, movement patterns)
├── Employment & Financial (work history, assets, liens)
├── Criminal & Legal (records, warrants, litigation)
├── Digital Footprint (emails, social, breaches)
└── Behavioral (browsing, purchases, location patterns)

RING 1 - CLOSE FAMILY & FRIENDS
├── Spouse, children, parents, siblings
├── Close friends, roommates, known associates
├── Weighted by proximity + communication frequency
└── Surfaces: aliases, criminal associations, safe houses

RING 2 - SERVICES & EXTENDED NETWORK
├── Lawyers, doctors, accountants
├── Employers, colleagues, business partners
├── Schools, classmates, alumni networks
└── Online communities, hobby groups
```

Target markets: Individuals, Businesses, Government, Law Enforcement, Legal/PI

## Platform Considerations

### NEAR Protocol (Current Consideration)
- Pros: Low fees, fast finality, Rust-based, good developer experience
- Pros: Account model (human-readable addresses)
- Pros: Built-in account abstraction

### Alternatives to Evaluate
- Ethereum L2s (Arbitrum, Optimism, Base)
- Solana (speed, low cost)
- Cosmos ecosystem (IBC interoperability)

---
*Document created: 2024-12-12*
*Status: Active Development - Iterative Agent Build*
