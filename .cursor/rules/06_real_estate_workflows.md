# Real Estate Workflows

> **⚠️ TARGET BEHAVIORS - NOT CURRENT CAPABILITY**
>
> This document describes **where we're going**, not where we are.
>
> **Current reality (Phase 0):**
> - Model routing is static (primary + fallback on failure)
> - Task lanes do NOT exist yet
> - You must explicitly select the model or rely on failure-based fallback
> - There is no automatic "use Kimi for planning" behavior
>
> Do not ask "why didn't it use Kimi for this?" — the system cannot route by task yet.
> See `04_model_routing_strategy.md` and `07_roadmap_and_phases.md` for implementation status.

---

## Overview

This document maps CRE workflows to the SIOE architecture. Each workflow specifies:
- Task lane (model routing) — **PLANNED, NOT IMPLEMENTED**
- Input/output format
- Expected model (local vs hosted) — **PLANNED, NOT IMPLEMENTED**

## Workflow Categories

### 1. Document Ingestion

**Purpose:** Process incoming documents and extract structured data

**Examples:**
- Rent rolls (Excel/PDF)
- Offering memorandums (PDF)
- Lease abstracts (PDF/Word)
- Property surveys (PDF)
- Financial statements (Excel/PDF)

**Task Lane:** Extraction

**Model:** Local (Ollama) → Fallback to Kimi

**Flow:**
```
Document Upload
      │
      ▼
File Type Detection
      │
      ├─ PDF → Extract text via OCR/parser
      ├─ Excel → Parse cells directly
      └─ Word → Extract text
      │
      ▼
Extraction (Local Model)
      │
      ▼
Structured Output (JSON)
      │
      ▼
Validation
      │
      ▼
Storage (Spine - future)
```

**Why Local:** High volume, structured task, privacy matters

### 2. Rent Roll Processing

**Purpose:** Extract tenant, unit, and financial data from rent rolls

**Input:** Excel or PDF rent roll

**Output:**
```json
{
  "property": "123 Main St",
  "asOf": "2024-01-01",
  "units": [
    {
      "unit": "101",
      "tenant": "Acme Corp",
      "sqft": 5000,
      "baseRent": 25.00,
      "leaseStart": "2022-01-01",
      "leaseEnd": "2027-01-01"
    }
  ],
  "summary": {
    "totalUnits": 50,
    "occupiedUnits": 45,
    "occupancy": 0.90,
    "avgRent": 28.50
  }
}
```

**Task Lane:** Extraction

**Model:** Local

### 3. OM Summarization

**Purpose:** Summarize offering memorandums for quick review

**Input:** PDF offering memorandum (50-200 pages)

**Output:**
```
# Property Summary: 123 Main St

## Key Metrics
- Asking Price: $25M
- Cap Rate: 6.5%
- NOI: $1.625M
- Occupancy: 92%

## Tenant Mix
- Anchor: Target (35% of NRA, expires 2028)
- Major: Starbucks, CVS, Great Clips

## Investment Highlights
1. Below-market rents with 15% upside
2. Strong demographics (150K pop, $85K HHI)
3. Recent $2M capex by seller

## Risks
1. Target lease expires in 4 years
2. Deferred maintenance on roof
3. Environmental Phase I pending
```

**Task Lane:** Summarization

**Model:** Local → Kimi for complex OMs

### 4. Deal Analysis

**Purpose:** Analyze potential acquisitions with multi-step reasoning

**Input:** OM summary + market comps + investment criteria

**Output:** Investment recommendation with reasoning

**Task Lane:** Planning

**Model:** Kimi → Opus for complex deals

**Why Hosted:** Requires reasoning about tradeoffs, not just extraction

### 5. Market Research

**Purpose:** Compile market data for a submarket

**Input:** Geographic area, property type

**Output:**
```
# Market Report: Downtown Austin Office

## Supply
- Total inventory: 45M SF
- Class A: 18M SF
- Under construction: 2.5M SF

## Demand
- Net absorption (TTM): 850K SF
- Average asking rent: $52/SF FSG
- Vacancy: 18.5%

## Recent Transactions
1. 300 Colorado - $425/SF (Jan 2024)
2. Indeed Tower - $380/SF (Nov 2023)

## Outlook
Sublease inventory elevated. Expect flat rents through 2025.
```

**Task Lane:** Summarization + Extraction

**Model:** Local for data gathering, Kimi for synthesis

### 6. Broker Prep

**Purpose:** Prepare materials for broker meetings

**Input:** Property details, meeting agenda

**Output:** Briefing document with:
- Property history
- Recent comparable sales
- Tenant credit analysis
- Key questions to ask

**Task Lane:** Planning

**Model:** Kimi

## Model Selection by Workflow

| Workflow | Primary Model | Fallback | Rationale |
|----------|---------------|----------|-----------|
| Rent Roll Processing | Local | Kimi | Structured, high-volume |
| OM Ingestion | Local | Kimi | Text extraction |
| OM Summarization | Local | Kimi | Condensing, privacy |
| Deal Analysis | Kimi | Opus | Reasoning required |
| Market Research | Local + Kimi | Opus | Mixed tasks |
| Broker Prep | Kimi | Opus | Planning/synthesis |

## Future: Spine Integration

When Spine is implemented:

1. **Entity Storage**
   - Properties, tenants, leases stored as entities
   - Cross-reference across documents

2. **Workflow State**
   - Track deal pipeline stage
   - Remember context across sessions

3. **Automated Triggers**
   - Lease expiration alerts
   - Market report generation

## Invariants (Do Not Break)

1. **Document processing is local-first**
   - Sensitive data stays on gateway host
   - Only escalate when local fails

2. **Extraction outputs are validated**
   - Don't trust model output blindly
   - Validate against schema

3. **Summarization preserves facts**
   - Numbers must be accurate
   - Sources must be cited

4. **Planning tasks use hosted models**
   - Local models are not reliable for multi-step reasoning
   - Accept the latency/cost tradeoff
