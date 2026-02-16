# AI & Reasoning Architecture

## Core Philosophy

**Not Elasticsearch. AI-native.**

Traditional investigation tools (SpyCloud, etc.) use keyword search and exact matching. Meatus is fundamentally different:

- **Reasoning over data**, not just retrieving it
- **Graph relationships** surface connections humans would miss
- **Natural language** input and output
- **Partial information** can still yield insights via inference

---

## The Intelligence Stack

```
┌─────────────────────────────────────────────────────────────────────┐
│                     NATURAL LANGUAGE LAYER                          │
│                                                                     │
│  Input: "Find anything on John Smith, I think he worked at         │
│          Acme Corp, maybe in Denver. His wife might be Sarah."     │
│                                                                     │
│  Output: Structured investigation plan + natural language report   │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     REASONING ENGINE                                │
│                                                                     │
│  Model: DeepSeek R1 / DeepSeek 3.2 (thinking/reasoning)            │
│                                                                     │
│  Capabilities:                                                      │
│  - Parse ambiguous inputs into entity extraction                   │
│  - Generate investigation hypotheses                               │
│  - Evaluate evidence strength                                      │
│  - Identify gaps in knowledge                                      │
│  - Suggest follow-up queries                                       │
│  - Explain reasoning chain to user                                 │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     KNOWLEDGE GRAPH                                 │
│                                                                     │
│  Graph Database: Neo4j / Dgraph / Amazon Neptune                   │
│                                                                     │
│  Nodes:                                                             │
│  - Person (name, aliases, DOB, SSN hash, etc.)                     │
│  - Email                                                            │
│  - Phone                                                            │
│  - Address                                                          │
│  - Organization                                                     │
│  - Domain                                                           │
│  - IP Address                                                       │
│  - Credential (hashed)                                              │
│  - Breach Event                                                     │
│  - Social Profile                                                   │
│                                                                     │
│  Edges (Relationships):                                             │
│  - OWNS (person -> email, phone, domain)                           │
│  - WORKS_AT (person -> organization)                               │
│  - LIVES_AT (person -> address)                                    │
│  - RELATED_TO (person -> person, with type: spouse, colleague)     │
│  - EXPOSED_IN (credential -> breach)                               │
│  - LOGGED_FROM (person -> IP)                                      │
│  - ASSOCIATED_WITH (any -> any, inferred)                          │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     VECTOR DATABASE                                 │
│                                                                     │
│  Database: Qdrant / Weaviate / Pinecone / Milvus                   │
│                                                                     │
│  Use Cases:                                                         │
│  - Semantic search ("emails similar to john.smith pattern")        │
│  - Fuzzy name matching (embeddings of name variations)             │
│  - Document similarity (breach dump analysis)                      │
│  - Behavioral pattern matching                                      │
│  - Entity resolution (is john.smith@gmail same as jsmith@work?)    │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     STRUCTURED DATA                                 │
│                                                                     │
│  Database: PostgreSQL / ClickHouse (for analytics)                 │
│                                                                     │
│  Tables:                                                            │
│  - breach_records (source, date, record_count, data_types)         │
│  - investigation_jobs (job_id, customer, status, cost)             │
│  - agent_executions (agent_id, job_id, queries, results)           │
│  - billing (transactions, payments, settlements)                    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Reasoning Flow Example

### Input
```
User: "John Smith, maybe Denver, wife might be Sarah"
```

### Step 1: Entity Extraction (DeepSeek reasoning)
```json
{
  "entities": [
    {"type": "person", "name": "John Smith", "confidence": 0.95},
    {"type": "location", "value": "Denver", "confidence": 0.6, "context": "possible residence or work"},
    {"type": "person", "name": "Sarah", "relationship": "spouse", "confidence": 0.5}
  ],
  "investigation_strategy": [
    "Search for John Smith with Denver association",
    "If found, look for related persons named Sarah",
    "Cross-reference email patterns: jsmith@*, john.smith@*, johnsmith@*",
    "Check breach data for Denver-area employers"
  ]
}
```

### Step 2: Graph Query Generation
```cypher
// Find John Smiths connected to Denver
MATCH (p:Person)-[:LIVES_AT|WORKS_AT]->(loc)
WHERE p.name =~ '(?i)john.*smith'
  AND loc.city = 'Denver'
RETURN p, loc

// Expand to find spouse named Sarah
MATCH (p:Person {name: 'John Smith'})-[:RELATED_TO {type: 'spouse'}]->(spouse:Person)
WHERE spouse.name =~ '(?i)sarah.*'
RETURN p, spouse
```

### Step 3: Vector Search (parallel)
```python
# Semantic search for name variations
similar_names = vector_db.search(
    embedding=embed("John Smith Denver"),
    collection="persons",
    limit=50
)

# Find similar email patterns
email_patterns = vector_db.search(
    embedding=embed("jsmith john.smith johnsmith"),
    collection="emails",
    limit=100
)
```

### Step 4: Reasoning Over Results
```
DeepSeek R1 analyzes:
- 3 "John Smith" records found in Denver area
- One has email jsmith@acmecorp.com (matches "Acme Corp" hint)
- That record shows spouse "Sarah Smith"
- Sarah's email sarah.smith@gmail.com appears in 2019 breach
- John's work email in 2021 LinkedIn breach
- Confidence: HIGH that this is the target

Gaps identified:
- No phone records found
- No current address (last known: 2021)
- Recommendation: Search property records for confirmation
```

### Step 5: Output
```
Natural language report + structured JSON + confidence scores
```

---

## Why DeepSeek for Reasoning

### DeepSeek R1 / 3.2 Advantages
1. **Chain-of-thought reasoning** - Shows its work, auditable
2. **Cost effective** - Much cheaper than GPT-4/Claude for bulk reasoning
3. **Open weights** - Can self-host for sensitive data
4. **Strong at structured output** - JSON, Cypher query generation
5. **Good at uncertainty** - Expresses confidence levels

### Model Allocation Strategy
```
┌────────────────────────────────────────────────────────────────┐
│ Task                          │ Model                          │
├────────────────────────────────────────────────────────────────┤
│ Entity extraction             │ DeepSeek 3.2 (fast)            │
│ Investigation planning        │ DeepSeek R1 (thinking)         │
│ Evidence evaluation           │ DeepSeek R1 (thinking)         │
│ Query generation (Cypher/SQL) │ DeepSeek 3.2                   │
│ Report writing                │ DeepSeek 3.2 or Claude         │
│ Embeddings                    │ Voyage / OpenAI / BGE          │
│ High-stakes decisions         │ Claude (for safety)            │
└────────────────────────────────────────────────────────────────┘
```

---

## The Deep Graph

### Entity Resolution Problem
The hardest problem in investigations: **Is this the same person?**

```
Record A: john.smith@gmail.com, "John Smith"
Record B: jsmith@acme.com, "J. Smith", Denver CO
Record C: john_smith_1985@yahoo.com, "Johnny Smith"

Are these the same person?
```

### Graph + AI Solution
```
1. VECTOR SIMILARITY
   - Embed all name variations
   - Cluster by similarity
   - Flag potential matches

2. GRAPH STRUCTURE
   - If A and B share an IP address → strong link
   - If B and C share a phone number → strong link
   - Transitive: A ↔ B ↔ C suggests same person

3. REASONING
   - DeepSeek evaluates the evidence
   - "Based on shared employer domain and IP overlap,
      85% confidence these are the same individual"

4. HUMAN-IN-THE-LOOP (optional)
   - "I found 3 potential matches. Should I merge?"
```

### Graph Schema (Detailed)

```
// Core Entities
(:Person {
  id: UUID,
  canonical_name: String,
  name_variations: [String],
  dob: Date?,
  ssn_hash: String?,  // Never store plaintext
  confidence_score: Float
})

(:Email {
  address: String,
  domain: String,
  first_seen: DateTime,
  last_seen: DateTime,
  breach_count: Int
})

(:Phone {
  number: String,  // E.164 format
  carrier: String?,
  type: "mobile" | "landline" | "voip"
})

(:Address {
  street: String,
  city: String,
  state: String,
  postal: String,
  country: String,
  geo: Point?,
  type: "residential" | "business"
})

(:Organization {
  name: String,
  domain: String?,
  industry: String?,
  employee_count: Int?
})

(:Breach {
  id: UUID,
  name: String,        // "LinkedIn 2021"
  date: Date,
  record_count: Int,
  data_types: [String] // ["email", "password_hash", "name"]
})

(:Credential {
  hash: String,        // Hashed credential
  type: "password" | "api_key" | "token",
  strength: "weak" | "medium" | "strong"
})

(:IP {
  address: String,
  asn: Int?,
  org: String?,
  geo: Point?
})

// Relationships
(Person)-[:OWNS]->(Email)
(Person)-[:OWNS]->(Phone)
(Person)-[:LIVES_AT {from: Date, to: Date?}]->(Address)
(Person)-[:WORKS_AT {role: String?, from: Date, to: Date?}]->(Organization)
(Person)-[:RELATED_TO {type: "spouse"|"sibling"|"colleague"|"associate"}]->(Person)
(Email)-[:EXPOSED_IN {data_types: [String]}]->(Breach)
(Credential)-[:BELONGS_TO]->(Email)
(Credential)-[:EXPOSED_IN]->(Breach)
(Person)-[:LOGGED_FROM {timestamp: DateTime}]->(IP)
(Email)-[:ASSOCIATED_WITH {confidence: Float, source: String}]->(Email)
```

---

## Data Pipeline

```
┌─────────────────────────────────────────────────────────────────────┐
│                     DATA INGESTION                                  │
│                                                                     │
│  Sources:                                                           │
│  - Breach dumps (structured and unstructured)                       │
│  - OSINT feeds                                                      │
│  - Public records                                                   │
│  - User-provided data                                               │
│                                                                     │
│  Pipeline:                                                          │
│  1. Ingest raw data                                                 │
│  2. Extract entities (NER via DeepSeek or fine-tuned model)        │
│  3. Generate embeddings                                             │
│  4. Entity resolution (merge/link)                                  │
│  5. Insert into graph + vector DB                                   │
│  6. Update structured tables                                        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack (Proposed)

| Layer | Technology | Reasoning |
|-------|------------|-----------|
| **Graph DB** | Neo4j or Dgraph | Neo4j has best tooling; Dgraph is more scalable |
| **Vector DB** | Qdrant | Open source, Rust-based, fast, good filtering |
| **Structured DB** | PostgreSQL | Battle-tested, JSON support, extensions |
| **Reasoning** | DeepSeek R1/3.2 | Cost-effective, chain-of-thought, self-hostable |
| **Embeddings** | Voyage AI or BGE | High quality, affordable |
| **Cache** | Redis | Fast, pub/sub for agent coordination |
| **Message Queue** | NATS or Redis Streams | Agent-to-agent communication |

---

## Integration with Web3 Layer

```
User Query (Natural Language)
        │
        ▼
┌───────────────────┐
│  Orchestrator     │  ← NEAR wallet, smart contract constraints
│  Agent            │
└───────┬───────────┘
        │
        ├──► Reasoning Agent (DeepSeek R1)
        │    └── Generates investigation plan
        │
        ├──► Graph Query Agent
        │    └── Executes Cypher queries
        │
        ├──► Vector Search Agent
        │    └── Semantic similarity search
        │
        └──► Data Collection Agents
             └── Each with own wallet, pays for data access
```

Each agent:
- Has NEAR wallet identity
- Operates within smart contract budget
- Logs actions on-chain (audit trail)
- Can pay for external data sources

---

## Next Steps for AI Architecture

1. **Choose graph database** (Neo4j vs Dgraph - I lean Neo4j for dev experience)
2. **Set up vector database** (Qdrant is my recommendation)
3. **Get DeepSeek API access** or set up self-hosted
4. **Design entity extraction prompts**
5. **Build first graph ingestion pipeline**

Want to dive into any of these?
