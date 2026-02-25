# SBVR Ontology System and Domain Modeling in OpenClaw-MABOS

> **Document Type:** Technical Reference — Ontology & Domain Modeling
> **System:** OpenClaw-MABOS (Multi-Agent Business Operating System)
> **Version:** 1.0
> **Date:** 2026-02-24
> **Status:** Authoritative Reference
> **Companion Docs:**
>
> - `docs/plans/2026-02-24-memory-system-architecture.md`
> - `docs/plans/2026-02-24-bdi-sbvr-multiagent-framework.md`
> - `docs/plans/2026-02-24-openclaw-mabos-system-architecture.md`
> - `docs/plans/2026-02-24-rlm-memory-enhancements.md`

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [SBVR: The Standard](#2-sbvr-the-standard)
3. [Why MABOS Uses SBVR](#3-why-mabos-uses-sbvr)
4. [JSON-LD/OWL Encoding Strategy](#4-json-ldowl-encoding-strategy)
5. [Ontology Import Hierarchy](#5-ontology-import-hierarchy)
6. [Upper Ontology — `mabos-upper.jsonld`](#6-upper-ontology--mabos-upperjsonld)
7. [Business Core Ontology — `business-core.jsonld`](#7-business-core-ontology--business-corejsonld)
8. [E-Commerce Domain — `ecommerce.jsonld`](#8-e-commerce-domain--ecommercejsonld)
9. [SaaS Domain — `saas.jsonld`](#9-saas-domain--saasjsonld)
10. [Marketplace Domain — `marketplace.jsonld`](#10-marketplace-domain--marketplacejsonld)
11. [Retail Domain — `retail.jsonld`](#11-retail-domain--retailjsonld)
12. [Consulting Domain — `consulting.jsonld`](#12-consulting-domain--consultingjsonld)
13. [Cross-Domain Relationships — `cross-domain.jsonld`](#13-cross-domain-relationships--cross-domainjsonld)
14. [SHACL Validation Shapes — `shapes.jsonld`](#14-shacl-validation-shapes--shapesjsonld)
15. [SBVR Validation Shapes — `shapes-sbvr.jsonld`](#15-sbvr-validation-shapes--shapes-sbvrjsonld)
16. [SBVR Rule Types and Modalities](#16-sbvr-rule-types-and-modalities)
17. [Ontology Loader, Validator, and Merger](#17-ontology-loader-validator-and-merger)
18. [TypeDB Schema Projection Pipeline](#18-typedb-schema-projection-pipeline)
19. [Ontology Governance Pipeline](#19-ontology-governance-pipeline)
20. [Domain Scaffolding for New Business Types](#20-domain-scaffolding-for-new-business-types)
21. [Knowledge Infrastructure Consumers](#21-knowledge-infrastructure-consumers)
22. [Business Venture Instantiation](#22-business-venture-instantiation)
23. [Cross-Ontology Statistics Summary](#23-cross-ontology-statistics-summary)
24. [Companion Architecture Documents](#24-companion-architecture-documents)
25. [Glossary](#25-glossary)

---

## 1. Introduction

OpenClaw-MABOS is a multi-agent business operating system that uses formal ontological modeling to represent, reason about, and govern business domains. At the heart of this system lies a comprehensive ontology stack built on the OMG SBVR standard, encoded in JSON-LD/OWL, and projected into TypeDB for graph-native query and inference.

This document is the definitive technical reference for the SBVR Ontology System and Domain Modeling subsystem. It covers the foundational standard (SBVR), the encoding strategy (JSON-LD/OWL), the ten ontology files that comprise the knowledge base, the governance pipeline that manages ontology evolution, the TypeDB projection that enables graph queries, and the knowledge infrastructure layers that consume ontological definitions to power agent reasoning.

The ontology system serves three audiences simultaneously:

- **Business stakeholders** can read SBVR designations and definitions in structured natural language and understand what the system models without reading code.
- **Agent developers** use the ontology as a contract: every concept an agent reasons about has a formal identity, definition, and set of constraints.
- **The runtime system** uses the ontology to validate facts, enforce business rules, project knowledge into TypeDB, and scaffold new business ventures with domain-appropriate concepts.

---

## 2. SBVR: The Standard

### 2.1 Overview

SBVR (Semantics of Business Vocabulary and Business Rules) is a formal standard published by the Object Management Group (OMG). Initially adopted in 2008, the current version is v1.6. SBVR provides a rigorous metamodel for defining:

- **Business vocabularies** — the terms (noun concepts, verb concepts, individual concepts) used to describe a business domain.
- **Fact types** — the relationships between concepts, expressed as structured readings (e.g., "Customer places Order").
- **Business rules** — constraints and derivations expressed over fact types using formal modalities.

### 2.2 Core SBVR Concepts

**Noun Concepts** represent categories of things in the business domain. Examples: Customer, Order, Product, Agent. In formal SBVR, a noun concept has a designation (the term), a definition (its meaning), and a vocabulary assignment (which vocabulary it belongs to).

**Verb Concepts** represent relationships or associations between noun concepts. They form the basis of fact types. Example: "places" in "Customer places Order."

**Fact Types** are structured propositions that combine noun concepts via verb concepts. A fact type has a fixed arity (typically binary), roles (the positions that noun concepts fill), and one or more readings (natural language expressions of the relationship). Example:

```
Fact Type: customer_places_order
  Role 1: placer (played by: Customer)
  Role 2: placed (played by: Order)
  Reading: "Customer places Order"
  Arity: 2
```

**Individual Concepts** are specific, named instances of noun concepts. Example: "Acme Corporation" as an individual concept of the noun concept "Business."

**Business Rules** are formal constraints or derivations expressed over fact types. SBVR categorizes rules along two dimensions:

- **Rule Type:** Definitional rules define the meaning of concepts; behavioral rules constrain permissible states or transitions.
- **Rule Modality:** Alethic rules express logical necessity (what must be true by definition); deontic rules express obligation or permission (what should be true by policy).

**Proof Tables** are a validation mechanism where each rule can have associated proof entries recording whether the rule is satisfied, with truth values and confidence scores.

### 2.3 SBVR Metamodel Summary

```
Vocabulary
  |-- contains --> VocabularyElement
                     |-- NounConcept
                     |   |-- IndividualConcept
                     |-- VerbConcept
                     |-- FactType
                     |   |-- has --> FactTypeRole
                     |   |           |-- roleName
                     |   |           |-- rolePlayer --> NounConcept
                     |   |-- hasReading
                     |   |-- roleArity
                     |-- BusinessRule
                         |-- DefinitionalRule
                         |-- BehavioralRule
                         |-- ruleType (definitional | behavioral)
                         |-- ruleModality (alethic | deontic)
                         |-- constrainsFact --> FactType
                         |-- hasProofTable --> ProofTable
                                               |-- hasProofEntry --> ProofEntry
                                                                      |-- truthValue
                                                                      |-- entryConfidence
```

---

## 3. Why MABOS Uses SBVR

### 3.1 The Bridge Problem

Multi-agent business systems face a fundamental tension: business stakeholders think in terms of business concepts ("customers," "revenue," "compliance requirements"), while software systems require formal, machine-processable specifications. Traditional approaches force a choice — either human-readable documentation that drifts from the implementation, or formal models that business users cannot understand.

SBVR resolves this tension by design. Its structured natural language representations are simultaneously human-readable and formally grounded. When a MABOS agent reasons about a "Customer," that concept has:

- A **designation** that a business user recognizes: "Customer"
- A **definition** that explains its meaning: "A party that purchases products or services from the business"
- A **vocabulary assignment** that places it in context: belongs to the business-core vocabulary
- A **formal identity** that the system can process: `bcore:Customer` with OWL class semantics

### 3.2 SBVR as Ontological Backbone

MABOS uses SBVR as its ontological backbone, meaning every concept in the system — from high-level BDI cognitive primitives (Belief, Desire, Intention) to domain-specific business entities (SKU, MRR, Planogram) — has full SBVR metadata. This provides:

1. **Formal grounding** — No concept exists without a definition. Agents cannot invent ad-hoc terms.
2. **Cross-domain consistency** — The same vocabulary framework applies to e-commerce, SaaS, marketplace, retail, and consulting domains.
3. **Rule formalization** — Business rules are not buried in application code; they are first-class ontological citizens with types, modalities, and proof tables.
4. **Governance** — New concepts must pass SBVR completeness validation before entering the ontology.
5. **Human audit trail** — Every concept can be explained in natural language by reading its SBVR annotations.

### 3.3 SBVR vs. Alternatives

| Criterion                          | SBVR                            | Plain OWL/RDFS | UML/OCL                 | Domain-Specific Languages |
| ---------------------------------- | ------------------------------- | -------------- | ----------------------- | ------------------------- |
| Human readability                  | High (structured NL)            | Low            | Medium                  | Varies                    |
| Formal rigor                       | High (OMG standard)             | High           | High                    | Varies                    |
| Rule expressiveness                | High (modalities, proof tables) | Limited        | Medium (OCL)            | Varies                    |
| Business stakeholder accessibility | High                            | Low            | Medium                  | Low                       |
| Tooling ecosystem                  | Moderate                        | Large          | Large                   | Narrow                    |
| Integration with OWL               | Native mapping                  | N/A            | Requires transformation | Requires transformation   |

MABOS chose SBVR because it maximizes both formal rigor and human accessibility — critical for a system where AI agents must explain their reasoning to human stakeholders.

---

## 4. JSON-LD/OWL Encoding Strategy

### 4.1 Why JSON-LD

MABOS encodes its ontologies in JSON-LD (JSON for Linked Data) rather than RDF/XML, Turtle, or OWL/XML. The reasons:

1. **Native JSON** — JSON-LD is valid JSON, meaning it can be loaded with standard `JSON.parse()`, stored in JSON-native databases, and processed with standard JavaScript/TypeScript tooling.
2. **Context mechanism** — The `@context` block provides namespace prefixes, eliminating verbose URIs in the body.
3. **Graph structure** — The `@graph` array provides a flat list of node definitions, making it easy to iterate, filter, and merge.
4. **Linked Data compatibility** — JSON-LD is a W3C standard RDF serialization, meaning the ontologies can be loaded into any RDF/OWL tool if needed.

### 4.2 Encoding Mappings

The following table shows how SBVR metamodel elements map to JSON-LD/OWL constructs:

| SBVR Concept             | OWL Construct          | JSON-LD Encoding                                                                                              |
| ------------------------ | ---------------------- | ------------------------------------------------------------------------------------------------------------- |
| Noun Concept             | `owl:Class`            | `{ "@id": "ns:Name", "@type": "owl:Class", "sbvr:hasDesignation": "...", "sbvr:hasDefinition": "..." }`       |
| Individual Concept       | `owl:NamedIndividual`  | `{ "@id": "ns:name", "@type": ["owl:NamedIndividual", "ns:ParentClass"] }`                                    |
| Verb Concept / Fact Type | `owl:ObjectProperty`   | `{ "@id": "ns:name", "@type": "owl:ObjectProperty", "rdfs:domain": ..., "rdfs:range": ... }`                  |
| Characteristic           | `owl:DatatypeProperty` | `{ "@id": "ns:name", "@type": "owl:DatatypeProperty", "rdfs:range": { "@id": "xsd:type" } }`                  |
| Business Rule            | Custom class           | `{ "@id": "ns:rule_name", "@type": "sbvr:BusinessRule", "sbvr:ruleType": "...", "sbvr:ruleModality": "..." }` |
| Proof Table              | Custom class           | `{ "@id": "ns:pt_name", "@type": "sbvr:ProofTable", "sbvr:hasProofEntry": [...] }`                            |
| Vocabulary               | `sbvr:Vocabulary`      | `{ "@id": "ns:vocab_name", "@type": "sbvr:Vocabulary" }`                                                      |

### 4.3 JSON-LD Snippet: Noun Concept with SBVR Annotations

```jsonld
{
  "@id": "bcore:Customer",
  "@type": "owl:Class",
  "rdfs:subClassOf": { "@id": "upper:Agent" },
  "rdfs:label": "Customer",
  "rdfs:comment": "A party that purchases products or services from the business",
  "sbvr:hasDesignation": "Customer",
  "sbvr:hasDefinition": "A party that purchases products or services from the business",
  "sbvr:belongsToVocabulary": { "@id": "bcore:BusinessCoreVocabulary" }
}
```

Key observations:

- `@id` provides the formal URI identity using the namespace prefix.
- `@type` declares this as an OWL class (mapping to SBVR noun concept).
- `rdfs:subClassOf` establishes the inheritance hierarchy.
- `sbvr:hasDesignation` and `sbvr:hasDefinition` provide the human-readable SBVR metadata.
- `sbvr:belongsToVocabulary` assigns the concept to a vocabulary.

### 4.4 JSON-LD Snippet: Fact Type (Object Property) with Roles

```jsonld
{
  "@id": "bcore:hasCustomer",
  "@type": "owl:ObjectProperty",
  "rdfs:domain": { "@id": "bcore:Business" },
  "rdfs:range": { "@id": "bcore:Customer" },
  "rdfs:label": "has customer",
  "sbvr:hasDesignation": "has customer",
  "sbvr:hasDefinition": "Relates a business to the customers it serves",
  "sbvr:belongsToVocabulary": { "@id": "bcore:BusinessCoreVocabulary" },
  "sbvr:hasRole": [
    {
      "@type": "sbvr:FactTypeRole",
      "sbvr:roleName": "business",
      "sbvr:rolePlayer": { "@id": "bcore:Business" }
    },
    {
      "@type": "sbvr:FactTypeRole",
      "sbvr:roleName": "customer",
      "sbvr:rolePlayer": { "@id": "bcore:Customer" }
    }
  ],
  "sbvr:roleArity": 2,
  "sbvr:hasReading": "Business has Customer"
}
```

Key observations:

- The OWL object property doubles as an SBVR fact type.
- `sbvr:hasRole` contains an array of `FactTypeRole` objects, each with a name and player.
- `sbvr:roleArity` declares the expected number of roles.
- `sbvr:hasReading` provides the natural language reading of the fact type.

### 4.5 JSON-LD Snippet: Business Rule with Proof Table

```jsonld
{
  "@id": "bcore:rule_businessHasLegalEntity",
  "@type": "sbvr:BusinessRule",
  "rdfs:label": "Business must have a legal entity",
  "sbvr:ruleType": "definitional",
  "sbvr:ruleModality": "alethic",
  "sbvr:hasDesignation": "Business Legal Entity Rule",
  "sbvr:hasDefinition": "It is necessary that each Business has at least one LegalEntity",
  "sbvr:constrainsFact": { "@id": "bcore:hasLegalEntity" },
  "sbvr:belongsToVocabulary": { "@id": "bcore:BusinessCoreVocabulary" },
  "sbvr:hasProofTable": {
    "@id": "bcore:pt_businessHasLegalEntity",
    "@type": "sbvr:ProofTable",
    "sbvr:hasProofEntry": [
      {
        "@type": "sbvr:ProofEntry",
        "sbvr:truthValue": true,
        "sbvr:entryConfidence": 1.0,
        "rdfs:comment": "Every business instance must be associated with a legal entity"
      }
    ]
  }
}
```

Key observations:

- `sbvr:ruleType` classifies the rule as definitional (it defines what a Business is).
- `sbvr:ruleModality` marks it as alethic (logically necessary, not just a policy).
- `sbvr:constrainsFact` links the rule to the fact type it governs.
- The proof table contains entries that record validation results.

### 4.6 JSON-LD Context Block Pattern

Every ontology file begins with a `@context` block that defines namespace prefixes:

```jsonld
{
  "@context": {
    "owl": "http://www.w3.org/2002/07/owl#",
    "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
    "xsd": "http://www.w3.org/2001/XMLSchema#",
    "sh": "http://www.w3.org/ns/shacl#",
    "sbvr": "https://mabos.io/ontology/sbvr#",
    "upper": "https://mabos.io/ontology/upper#",
    "bcore": "https://mabos.io/ontology/business-core#"
  },
  "@graph": [
    ...
  ]
}
```

---

## 5. Ontology Import Hierarchy

The ten ontology files form a layered import hierarchy. The following ASCII diagram shows the dependency structure:

```
                    +-------------------+
                    | mabos-upper.jsonld |
                    | (Upper Ontology)  |
                    +--------+----------+
                             |
                    +--------v-----------+
                    | business-core.jsonld|
                    | (Business Core)    |
                    +--------+-----------+
                             |
            +-------+--------+--------+--------+--------+
            |       |        |        |        |        |
     +------v-+ +--v----+ +-v------+ +v-----+ +v------+|
     |ecommerce| | saas  | |market- | |retail| |consult-||
     |.jsonld  | |.jsonld| |place   | |.jsonld||ing     ||
     |         | |       | |.jsonld | |      | |.jsonld ||
     +---------+ +-------+ +--------+ +------+ +-------+|
            |       |        |        |        |         |
            +-------+--------+--------+--------+---------+
                             |
                    +--------v-----------+
                    | cross-domain.jsonld |
                    | (Cross-Domain)     |
                    +--------------------+

                    +-------------------+     +--------------------+
                    | shapes.jsonld     |     | shapes-sbvr.jsonld |
                    | (SHACL Shapes)    |     | (SBVR Shapes)     |
                    +-------------------+     +--------------------+
```

**Import Rules:**

1. The **upper ontology** has no imports. It defines the BDI cognitive architecture and all SBVR metaclasses.
2. **Business-core** imports the upper ontology. It defines universal business concepts.
3. The **five domain ontologies** (ecommerce, saas, marketplace, retail, consulting) each import business-core (and transitively, upper).
4. **Cross-domain** imports all five domain ontologies plus business-core, enabling it to define inter-domain relationships.
5. **Shapes** files are standalone validation artifacts; they reference classes from the other ontologies but are not imported by them.

---

## 6. Upper Ontology — `mabos-upper.jsonld`

### 6.1 Overview

| Property      | Value                                                                                                                        |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **File**      | `mabos-upper.jsonld`                                                                                                         |
| **Lines**     | 779                                                                                                                          |
| **Namespace** | `https://mabos.io/ontology/upper`                                                                                            |
| **Imports**   | None (root ontology)                                                                                                         |
| **Purpose**   | Top-level abstract concepts for the BDI cognitive architecture, multi-agent coordination, and all SBVR metaclass definitions |

The upper ontology serves a dual role. First, it defines the SBVR metaclasses and properties that the entire ontology stack uses for formal annotations. Second, it defines the BDI (Belief-Desire-Intention) cognitive architecture that governs how MABOS agents think, plan, and coordinate.

### 6.2 SBVR Metaclasses (12)

These metaclasses define the SBVR metamodel itself. They are used as `@type` values and property definitions throughout all other ontologies.

| Metaclass                | Purpose                                                  |
| ------------------------ | -------------------------------------------------------- |
| `sbvr:VocabularyElement` | Abstract parent for all vocabulary elements              |
| `sbvr:NounConcept`       | Category of things (maps to OWL class)                   |
| `sbvr:IndividualConcept` | Specific named instance of a noun concept                |
| `sbvr:VerbConcept`       | Relationship between noun concepts                       |
| `sbvr:FactType`          | Structured proposition combining concepts via roles      |
| `sbvr:FactTypeRole`      | A position within a fact type                            |
| `sbvr:BusinessRule`      | Constraint or derivation over fact types                 |
| `sbvr:DefinitionalRule`  | Rule that defines the meaning of a concept               |
| `sbvr:BehavioralRule`    | Rule that constrains permissible states                  |
| `sbvr:ProofTable`        | Collection of proof entries for a rule                   |
| `sbvr:ProofEntry`        | Single validation record with truth value and confidence |
| `sbvr:Vocabulary`        | Named collection of vocabulary elements                  |

### 6.3 SBVR Properties (16)

| Property                   | Domain            | Range        | Purpose                              |
| -------------------------- | ----------------- | ------------ | ------------------------------------ |
| `sbvr:hasDesignation`      | VocabularyElement | xsd:string   | Human-readable term                  |
| `sbvr:hasDefinition`       | VocabularyElement | xsd:string   | Natural language definition          |
| `sbvr:hasGeneralConcept`   | NounConcept       | NounConcept  | Generalization (parent concept)      |
| `sbvr:hasRole`             | FactType          | FactTypeRole | Roles participating in the fact type |
| `sbvr:roleArity`           | FactType          | xsd:integer  | Number of roles in the fact type     |
| `sbvr:hasReading`          | FactType          | xsd:string   | Natural language reading             |
| `sbvr:rolePlayer`          | FactTypeRole      | NounConcept  | The concept that fills a role        |
| `sbvr:roleName`            | FactTypeRole      | xsd:string   | Name of the role position            |
| `sbvr:ruleType`            | BusinessRule      | xsd:string   | "definitional" or "behavioral"       |
| `sbvr:ruleModality`        | BusinessRule      | xsd:string   | "alethic" or "deontic"               |
| `sbvr:constrainsFact`      | BusinessRule      | FactType     | The fact type a rule governs         |
| `sbvr:hasProofTable`       | BusinessRule      | ProofTable   | Validation evidence for a rule       |
| `sbvr:hasProofEntry`       | ProofTable        | ProofEntry   | Individual validation record         |
| `sbvr:truthValue`          | ProofEntry        | xsd:boolean  | Whether the rule holds               |
| `sbvr:entryConfidence`     | ProofEntry        | xsd:decimal  | Confidence score (0.0-1.0)           |
| `sbvr:belongsToVocabulary` | VocabularyElement | Vocabulary   | Vocabulary assignment                |

### 6.4 BDI Agent Classes (33)

The BDI architecture classes form the cognitive substrate for all MABOS agents.

| Class                     | Superclass           | SBVR Definition                                                      |
| ------------------------- | -------------------- | -------------------------------------------------------------------- |
| `Agent`                   | owl:Thing            | An autonomous entity capable of perceiving, reasoning, and acting    |
| `Belief`                  | owl:Thing            | A proposition an agent holds to be true about the world              |
| `Desire`                  | owl:Thing            | A state of affairs an agent wishes to achieve                        |
| `Goal`                    | Desire               | A desire the agent has committed to pursuing                         |
| `Intention`               | owl:Thing            | A committed plan of action to achieve a goal                         |
| `Plan`                    | owl:Thing            | An ordered sequence of actions to achieve a goal                     |
| `PlanStep`                | owl:Thing            | A single action within a plan                                        |
| `Case`                    | owl:Thing            | A unit of work managed through a lifecycle                           |
| `Playbook`                | owl:Thing            | A collection of rules and procedures for a domain                    |
| `Stakeholder`             | Agent                | An agent with an interest in the system outcomes                     |
| `Contractor`              | Agent                | An external agent engaged for specific work packages                 |
| `WorkPackage`             | owl:Thing            | A defined unit of deliverable work                                   |
| `Decision`                | owl:Thing            | A choice made by an agent based on reasoning                         |
| `ReasoningMethod`         | owl:Thing            | A method for deriving conclusions from evidence                      |
| `CommitmentStrategy`      | owl:Thing            | A strategy for maintaining or revising commitments                   |
| `Performative`            | owl:Thing            | A speech act type in agent communication                             |
| `Message`                 | owl:Thing            | A communication unit between agents                                  |
| `Organization`            | owl:Thing            | A structured group of agents with shared goals                       |
| `Role`                    | owl:Thing            | A function or position within an organization                        |
| `Workflow`                | owl:Thing            | A defined sequence of activities                                     |
| `Event`                   | owl:Thing            | An occurrence that may trigger agent responses                       |
| `Metric`                  | owl:Thing            | A quantitative measure of performance or state                       |
| `Rule`                    | owl:Thing            | A formal constraint or policy                                        |
| `Fact`                    | owl:Thing            | A proposition asserted as true in the knowledge base                 |
| `WorkingMemory`           | owl:Thing            | Active short-term storage for current reasoning context              |
| `ShortTermMemory`         | owl:Thing            | Temporary storage with decay characteristics                         |
| `LongTermMemory`          | owl:Thing            | Persistent storage for learned knowledge                             |
| `CoordinationProtocol`    | owl:Thing            | A protocol for multi-agent coordination                              |
| `ContractNet`             | CoordinationProtocol | A protocol for task allocation via bidding                           |
| `InferenceEngine`         | owl:Thing            | A component that derives new knowledge from existing facts and rules |
| `Hypothesis`              | owl:Thing            | A tentative explanation requiring validation                         |
| `CausalReasoning`         | ReasoningMethod      | Reasoning about cause-effect relationships                           |
| `CounterfactualReasoning` | ReasoningMethod      | Reasoning about alternative scenarios                                |
| `BayesianReasoning`       | ReasoningMethod      | Probabilistic reasoning using Bayes' theorem                         |

### 6.5 Object Properties (22)

| Property          | Domain       | Range                | Description                              |
| ----------------- | ------------ | -------------------- | ---------------------------------------- |
| `hasBelief`       | Agent        | Belief               | Links agent to its beliefs               |
| `hasDesire`       | Agent        | Desire               | Links agent to its desires               |
| `hasIntention`    | Agent        | Intention            | Links agent to its intentions            |
| `hasGoal`         | Agent        | Goal                 | Links agent to its goals                 |
| `executesPlan`    | Intention    | Plan                 | Links intention to its executing plan    |
| `servesGoal`      | Plan         | Goal                 | Links plan to the goal it serves         |
| `hasStep`         | Plan         | PlanStep             | Links plan to its steps                  |
| `hasSubStep`      | PlanStep     | PlanStep             | Hierarchical step decomposition          |
| `hasRole`         | Organization | Role                 | Links organization to its roles          |
| `belongsTo`       | Agent        | Organization         | Links agent to its organization          |
| `sendsMessage`    | Agent        | Message              | Agent sends a message                    |
| `receivesMessage` | Agent        | Message              | Agent receives a message                 |
| `hasPerformative` | Message      | Performative         | Links message to its speech act type     |
| `triggersEvent`   | Agent        | Event                | Agent triggers an event                  |
| `measuredBy`      | Goal         | Metric               | Links goal to its measurement metric     |
| `governedBy`      | Agent        | Rule                 | Links agent to the rules governing it    |
| `derivedFrom`     | Fact         | Fact                 | Provenance chain between facts           |
| `usesProtocol`    | Agent        | CoordinationProtocol | Links agent to its coordination protocol |
| `assignedTo`      | WorkPackage  | Agent                | Links work package to assigned agent     |
| `raisedBy`        | Event        | Agent                | Links event to its originating agent     |
| `resolvedBy`      | Event        | Agent                | Links event to the resolving agent       |
| `storedIn`        | Fact         | WorkingMemory        | Links fact to its memory location        |

### 6.6 Datatype Properties (11)

| Property         | Range        | Description                                |
| ---------------- | ------------ | ------------------------------------------ |
| `certainty`      | xsd:decimal  | Confidence in a belief (0.0-1.0)           |
| `priority`       | xsd:integer  | Priority ordering for goals and intentions |
| `urgency`        | xsd:decimal  | Time-sensitivity score                     |
| `trustScore`     | xsd:decimal  | Trust metric for agents                    |
| `confidence`     | xsd:decimal  | General confidence score                   |
| `importance`     | xsd:decimal  | Importance weighting                       |
| `validFrom`      | xsd:dateTime | Temporal start of validity                 |
| `validUntil`     | xsd:dateTime | Temporal end of validity                   |
| `conversationId` | xsd:string   | Identifier linking related messages        |
| `similarity`     | xsd:decimal  | Similarity score between concepts          |
| `outcome`        | xsd:string   | Result of a decision or action             |

---

## 7. Business Core Ontology — `business-core.jsonld`

### 7.1 Overview

| Property      | Value                                                       |
| ------------- | ----------------------------------------------------------- |
| **File**      | `business-core.jsonld`                                      |
| **Lines**     | 915                                                         |
| **Namespace** | `https://mabos.io/ontology/business-core`                   |
| **Imports**   | `mabos-upper.jsonld`                                        |
| **Purpose**   | Universal business concepts applicable to all venture types |

Business-core is the most substantial ontology in the stack. It defines the concepts that every business venture shares regardless of its specific domain — financial metrics, customers, products, services, processes, compliance, and marketing. It also contains all 8 formally defined business rules with proof tables.

### 7.2 Classes (37)

| Class                    | Superclass          | Description                                          |
| ------------------------ | ------------------- | ---------------------------------------------------- |
| `Business`               | upper:Organization  | A venture or enterprise                              |
| `LegalEntity`            | owl:Thing           | A legally recognized organization                    |
| `FinancialMetric`        | upper:Metric        | A quantitative financial measure                     |
| `Revenue`                | FinancialMetric     | Income from business operations                      |
| `Expense`                | FinancialMetric     | Costs incurred by the business                       |
| `CashFlow`               | FinancialMetric     | Net movement of cash                                 |
| `Budget`                 | owl:Thing           | A financial plan for a period                        |
| `ForecastPeriod`         | owl:Thing           | A time period for financial forecasting              |
| `FinancialReport`        | owl:Thing           | A structured financial summary                       |
| `Transaction`            | owl:Thing           | A financial exchange                                 |
| `ChartOfAccounts`        | owl:Thing           | The accounting structure                             |
| `Customer`               | upper:Agent         | A party that purchases products or services          |
| `Product`                | owl:Thing           | A tangible or digital good offered for sale          |
| `Service`                | owl:Thing           | An intangible offering                               |
| `BusinessProcess`        | upper:Workflow      | A defined business activity sequence                 |
| `Pipeline`               | owl:Thing           | A staged workflow for tracking progress              |
| `Stage`                  | owl:Thing           | A phase within a pipeline                            |
| `Department`             | upper:Organization  | An organizational subdivision                        |
| `Contract`               | owl:Thing           | A formal agreement between parties                   |
| `Invoice`                | owl:Thing           | A request for payment                                |
| `TaxObligation`          | owl:Thing           | A tax liability                                      |
| `ComplianceRequirement`  | owl:Thing           | A regulatory or policy constraint                    |
| `BusinessLicense`        | owl:Thing           | A permit to operate                                  |
| `BusinessModelCanvas`    | owl:Thing           | A strategic management template                      |
| `KPI`                    | upper:Metric        | A key performance indicator                          |
| `MarketingCampaign`      | owl:Thing           | A coordinated marketing effort                       |
| `AdCampaign`             | MarketingCampaign   | A paid advertising campaign                          |
| `SalesChannel`           | owl:Thing           | A pathway for selling products/services              |
| `MarketingChannel`       | owl:Thing           | A medium for marketing communications                |
| `ContentAsset`           | owl:Thing           | A piece of marketing or knowledge content            |
| `Audience`               | owl:Thing           | A target group for marketing                         |
| `ContentCalendar`        | owl:Thing           | A schedule for content publication                   |
| `Integration`            | owl:Thing           | A connection between systems                         |
| `Webhook`                | Integration         | An event-driven HTTP callback                        |
| `EnterpriseArchitecture` | owl:Thing           | The structural design of the business and IT systems |
| `BMC`                    | BusinessModelCanvas | Alias for Business Model Canvas                      |
| `TroposModel`            | owl:Thing           | An agent-oriented requirements model                 |

### 7.3 Object Properties (24)

| Property             | Domain            | Range                  |
| -------------------- | ----------------- | ---------------------- |
| `hasRevenue`         | Business          | Revenue                |
| `hasExpense`         | Business          | Expense                |
| `hasCustomer`        | Business          | Customer               |
| `hasProduct`         | Business          | Product                |
| `hasService`         | Business          | Service                |
| `hasProcess`         | Business          | BusinessProcess        |
| `hasLegalEntity`     | Business          | LegalEntity            |
| `tracksKPI`          | Business          | KPI                    |
| `hasBudget`          | Business          | Budget                 |
| `hasPipeline`        | Business          | Pipeline               |
| `hasStage`           | Pipeline          | Stage                  |
| `hasDepartment`      | Business          | Department             |
| `hasIntegration`     | Business          | Integration            |
| `runsCampaign`       | Business          | MarketingCampaign      |
| `targetsAudience`    | MarketingCampaign | Audience               |
| `publishedOn`        | ContentAsset      | MarketingChannel       |
| `soldThrough`        | Product           | SalesChannel           |
| `triggeredByWebhook` | Event             | Webhook                |
| `requiresCompliance` | Business          | ComplianceRequirement  |
| `requiresLicense`    | Business          | BusinessLicense        |
| `hasTaxObligation`   | Business          | TaxObligation          |
| `hasArchitecture`    | Business          | EnterpriseArchitecture |
| `hasBMC`             | Business          | BMC                    |
| `hasTroposModel`     | Business          | TroposModel            |

### 7.4 Datatype Properties (10)

| Property         | Range       | Description                         |
| ---------------- | ----------- | ----------------------------------- |
| `revenueAmount`  | xsd:decimal | Monetary value of revenue           |
| `expenseAmount`  | xsd:decimal | Monetary value of expense           |
| `budgetAmount`   | xsd:decimal | Allocated budget                    |
| `budgetSpent`    | xsd:decimal | Amount spent against budget         |
| `kpiTarget`      | xsd:decimal | Target value for a KPI              |
| `kpiActual`      | xsd:decimal | Actual measured value of a KPI      |
| `businessType`   | xsd:string  | Type classification of the business |
| `businessStatus` | xsd:string  | Current operational status          |
| `campaignBudget` | xsd:decimal | Budget allocated to a campaign      |
| `campaignROAS`   | xsd:decimal | Return on ad spend                  |

### 7.5 Business Rules (8)

Business-core defines 8 formal business rules, the only ontology that contains explicit rules. See Section 16 for detailed analysis of rule types and modalities.

| Rule ID                       | Label                             | Type         | Modality | Constrains Fact     |
| ----------------------------- | --------------------------------- | ------------ | -------- | ------------------- |
| `rule_businessHasLegalEntity` | Business must have a legal entity | Definitional | Alethic  | hasLegalEntity      |
| `rule_customerHasIdentifier`  | Customer must have an identifier  | Behavioral   | Deontic  | (Customer property) |
| `rule_orderHasOneCustomer`    | Order has exactly one customer    | Definitional | Alethic  | (Order-Customer)    |
| `rule_revenueNotNegative`     | Revenue cannot be negative        | Behavioral   | Deontic  | (Revenue property)  |
| `rule_kpiHasTargetAndActual`  | KPI must have target and actual   | Definitional | Alethic  | (KPI properties)    |
| `rule_businessHasType`        | Business must have a type         | Definitional | Alethic  | businessType        |
| `rule_budgetNotExceedable`    | Spending must not exceed budget   | Behavioral   | Deontic  | (Budget properties) |
| `rule_pipelineHasStages`      | Pipeline must have stages         | Definitional | Alethic  | hasStage            |

---

## 8. E-Commerce Domain — `ecommerce.jsonld`

### 8.1 Overview

| Property      | Value                                                                               |
| ------------- | ----------------------------------------------------------------------------------- |
| **File**      | `ecommerce.jsonld`                                                                  |
| **Namespace** | `https://mabos.io/ontology/ecommerce`                                               |
| **Imports**   | `business-core.jsonld`                                                              |
| **Purpose**   | Concepts for online retail, inventory management, fulfillment, and digital commerce |

### 8.2 Classes (21)

| Class           | Description                                     |
| --------------- | ----------------------------------------------- |
| `Product`       | A sellable item with pricing and attributes     |
| `SKU`           | A stock keeping unit — unique product variant   |
| `Category`      | Product classification hierarchy                |
| `Order`         | A customer purchase transaction                 |
| `OrderItem`     | A line item within an order                     |
| `Customer`      | An e-commerce customer with purchase history    |
| `Cart`          | A temporary collection of items before purchase |
| `Inventory`     | Stock level tracking for products               |
| `Warehouse`     | A physical or logical storage location          |
| `Fulfillment`   | The process of preparing and shipping an order  |
| `Shipping`      | Delivery logistics and tracking                 |
| `Return`        | A product return or exchange                    |
| `Supplier`      | An entity that provides products                |
| `Campaign`      | A promotional marketing campaign                |
| `Channel`       | A sales or distribution channel                 |
| `PaymentMethod` | A method of payment (card, PayPal, etc.)        |
| `Coupon`        | A discount code or promotional offer            |
| `Wishlist`      | A customer's saved product list                 |
| `ProductReview` | A customer review of a product                  |
| `Collection`    | A curated group of products                     |
| `Subscription`  | A recurring purchase arrangement                |

### 8.3 Datatype Properties (16)

| Property                | Range       | Description                             |
| ----------------------- | ----------- | --------------------------------------- |
| `price`                 | xsd:decimal | Selling price                           |
| `cost`                  | xsd:decimal | Cost of goods                           |
| `compareAtPrice`        | xsd:decimal | Original/comparison price for discounts |
| `stockLevel`            | xsd:integer | Current inventory quantity              |
| `reorderPoint`          | xsd:integer | Threshold for reorder trigger           |
| `safetyStock`           | xsd:integer | Minimum safety stock level              |
| `leadTimeDays`          | xsd:integer | Supplier lead time in days              |
| `conversionRate`        | xsd:decimal | Visitor-to-buyer conversion rate        |
| `cartAbandonmentRate`   | xsd:decimal | Rate of abandoned carts                 |
| `customerLifetimeValue` | xsd:decimal | Predicted total customer value          |
| `acquisitionCost`       | xsd:decimal | Cost to acquire a customer              |
| `averageOrderValue`     | xsd:decimal | Mean order value                        |
| `purchaseFrequency`     | xsd:decimal | Average purchases per period            |
| `rating`                | xsd:decimal | Product or review rating                |
| `grossMargin`           | xsd:decimal | Gross profit margin                     |
| `returnRate`            | xsd:decimal | Rate of product returns                 |

### 8.4 Object Properties (13)

| Property            | Domain        | Range         |
| ------------------- | ------------- | ------------- |
| `belongsToCategory` | Product       | Category      |
| `hasParentCategory` | Category      | Category      |
| `suppliedBy`        | Product       | Supplier      |
| `fulfilledVia`      | Order         | Fulfillment   |
| `fulfilledFrom`     | Fulfillment   | Warehouse     |
| `shippedVia`        | Order         | Shipping      |
| `soldOn`            | Product       | Channel       |
| `paidWith`          | Order         | PaymentMethod |
| `appliedCoupon`     | Order         | Coupon        |
| `reviewedProduct`   | ProductReview | Product       |
| `placedBy`          | Order         | Customer      |
| `inCollection`      | Product       | Collection    |
| `storedAt`          | Inventory     | Warehouse     |

---

## 9. SaaS Domain — `saas.jsonld`

### 9.1 Overview

| Property      | Value                                                                                                               |
| ------------- | ------------------------------------------------------------------------------------------------------------------- |
| **File**      | `saas.jsonld`                                                                                                       |
| **Namespace** | `https://mabos.io/ontology/saas`                                                                                    |
| **Imports**   | `business-core.jsonld`                                                                                              |
| **Purpose**   | Concepts for software-as-a-service businesses — subscriptions, tenancy, feature management, and platform operations |

### 9.2 Classes (20)

| Class             | Description                                      |
| ----------------- | ------------------------------------------------ |
| `Subscription`    | A recurring service agreement                    |
| `Plan`            | A pricing tier or service package                |
| `Feature`         | A product capability                             |
| `FeatureFlag`     | A toggleable feature control                     |
| `Tenant`          | A customer organization in a multi-tenant system |
| `User`            | An individual user within a tenant               |
| `Usage`           | Metered consumption of resources                 |
| `Deployment`      | A release deployed to infrastructure             |
| `Release`         | A versioned software release                     |
| `Incident`        | A service disruption or issue                    |
| `Trial`           | A time-limited free evaluation period            |
| `API`             | An application programming interface             |
| `APIEndpoint`     | A specific API route/method                      |
| `WebhookConfig`   | A webhook subscription configuration             |
| `SaaSIntegration` | A third-party integration                        |
| `SLA`             | A service level agreement                        |
| `Onboarding`      | A customer onboarding process                    |
| `ABTest`          | An A/B testing experiment                        |
| `Cohort`          | A group of users sharing characteristics         |
| `SupportTicket`   | A customer support request                       |

### 9.3 Datatype Properties (16)

| Property              | Range       | Description                        |
| --------------------- | ----------- | ---------------------------------- |
| `mrr`                 | xsd:decimal | Monthly recurring revenue          |
| `arr`                 | xsd:decimal | Annual recurring revenue           |
| `churnRate`           | xsd:decimal | Customer churn rate                |
| `revenueChurn`        | xsd:decimal | Revenue churn rate                 |
| `activationRate`      | xsd:decimal | Rate of new user activation        |
| `trialConversionRate` | xsd:decimal | Trial-to-paid conversion rate      |
| `nps`                 | xsd:integer | Net promoter score                 |
| `uptime`              | xsd:decimal | Service availability percentage    |
| `latencyP99`          | xsd:decimal | 99th percentile latency            |
| `dailyActiveUsers`    | xsd:integer | DAU count                          |
| `weeklyActiveUsers`   | xsd:integer | WAU count                          |
| `seatCount`           | xsd:integer | Number of licensed seats           |
| `expansionRevenue`    | xsd:decimal | Revenue from upsells/expansions    |
| `timeToValue`         | xsd:decimal | Time for customer to realize value |
| `burnRate`            | xsd:decimal | Monthly cash burn rate             |
| `runway`              | xsd:decimal | Months of remaining funding        |

### 9.4 Object Properties (12)

| Property            | Domain       | Range         |
| ------------------- | ------------ | ------------- |
| `subscribedTo`      | Tenant       | Plan          |
| `includesFeature`   | Plan         | Feature       |
| `controlledBy`      | Feature      | FeatureFlag   |
| `deployedAs`        | Release      | Deployment    |
| `exposesAPI`        | Tenant       | API           |
| `hasEndpoint`       | API          | APIEndpoint   |
| `coveredBySLA`      | Subscription | SLA           |
| `belongsToCohort`   | User         | Cohort        |
| `hasUser`           | Tenant       | User          |
| `impactedBy`        | Tenant       | Incident      |
| `configuredWebhook` | Tenant       | WebhookConfig |
| `onboardedVia`      | Tenant       | Onboarding    |

---

## 10. Marketplace Domain — `marketplace.jsonld`

### 10.1 Overview

| Property      | Value                                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------ |
| **File**      | `marketplace.jsonld`                                                                                   |
| **Namespace** | `https://mabos.io/ontology/marketplace`                                                                |
| **Imports**   | `business-core.jsonld`                                                                                 |
| **Purpose**   | Concepts for two-sided marketplaces — sellers, buyers, listings, trust, escrow, and dispute resolution |

### 10.2 Classes (18)

| Class            | Description                                              |
| ---------------- | -------------------------------------------------------- |
| `Seller`         | A party that offers goods or services on the marketplace |
| `Buyer`          | A party that purchases on the marketplace                |
| `Listing`        | An item or service offered for sale                      |
| `Transaction`    | A completed purchase on the marketplace                  |
| `Review`         | A feedback rating from buyer or seller                   |
| `Dispute`        | A conflict between parties requiring resolution          |
| `Commission`     | The marketplace's fee on a transaction                   |
| `TrustScore`     | A computed trust metric for a participant                |
| `Category`       | A marketplace category for listings                      |
| `Escrow`         | Funds held in trust during a transaction                 |
| `Payout`         | Payment disbursement to a seller                         |
| `Verification`   | Identity or quality verification of a participant        |
| `SearchQuery`    | A buyer's search request                                 |
| `Recommendation` | A personalized listing suggestion                        |
| `Promotion`      | A paid or algorithmic listing boost                      |
| `SellerTier`     | A classification level for sellers                       |
| `Message`        | Communication between buyer and seller                   |
| `Offer`          | A price negotiation from a buyer                         |

### 10.3 Datatype Properties (14)

| Property                  | Range       | Description                       |
| ------------------------- | ----------- | --------------------------------- |
| `takeRate`                | xsd:decimal | Marketplace commission percentage |
| `gmv`                     | xsd:decimal | Gross merchandise value           |
| `netRevenue`              | xsd:decimal | Revenue after payouts             |
| `sellerRating`            | xsd:decimal | Average seller rating             |
| `buyerRating`             | xsd:decimal | Average buyer rating              |
| `liquidity`               | xsd:decimal | Market liquidity measure          |
| `completionRate`          | xsd:decimal | Transaction completion rate       |
| `responseTime`            | xsd:decimal | Average response time             |
| `disputeRate`             | xsd:decimal | Rate of disputes per transaction  |
| `repeatPurchaseRate`      | xsd:decimal | Rate of repeat purchases          |
| `listingCount`            | xsd:integer | Number of active listings         |
| `viewsToTransaction`      | xsd:decimal | View-to-transaction conversion    |
| `averageTransactionValue` | xsd:decimal | Mean transaction value            |
| `payoutDelay`             | xsd:integer | Days between sale and payout      |

### 10.4 Object Properties (16)

| Property            | Domain      | Range        |
| ------------------- | ----------- | ------------ |
| `listedBy`          | Listing     | Seller       |
| `purchasedBy`       | Transaction | Buyer        |
| `soldBy`            | Transaction | Seller       |
| `forListing`        | Transaction | Listing      |
| `reviewOf`          | Review      | Transaction  |
| `reviewBySeller`    | Review      | Seller       |
| `reviewByBuyer`     | Review      | Buyer        |
| `disputeOn`         | Dispute     | Transaction  |
| `heldInEscrow`      | Transaction | Escrow       |
| `paidOut`           | Escrow      | Payout       |
| `inCategory`        | Listing     | Category     |
| `hasParentCategory` | Category    | Category     |
| `verifiedBy`        | Seller      | Verification |
| `hasTier`           | Seller      | SellerTier   |
| `madeOffer`         | Buyer       | Offer        |
| `offerOnListing`    | Offer       | Listing      |

---

## 11. Retail Domain — `retail.jsonld`

### 11.1 Overview

| Property      | Value                                                                                                                            |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **File**      | `retail.jsonld`                                                                                                                  |
| **Namespace** | `https://mabos.io/ontology/retail`                                                                                               |
| **Imports**   | `business-core.jsonld`                                                                                                           |
| **Purpose**   | Concepts for brick-and-mortar and omnichannel retail — stores, inventory, planograms, loyalty programs, and workforce management |

### 11.2 Classes (18)

| Class             | Description                                         |
| ----------------- | --------------------------------------------------- |
| `Store`           | A physical retail location                          |
| `PointOfSale`     | A checkout terminal or system                       |
| `Product`         | A retail product                                    |
| `Shelf`           | A physical display location                         |
| `Planogram`       | A visual merchandising plan                         |
| `Promotion`       | A retail promotional event                          |
| `LoyaltyProgram`  | A customer rewards program                          |
| `LoyaltyMember`   | A participant in the loyalty program                |
| `Vendor`          | A product supplier to the retailer                  |
| `PurchaseOrder`   | An order placed with a vendor                       |
| `Employee`        | A retail staff member                               |
| `Shift`           | A work shift assignment                             |
| `SeasonalEvent`   | A time-bound retail event (holidays, sales seasons) |
| `CustomerSegment` | A behavioral or demographic customer group          |
| `StoreLayout`     | The physical arrangement of a store                 |
| `Department`      | A section within a store                            |
| `InventoryCount`  | A physical inventory audit                          |
| `Receipt`         | A proof of purchase                                 |

### 11.3 Datatype Properties (14)

| Property              | Range       | Description                       |
| --------------------- | ----------- | --------------------------------- |
| `footTraffic`         | xsd:integer | Number of store visitors          |
| `salesPerSqFt`        | xsd:decimal | Revenue per square foot           |
| `shrinkageRate`       | xsd:decimal | Inventory loss rate               |
| `turnoverRate`        | xsd:decimal | Inventory turnover rate           |
| `basketSize`          | xsd:decimal | Average basket value              |
| `itemsPerTransaction` | xsd:decimal | Average items per sale            |
| `conversionRate`      | xsd:decimal | Visitor-to-buyer conversion       |
| `laborCostPercent`    | xsd:decimal | Labor as percentage of revenue    |
| `rentPerSqFt`         | xsd:decimal | Rent cost per square foot         |
| `storeArea`           | xsd:decimal | Total store area                  |
| `loyaltyPoints`       | xsd:integer | Points balance                    |
| `loyaltyTier`         | xsd:string  | Tier level in loyalty program     |
| `employeeEfficiency`  | xsd:decimal | Sales per employee                |
| `daysOnHand`          | xsd:integer | Average days of inventory on hand |

### 11.4 Object Properties (16)

| Property            | Domain        | Range           |
| ------------------- | ------------- | --------------- |
| `locatedAt`         | PointOfSale   | Store           |
| `soldAt`            | Product       | Store           |
| `suppliedBy`        | Product       | Vendor          |
| `orderedFrom`       | PurchaseOrder | Vendor          |
| `orderedFor`        | PurchaseOrder | Product         |
| `placedOnShelf`     | Product       | Shelf           |
| `shelfInDepartment` | Shelf         | Department      |
| `followsPlanogram`  | Shelf         | Planogram       |
| `worksAt`           | Employee      | Store           |
| `hasShift`          | Employee      | Shift           |
| `enrolledIn`        | LoyaltyMember | LoyaltyProgram  |
| `processedAt`       | Receipt       | PointOfSale     |
| `affectedBy`        | Product       | SeasonalEvent   |
| `targetsSegment`    | Promotion     | CustomerSegment |
| `hasLayout`         | Store         | StoreLayout     |

---

## 12. Consulting Domain — `consulting.jsonld`

### 12.1 Overview

| Property      | Value                                                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **File**      | `consulting.jsonld`                                                                                                            |
| **Namespace** | `https://mabos.io/ontology/consulting`                                                                                         |
| **Imports**   | `business-core.jsonld`                                                                                                         |
| **Purpose**   | Concepts for professional services firms — engagements, deliverables, time tracking, expertise management, and knowledge reuse |

### 12.2 Classes (18)

| Class               | Description                                   |
| ------------------- | --------------------------------------------- |
| `Engagement`        | A client project or service agreement         |
| `Client`            | An organization receiving consulting services |
| `Proposal`          | A formal offer to provide services            |
| `SOW`               | Statement of work — scope and terms           |
| `Deliverable`       | A tangible output of an engagement            |
| `Milestone`         | A key checkpoint within an engagement         |
| `ServiceLine`       | A category of consulting services             |
| `Expert`            | A consultant with specialized knowledge       |
| `TimeEntry`         | A record of billable or non-billable hours    |
| `ConsultingInvoice` | A bill for services rendered                  |
| `RiskRegister`      | A collection of identified risks              |
| `Risk`              | A potential negative event                    |
| `KnowledgeBase`     | A repository of reusable knowledge            |
| `Template`          | A reusable document or process template       |
| `Framework`         | A structured methodology or approach          |
| `Workshop`          | A collaborative working session               |
| `Stakeholder`       | A person with interest in the engagement      |
| `ChangeRequest`     | A request to modify engagement scope          |

### 12.3 Datatype Properties (15)

| Property            | Range       | Description                          |
| ------------------- | ----------- | ------------------------------------ |
| `billableRate`      | xsd:decimal | Hourly billing rate                  |
| `costRate`          | xsd:decimal | Internal cost per hour               |
| `utilizationRate`   | xsd:decimal | Percentage of billable time          |
| `engagementValue`   | xsd:decimal | Total engagement contract value      |
| `revenueRecognized` | xsd:decimal | Revenue recognized to date           |
| `satisfactionScore` | xsd:decimal | Client satisfaction rating           |
| `hoursLogged`       | xsd:decimal | Total hours logged                   |
| `isBillable`        | xsd:boolean | Whether time entry is billable       |
| `riskProbability`   | xsd:decimal | Likelihood of a risk occurring       |
| `riskImpact`        | xsd:decimal | Severity if risk occurs              |
| `marginPercent`     | xsd:decimal | Profit margin percentage             |
| `scopeCreep`        | xsd:decimal | Degree of scope expansion            |
| `repeatRate`        | xsd:decimal | Client repeat engagement rate        |
| `pipelineValue`     | xsd:decimal | Total value of proposals in pipeline |
| `winProbability`    | xsd:decimal | Probability of winning a proposal    |

### 12.4 Object Properties (15)

| Property             | Domain       | Range         |
| -------------------- | ------------ | ------------- |
| `hasClient`          | Engagement   | Client        |
| `hasDeliverable`     | Engagement   | Deliverable   |
| `hasMilestone`       | Engagement   | Milestone     |
| `assignedExpert`     | Engagement   | Expert        |
| `partOfServiceLine`  | Engagement   | ServiceLine   |
| `governedBySOW`      | Engagement   | SOW           |
| `hasRiskRegister`    | Engagement   | RiskRegister  |
| `containsRisk`       | RiskRegister | Risk          |
| `usesFramework`      | Engagement   | Framework     |
| `usesTemplate`       | Deliverable  | Template      |
| `loggedFor`          | TimeEntry    | Engagement    |
| `loggedBy`           | TimeEntry    | Expert        |
| `resultedInProposal` | Client       | Proposal      |
| `hasChangeRequest`   | Engagement   | ChangeRequest |
| `clientStakeholder`  | Engagement   | Stakeholder   |

---

## 13. Cross-Domain Relationships — `cross-domain.jsonld`

### 13.1 Overview

| Property    | Value                                                                                                              |
| ----------- | ------------------------------------------------------------------------------------------------------------------ |
| **File**    | `cross-domain.jsonld`                                                                                              |
| **Imports** | All 5 domain ontologies + business-core                                                                            |
| **Purpose** | Inter-domain relationships, equivalences, and mappings that enable portfolio-level reasoning across business types |

The cross-domain ontology is unique in the stack: it does not define domain-specific concepts, but rather the bridges between domains. When a business operates simultaneously as an e-commerce store and a marketplace (or any combination), these cross-domain relationships enable coherent reasoning across the boundaries.

### 13.2 Cross-Domain Object Properties (9)

| Property                            | Domains           | Ranges                | Mapping                                  |
| ----------------------------------- | ----------------- | --------------------- | ---------------------------------------- |
| E-commerce/Marketplace Customer     | ecom:Customer     | mkt:Buyer             | Shared customer identity across channels |
| Retail Vendor / E-commerce Supplier | retail:Vendor     | ecom:Supplier         | Supply chain unification                 |
| Consulting Client / SaaS Tenant     | consult:Client    | saas:Tenant           | Client-as-tenant mapping                 |
| Marketplace Seller / Retail Vendor  | mkt:Seller        | retail:Vendor         | Multi-channel seller identity            |
| Product Cross-Listings              | ecom:Product      | mkt:Listing           | Product-to-listing projection            |
| Shared Fulfillment                  | ecom:Fulfillment  | retail:Store          | Omnichannel fulfillment                  |
| BOPIS (Buy Online Pick Up In Store) | ecom:Order        | retail:Store          | Click-and-collect                        |
| Shared Inventory                    | ecom:Inventory    | retail:InventoryCount | Unified inventory view                   |
| Consulting-to-SaaS Productization   | consult:Framework | saas:Feature          | Methodology-to-product mapping           |

### 13.3 Portfolio Classes (4)

| Class                  | Description                                                  |
| ---------------------- | ------------------------------------------------------------ |
| `PortfolioMetric`      | An aggregate metric across multiple business domains         |
| `CrossSellOpportunity` | An opportunity to sell across domain boundaries              |
| `SharedResource`       | A resource (warehouse, team, platform) shared across domains |
| `Synergy`              | A measurable benefit from cross-domain integration           |

---

## 14. SHACL Validation Shapes — `shapes.jsonld`

### 14.1 Overview

| Property     | Value                                                          |
| ------------ | -------------------------------------------------------------- |
| **File**     | `shapes.jsonld`                                                |
| **Purpose**  | Structural validation constraints for MABOS ontology instances |
| **Standard** | W3C SHACL (Shapes Constraint Language)                         |

SHACL shapes define the structural requirements that instances of ontology classes must satisfy. When a new Agent, Belief, Goal, or Business is created, the shapes validate that all required properties are present and have correct types.

### 14.2 Shapes (13)

| Shape               | Target Class       | Key Constraints                                                                                |
| ------------------- | ------------------ | ---------------------------------------------------------------------------------------------- |
| `AgentShape`        | upper:Agent        | Must have at least one belief; must belong to an organization; must have a trust score         |
| `BeliefShape`       | upper:Belief       | Must have certainty (0.0-1.0); must have validFrom                                             |
| `GoalShape`         | upper:Goal         | Must have priority; must be measured by at least one metric                                    |
| `IntentionShape`    | upper:Intention    | Must execute a plan; must serve a goal                                                         |
| `PlanShape`         | upper:Plan         | Must have at least one step; must serve a goal                                                 |
| `FactShape`         | upper:Fact         | Must have confidence; must have a source                                                       |
| `DecisionShape`     | upper:Decision     | Must have an outcome; must have a reasoning method                                             |
| `BusinessShape`     | bcore:Business     | Must have businessType; must have at least one legal entity; must have at least one department |
| `OrganizationShape` | upper:Organization | Must have at least one role                                                                    |
| `ContractorShape`   | upper:Contractor   | Must be assigned to at least one work package                                                  |
| `MessageShape`      | upper:Message      | Must have a performative; must have a conversationId                                           |
| `WorkPackageShape`  | upper:WorkPackage  | Must be assigned to an agent; must have a status                                               |
| `KPIShape`          | bcore:KPI          | Must have kpiTarget and kpiActual                                                              |

### 14.3 SHACL Shape Pattern

Each shape follows a consistent structure:

```jsonld
{
  "@id": "shapes:AgentShape",
  "@type": "sh:NodeShape",
  "sh:targetClass": { "@id": "upper:Agent" },
  "sh:property": [
    {
      "sh:path": { "@id": "upper:hasBelief" },
      "sh:minCount": 1,
      "sh:class": { "@id": "upper:Belief" }
    },
    {
      "sh:path": { "@id": "upper:belongsTo" },
      "sh:minCount": 1,
      "sh:class": { "@id": "upper:Organization" }
    },
    {
      "sh:path": { "@id": "upper:trustScore" },
      "sh:datatype": { "@id": "xsd:decimal" },
      "sh:minInclusive": 0.0,
      "sh:maxInclusive": 1.0
    }
  ]
}
```

---

## 15. SBVR Validation Shapes — `shapes-sbvr.jsonld`

### 15.1 Overview

| Property    | Value                                                             |
| ----------- | ----------------------------------------------------------------- |
| **File**    | `shapes-sbvr.jsonld`                                              |
| **Purpose** | Enforce SBVR structural requirements across all ontology elements |

While `shapes.jsonld` validates domain instance data, `shapes-sbvr.jsonld` validates the ontology definitions themselves. It ensures that every class and property in the system has proper SBVR annotations.

### 15.2 Shapes (6)

| Shape               | Target                               | Key Constraints                                                                                                                                           |
| ------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NounConceptShape`  | owl:Class                            | Must have sbvr:hasDesignation (string); must have sbvr:hasDefinition (string); must have sbvr:belongsToVocabulary                                         |
| `FactTypeShape`     | owl:ObjectProperty with sbvr:hasRole | Must have sbvr:roleArity (integer, min 2); must have sbvr:hasReading (string); must have sbvr:hasRole (min 2)                                             |
| `FactTypeRoleShape` | sbvr:FactTypeRole                    | Must have sbvr:roleName (string); must have sbvr:rolePlayer (references owl:Class)                                                                        |
| `BusinessRuleShape` | sbvr:BusinessRule                    | Must have sbvr:ruleType (one of: "definitional", "behavioral"); must have sbvr:ruleModality (one of: "alethic", "deontic"); must have sbvr:constrainsFact |
| `ProofTableShape`   | sbvr:ProofTable                      | Must have at least one sbvr:hasProofEntry                                                                                                                 |
| `ProofEntryShape`   | sbvr:ProofEntry                      | Must have sbvr:truthValue (boolean); must have sbvr:entryConfidence (decimal, 0.0-1.0)                                                                    |

### 15.3 SBVR Shape Example

```jsonld
{
  "@id": "sbvr-shapes:NounConceptShape",
  "@type": "sh:NodeShape",
  "sh:targetClass": { "@id": "owl:Class" },
  "sh:property": [
    {
      "sh:path": { "@id": "sbvr:hasDesignation" },
      "sh:minCount": 1,
      "sh:datatype": { "@id": "xsd:string" },
      "sh:message": "Every OWL class (SBVR noun concept) must have a designation"
    },
    {
      "sh:path": { "@id": "sbvr:hasDefinition" },
      "sh:minCount": 1,
      "sh:datatype": { "@id": "xsd:string" },
      "sh:message": "Every OWL class (SBVR noun concept) must have a definition"
    },
    {
      "sh:path": { "@id": "sbvr:belongsToVocabulary" },
      "sh:minCount": 1,
      "sh:class": { "@id": "sbvr:Vocabulary" },
      "sh:message": "Every OWL class must be assigned to a vocabulary"
    }
  ]
}
```

---

## 16. SBVR Rule Types and Modalities

### 16.1 The Rule Classification Matrix

SBVR classifies business rules along two independent dimensions:

|                                      | **Alethic** (Logical Necessity)                                                        | **Deontic** (Obligation/Permission)                                        |
| ------------------------------------ | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **Definitional** (What things ARE)   | Structural truths that define the domain model. Violation means the data is malformed. | Definitions that are policy-based rather than logically necessary.         |
| **Behavioral** (What things MUST DO) | Behavioral constraints that hold by logical necessity.                                 | Behavioral constraints imposed by policy. Violation means a policy breach. |

### 16.2 Business-Core Rules Analyzed

#### Definitional-Alethic Rules (5)

These rules define what it means to be a valid instance of a concept. They cannot be overridden by policy because they are structurally necessary.

**rule_businessHasLegalEntity**

- **Reading:** "It is necessary that each Business has at least one LegalEntity"
- **Rationale:** A business without a legal entity is not a valid business — it has no legal existence.
- **Proof table entry:** truthValue: true, confidence: 1.0

**rule_orderHasOneCustomer**

- **Reading:** "It is necessary that each Order is placed by exactly one Customer"
- **Rationale:** An order with zero or multiple customers is structurally malformed.

**rule_kpiHasTargetAndActual**

- **Reading:** "It is necessary that each KPI has both a target value and an actual value"
- **Rationale:** A KPI without both values cannot be evaluated.

**rule_businessHasType**

- **Reading:** "It is necessary that each Business has a type classification"
- **Rationale:** The business type determines which domain ontology is loaded.

**rule_pipelineHasStages**

- **Reading:** "It is necessary that each Pipeline has at least one Stage"
- **Rationale:** A pipeline without stages is structurally empty and cannot track progress.

#### Behavioral-Deontic Rules (3)

These rules express policies that constrain what is permitted. They can theoretically be relaxed by changing policy, but doing so requires explicit governance decisions.

**rule_customerHasIdentifier**

- **Reading:** "It is obligatory that each Customer has a unique identifier"
- **Rationale:** Policy requirement for customer tracking and compliance.

**rule_revenueNotNegative**

- **Reading:** "It is obligatory that Revenue amount is not negative"
- **Rationale:** Negative revenue represents an accounting error or policy violation.

**rule_budgetNotExceedable**

- **Reading:** "It is obligatory that budget spending does not exceed the allocated budget"
- **Rationale:** Financial control policy. May be overridden with approval.

### 16.3 Rule Enforcement Pipeline

When the rule engine evaluates a business rule:

1. **Rule identification** — The rule is loaded from the ontology with its type and modality.
2. **Fact type resolution** — `sbvr:constrainsFact` identifies which fact type the rule governs.
3. **Instance evaluation** — Current facts in the fact store are checked against the rule's constraint.
4. **Proof table update** — A new ProofEntry is added with the truth value and confidence.
5. **Violation handling:**
   - **Alethic violations** are errors — the data is rejected.
   - **Deontic violations** are warnings — the data is accepted but flagged.

---

## 17. Ontology Loader, Validator, and Merger

### 17.1 Module Location

File: `ontology/index.ts`

### 17.2 Core Types

```typescript
interface OntologyNode {
  "@id": string;
  "@type": string | string[];
  [key: string]: any;
}

interface Ontology {
  "@context": Record<string, string>;
  "@graph": OntologyNode[];
  name: string;
  namespace: string;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface MergedGraph {
  classes: OntologyNode[];
  objectProperties: OntologyNode[];
  datatypeProperties: OntologyNode[];
  rules: OntologyNode[];
  individuals: OntologyNode[];
  allNodes: OntologyNode[];
  context: Record<string, string>;
}
```

### 17.3 SBVR Annotation Types

```typescript
interface SBVRConceptAnnotation {
  designation: string;
  definition: string;
  vocabulary: string;
  generalConcept?: string;
}

interface SBVRFactTypeAnnotation {
  designation: string;
  definition: string;
  vocabulary: string;
  roles: Array<{ roleName: string; rolePlayer: string }>;
  arity: number;
  reading: string;
}

interface SBVRRuleAnnotation {
  designation: string;
  definition: string;
  vocabulary: string;
  ruleType: "definitional" | "behavioral";
  ruleModality: "alethic" | "deontic";
  constrainsFact: string;
  proofTable?: {
    entries: Array<{ truthValue: boolean; confidence: number }>;
  };
}
```

### 17.4 Loader Functions

```typescript
function loadOntologies(): Promise<Ontology[]>;
```

Loads all 8 JSON-LD domain ontology files (upper, business-core, ecommerce, saas, marketplace, retail, consulting, cross-domain) from the `ontology/` directory. Returns an array of parsed Ontology objects.

```typescript
function loadShapes(): Promise<Ontology>;
```

Loads `shapes.jsonld` containing SHACL validation shapes.

```typescript
function loadSBVRShapes(): Promise<Ontology>;
```

Loads `shapes-sbvr.jsonld` containing SBVR-specific validation shapes.

### 17.5 Validation Function

```typescript
function validateOntologies(ontologies: Ontology[]): ValidationResult;
```

Performs 7 validation checks:

1. **Import resolution** — Every `owl:imports` declaration in every ontology must resolve to a loaded ontology namespace. Unresolved imports are errors.

2. **Domain/range references** — Every `rdfs:domain` and `rdfs:range` value on properties must resolve to a class defined in the loaded ontologies. Dangling references are errors.

3. **SubClassOf references** — Every `rdfs:subClassOf` value must resolve to an existing class. Broken inheritance chains are errors.

4. **Duplicate ID detection** — Scans all `@id` values across all ontologies. Duplicate IDs (same URI in different files) are errors.

5. **SBVR annotation completeness** — Every `owl:Class` and `owl:ObjectProperty` must have `sbvr:hasDesignation` and `sbvr:hasDefinition`. Missing annotations are warnings (not errors, to support incremental development).

6. **Arity/role count matching** — For every node with `sbvr:roleArity`, the number of `sbvr:hasRole` entries must match the declared arity. Mismatches are errors.

7. **RolePlayer resolution** — Every `sbvr:rolePlayer` reference must resolve to an existing `owl:Class`. Unresolvable players are errors.

### 17.6 Merger Function

```typescript
function mergeOntologies(ontologies: Ontology[]): MergedGraph;
```

Combines all loaded ontologies into a single queryable graph:

- Merges all `@context` blocks into a unified context.
- Concatenates all `@graph` arrays.
- Classifies nodes by `@type` into: classes, objectProperties, datatypeProperties, rules, individuals.
- The `allNodes` array contains every node for unclassified queries.

### 17.7 Convenience Functions

```typescript
function loadAndValidate(): Promise<{
  ontologies: Ontology[];
  validation: ValidationResult;
  graph: MergedGraph;
}>;
```

One-call workflow: load all ontologies, validate them, merge them.

```typescript
function getClassesForDomain(graph: MergedGraph, domain: string): OntologyNode[];
```

Returns all classes whose `@id` starts with the given domain namespace prefix.

```typescript
function getPropertiesForClass(graph: MergedGraph, classId: string): OntologyNode[];
```

Returns all object and datatype properties whose `rdfs:domain` matches the given class.

```typescript
function getClassHierarchy(graph: MergedGraph): Map<string, string[]>;
```

Builds a full inheritance tree. Each key is a class `@id`; the value is an array of subclass `@id`s.

### 17.8 SBVR Query Functions

```typescript
function getSBVRVocabulary(graph: MergedGraph): SBVRConceptAnnotation[];
```

Extracts all SBVR vocabulary elements from the merged graph — every class and property with its designation, definition, and vocabulary assignment.

```typescript
function getFactTypesForConcept(graph: MergedGraph, conceptId: string): SBVRFactTypeAnnotation[];
```

Returns all fact types (object properties with `sbvr:hasRole`) where the given concept participates as a role player.

```typescript
function getRulesForFactType(graph: MergedGraph, factTypeId: string): SBVRRuleAnnotation[];
```

Returns all business rules whose `sbvr:constrainsFact` references the given fact type.

### 17.9 SBVR Export Function

```typescript
function exportSBVRForTypeDB(graph: MergedGraph): {
  concepts: SBVRConceptAnnotation[];
  factTypes: SBVRFactTypeAnnotation[];
  rules: SBVRRuleAnnotation[];
  typeqlSchema: string;
};
```

Transforms the merged graph into a TypeDB-ready format:

- Classes become concept types.
- Object properties become fact types with role mappings.
- Rules and proof tables are preserved for constraint enforcement.
- A TypeQL `define` schema string is generated (see Section 18).

---

## 18. TypeDB Schema Projection Pipeline

### 18.1 Module Location

File: `knowledge/typedb-schema.ts`

### 18.2 Purpose

The TypeDB schema converter translates the OWL/JSON-LD ontology into TypeQL schema definitions, enabling the knowledge graph to be projected into TypeDB for graph-native queries, inference, and pattern matching. This is a one-way projection — TypeDB is a query substrate, not the source of truth (the JSON-LD files are authoritative).

### 18.3 TypeQL Types

```typescript
interface TypeQLEntityDef {
  name: string;
  sub: string; // parent entity (maps to rdfs:subClassOf)
  owns: string[]; // attributes (maps to datatype properties)
}

interface TypeQLAttributeDef {
  name: string;
  valueType: string; // string | long | double | boolean | datetime
}

interface TypeQLRelationDef {
  name: string;
  relates: string[]; // role names
  plays: Map<string, string[]>; // entity -> roles it plays
}

interface TypeQLSchema {
  entities: TypeQLEntityDef[];
  attributes: TypeQLAttributeDef[];
  relations: TypeQLRelationDef[];
}
```

### 18.4 Name Conversion Pipeline

TypeQL has different naming conventions than OWL. Three helper functions perform the conversion:

```typescript
function stripPrefix(uri: string): string;
// "bcore:Customer" -> "Customer"
// "https://mabos.io/ontology/business-core#Customer" -> "Customer"

function toSnakeCase(name: string): string;
// "CustomerLifetimeValue" -> "customer_lifetime_value"
// "hasCustomer" -> "has_customer"

function typeqlName(uri: string): string;
// Composes stripPrefix + toSnakeCase
// "bcore:CustomerLifetimeValue" -> "customer_lifetime_value"
```

### 18.5 XSD to TypeQL Type Mapping

```typescript
function xsdToTypeQL(xsdType: string): string;
```

| XSD Type       | TypeQL Type |
| -------------- | ----------- |
| `xsd:string`   | `string`    |
| `xsd:integer`  | `long`      |
| `xsd:decimal`  | `double`    |
| `xsd:boolean`  | `boolean`   |
| `xsd:dateTime` | `datetime`  |
| (default)      | `string`    |

### 18.6 Core Converter

```typescript
function jsonldToTypeQL(graph: MergedGraph): TypeQLSchema;
```

The converter walks the merged graph and performs the following translations:

1. **OWL Classes to TypeQL Entities:**
   - Each `owl:Class` becomes a TypeQL entity.
   - `rdfs:subClassOf` maps to `sub` (TypeQL inheritance).
   - Datatype properties whose `rdfs:domain` matches the class are added to `owns`.

2. **OWL Datatype Properties to TypeQL Attributes:**
   - Each `owl:DatatypeProperty` becomes a TypeQL attribute.
   - `rdfs:range` (XSD type) maps to the TypeQL value type via `xsdToTypeQL()`.

3. **OWL Object Properties to TypeQL Relations:**
   - Each `owl:ObjectProperty` becomes a TypeQL relation.
   - `sbvr:hasRole` entries become `relates` declarations.
   - Role players are mapped to `plays` on their respective entities.

### 18.7 Schema Generation

```typescript
function generateDefineQuery(schema: TypeQLSchema): string;
```

Produces a complete TypeQL `define` block. The generation order is:

1. **Attributes first** — All attribute definitions.
2. **Entities second** — All entity definitions with `sub` and `owns`.
3. **Relations third** — All relation definitions with `relates` and entity `plays`.
4. **Agent isolation** — Adds an `agent_owns` relation for agent-scoped data isolation.

Example output fragment:

```typeql
define

# Attributes
revenue_amount sub attribute, value double;
expense_amount sub attribute, value double;
business_type sub attribute, value string;
certainty sub attribute, value double;
priority sub attribute, value long;

# Entities
agent sub entity,
  owns certainty,
  owns priority,
  owns trust_score;

business sub entity,
  sub agent,
  owns business_type,
  owns business_status;

customer sub entity,
  sub agent;

# Relations
has_customer sub relation,
  relates business_role,
  relates customer_role;

business plays has_customer:business_role;
customer plays has_customer:customer_role;

# Agent isolation
agent_owns sub relation,
  relates owner,
  relates owned;
```

### 18.8 SBVR Bridge

```typescript
function exportSBVRForTypeDB(graph: MergedGraph): {
  concepts: SBVRConceptAnnotation[];
  factTypes: SBVRFactTypeAnnotation[];
  rules: SBVRRuleAnnotation[];
  typeqlSchema: string;
};
```

This function augments the SBVR export from `ontology/index.ts` with the generated TypeQL schema string. The result is a self-contained package that can be used to:

1. Initialize a TypeDB database with the schema.
2. Load SBVR concept metadata for concept-level queries.
3. Evaluate business rules against TypeDB query results.

---

## 19. Ontology Governance Pipeline

### 19.1 Module Location

File: `ontology-management-tools.ts` (853 lines)

### 19.2 Purpose

The governance pipeline ensures that the ontology evolves in a controlled, validated manner. No concept enters the ontology without passing through a formal proposal, validation, and merge lifecycle. This prevents ontology drift, duplicate concepts, broken references, and SBVR annotation gaps.

### 19.3 Pipeline Overview

```
Agent proposes concept
        |
        v
  +------------------+
  | ontology_propose  |  <-- Creates proposal with status "pending"
  | _concept          |
  +--------+---------+
           |
           v
  +------------------+
  | ontology_validate |  <-- Validates against existing ontology
  | _proposal         |      Status: "pending" -> "validated" or "rejected"
  +--------+---------+
           |
           v
  +------------------+
  | ontology_merge    |  <-- Merges into target .jsonld file
  | _approved         |      Status: "validated" -> "merged"
  +--------+---------+
           |
           v
   Updated .jsonld file
```

### 19.4 Tool 1: `ontology_propose_concept`

**Purpose:** Agents propose new OWL classes or properties with mandatory SBVR metadata.

**Input parameters:**

| Parameter          | Type   | Required | Description                                    |
| ------------------ | ------ | -------- | ---------------------------------------------- |
| `conceptType`      | string | Yes      | "class" or "property"                          |
| `id`               | string | Yes      | Full namespaced ID (e.g., "ecom:ReturnPolicy") |
| `label`            | string | Yes      | Human-readable label                           |
| `definition`       | string | Yes      | Natural language definition                    |
| `parentClass`      | string | No       | For classes: the superclass                    |
| `domain`           | string | No       | For properties: the domain class               |
| `range`            | string | No       | For properties: the range class or XSD type    |
| `targetOntology`   | string | Yes      | Which .jsonld file to target                   |
| `sbvr_designation` | string | Yes      | SBVR term designation                          |
| `sbvr_definition`  | string | Yes      | SBVR formal definition                         |
| `sbvr_vocabulary`  | string | Yes      | Target vocabulary                              |

**Output:** A proposal object with a unique ID and status "pending".

### 19.5 Tool 2: `ontology_validate_proposal`

**Purpose:** Validates a pending proposal against the existing ontology.

**Validation checks (6):**

1. **Duplicate ID detection** — The proposed `@id` must not already exist in any loaded ontology.

2. **Fuzzy label similarity** — The proposed label is compared against all existing labels. If similarity exceeds 0.85 (using normalized Levenshtein distance), a warning is raised for potential duplicates across domains.

3. **Reference resolution** — For classes: the `parentClass` must exist. For properties: `domain` and `range` must exist (or be XSD types for datatype properties).

4. **SBVR completeness** — `sbvr_designation`, `sbvr_definition`, and `sbvr_vocabulary` must all be non-empty strings.

5. **Naming conventions:**
   - Classes must use PascalCase (e.g., `ReturnPolicy`, not `returnPolicy` or `return_policy`).
   - Properties must use camelCase (e.g., `hasReturnPolicy`, not `HasReturnPolicy` or `has_return_policy`).

6. **Vocabulary existence** — The target vocabulary must exist in the ontology.

**Output:** Updated proposal with status "validated" (all checks pass) or "rejected" (any error found), plus arrays of errors and warnings.

### 19.6 Tool 3: `ontology_merge_approved`

**Purpose:** Merges a validated proposal into the target `.jsonld` file.

**Process:**

1. Reads the target `.jsonld` file.
2. Constructs an OWL node from the proposal (with proper `@type`, `rdfs:subClassOf`, SBVR annotations, etc.).
3. Appends the node to the `@graph` array.
4. If the proposal introduces a new namespace prefix, adds it to the `@context` block.
5. Writes the updated file.
6. Updates the proposal status to "merged".

### 19.7 Tool 4: `ontology_list_proposals`

**Purpose:** Lists all proposals with optional filtering.

**Filters:**

| Parameter | Type   | Description                                                    |
| --------- | ------ | -------------------------------------------------------------- |
| `domain`  | string | Filter by target ontology                                      |
| `status`  | string | Filter by status: "pending", "validated", "merged", "rejected" |

### 19.8 Tool 5: `ontology_scaffold_domain`

**Purpose:** Generates a complete new domain ontology from a template. See Section 20 for full details.

### 19.9 Proposal Lifecycle

```
                    pending
                       |
           +-----------+-----------+
           |                       |
      validated                 rejected
           |                    (terminal)
           |
        merged
       (terminal)
```

- **pending** — Initial state. The proposal has been created but not yet validated.
- **validated** — All validation checks passed. The proposal is approved for merge.
- **rejected** — One or more validation errors. The proposal cannot be merged without correction.
- **merged** — The proposal has been written to the target ontology file.

---

## 20. Domain Scaffolding for New Business Types

### 20.1 The Scaffolding Tool

The `ontology_scaffold_domain` tool generates a complete new domain ontology from a template. This is used when MABOS needs to support a new business vertical that is not covered by the existing five domains.

### 20.2 Input Parameters

| Parameter              | Type                   | Required | Description                                |
| ---------------------- | ---------------------- | -------- | ------------------------------------------ |
| `domainName`           | string                 | Yes      | Machine-readable name (e.g., "healthcare") |
| `domainLabel`          | string                 | Yes      | Human-readable label (e.g., "Healthcare")  |
| `domainDefinition`     | string                 | Yes      | SBVR definition of the domain              |
| `namespace`            | string                 | Yes      | Full namespace URI                         |
| `prefix`               | string                 | Yes      | Short prefix (e.g., "health")              |
| `coreClasses`          | string[]               | Yes      | Domain-specific class names                |
| `coreClassDefinitions` | Record<string, string> | Yes      | SBVR definitions for each core class       |

### 20.3 Scaffolding Process

1. **Creates the root domain class** — A new OWL class inheriting from `bcore:Business` with full SBVR annotations.

2. **Adds user-defined core classes** — Each class in `coreClasses` is created as an OWL class with:
   - Proper `@type: "owl:Class"`
   - `rdfs:subClassOf` referencing appropriate parent
   - Full SBVR annotations from `coreClassDefinitions`
   - Vocabulary assignment to the new domain

3. **Adds standard operational classes** — Every domain needs:
   - `Customer` (subclass of `bcore:Customer`)
   - `Transaction` (subclass of `bcore:Transaction`)
   - `Metric` (subclass of `upper:Metric`)

4. **Adds standard relationships** — Common object properties:
   - `hasCustomer` (domain → Customer)
   - `hasTransaction` (domain → Transaction)
   - `tracksMetric` (domain → Metric)

5. **Generates the JSON-LD file** with proper `@context` and `@graph`.

6. **Updates cross-domain.jsonld** — Adds integration relationships from the new domain to existing domains:
   - Customer equivalence mappings
   - Resource sharing relationships
   - Metric aggregation relationships

### 20.4 Example: Scaffolding a Healthcare Domain

```typescript
ontology_scaffold_domain({
  domainName: "healthcare",
  domainLabel: "Healthcare",
  domainDefinition:
    "Concepts for healthcare service delivery, patient management, and clinical operations",
  namespace: "https://mabos.io/ontology/healthcare",
  prefix: "health",
  coreClasses: [
    "Patient",
    "Provider",
    "Appointment",
    "Diagnosis",
    "Treatment",
    "Insurance",
    "Claim",
    "Facility",
  ],
  coreClassDefinitions: {
    Patient: "A person receiving healthcare services",
    Provider: "A licensed healthcare professional",
    Appointment: "A scheduled healthcare encounter",
    Diagnosis: "A clinical determination of a patient's condition",
    Treatment: "A therapeutic intervention prescribed for a diagnosis",
    Insurance: "A healthcare coverage plan",
    Claim: "A request for reimbursement from an insurance provider",
    Facility: "A physical location where healthcare is delivered",
  },
});
```

This would generate `healthcare.jsonld` with:

- 11 classes (1 root + 8 core + 3 standard)
- ~6 standard relationships
- Full SBVR annotations for every element
- Updated cross-domain.jsonld with healthcare integration points

---

## 21. Knowledge Infrastructure Consumers

The ontology is not just a static data model — it is actively consumed by four runtime knowledge infrastructure layers that power agent reasoning.

### 21.1 Fact Store (`fact-store.ts`)

**Relationship to ontology:** The fact store manages Subject-Predicate-Object (SPO) triples where:

- **Subjects** are instances of ontology classes (e.g., an instance of `bcore:Customer`)
- **Predicates** are ontology properties (e.g., `bcore:hasRevenue`)
- **Objects** are instances of ontology classes or literal values

**Key features:**

- Confidence scoring (0.0-1.0) per fact
- Temporal validity windows (validFrom/validUntil)
- Provenance tracking: source, derived_from, rule_id
- Derivation chain tracing up to 2 levels deep
- Dual-layer persistence: JSON (authoritative) + TypeDB (best-effort)

**Tools:**
| Tool | Purpose |
|---|---|
| `fact_assert` | Assert a new fact (SPO triple) with confidence and provenance |
| `fact_retract` | Remove a fact from the store |
| `fact_query` | Query facts by subject, predicate, object, or combinations |
| `fact_explain` | Trace the derivation chain for a fact |

**Ontology validation:** When a fact is asserted, the predicate is validated against the ontology to ensure it is a recognized property and the subject/object types match the property's domain/range.

### 21.2 Rule Engine (`rule-engine.ts`)

**Relationship to ontology:** Business rules in the rule engine are aligned with SBVR rule types:

| SBVR Rule Type          | Rule Engine Type | Behavior                                 |
| ----------------------- | ---------------- | ---------------------------------------- |
| Definitional            | Inference        | Derives new facts from existing facts    |
| Behavioral (constraint) | Constraint       | Validates states; returns violations     |
| Behavioral (policy)     | Policy           | Triggers actions when conditions are met |

**Rule structure:**

```typescript
interface Rule {
  id: string;
  name: string;
  type: "inference" | "constraint" | "policy";
  conditions: ConditionPattern[]; // Patterns with variable binding (?var)
  actions: Action[]; // Derived facts, violations, or triggered actions
  confidence_factor: number; // Applied to derived fact confidence
  enabled: boolean;
}

interface ConditionPattern {
  subject: string; // Class or ?variable
  predicate: string; // Ontology property
  object: string; // Value, class, or ?variable
  operator: "eq" | "gt" | "lt" | "gte" | "lte" | "ne" | "contains";
}
```

**Tools:**
| Tool | Purpose |
|---|---|
| `rule_create` | Create a new rule with conditions and actions |
| `rule_list` | List rules with optional type/status filters |
| `rule_toggle` | Enable or disable a rule |
| `constraint_check` | Evaluate constraint rules against current facts; returns violations with severity |
| `policy_eval` | Evaluate policy rules and trigger associated actions |

**Violation severities:** info, warning, error, critical

### 21.3 Inference Engine (`inference-tools.ts`)

**Relationship to ontology:** The inference engine traverses the ontology class hierarchy and SBVR fact types to derive new knowledge.

**Inference modes:**

1. **Forward chaining** (`infer_forward`):
   - Starts from known facts.
   - Iterates through inference rules until no new facts are derived (fixed-point).
   - Derived confidence = `min(supporting_confidences) * rule.confidence_factor`.
   - Uses ontology class hierarchy for subsumption reasoning (if X is a Customer and Customer is an Agent, then X is an Agent).

2. **Backward chaining** (`infer_backward`):
   - Starts from a goal (a fact to prove).
   - Works backward through rules to identify what facts would need to be true.
   - Identifies knowledge gaps — facts that are needed but not in the store.
   - Uses ontology properties to identify possible inference paths.

3. **Abductive reasoning** (`infer_abductive`):
   - Given an observation, generates hypotheses that would explain it.
   - Scores hypotheses by: (a) how many observations they explain, (b) how few unsupported assumptions they require, (c) consistency with existing facts.
   - Uses ontology causal relationships to generate candidate hypotheses.

4. **Knowledge explanation** (`knowledge_explain`):
   - Traces the full derivation chain for any fact.
   - Shows which rules fired, which facts were inputs, and what confidence was computed.

### 21.4 Reasoning Engine (`reasoning-tools.ts`)

**Relationship to ontology:** The reasoning engine implements 35 reasoning methods organized into 6 categories, using ontology concepts as the vocabulary for problem specification and conclusion representation.

**Categories and methods (35 total):**

| Category      | Methods                                                                                             | Count |
| ------------- | --------------------------------------------------------------------------------------------------- | ----- |
| Formal        | Deductive, Inductive, Abductive, Analogical, Modal, Temporal                                        | 6     |
| Probabilistic | Bayesian, Statistical, Decision-theoretic, Risk, Monte Carlo, Information-theoretic                 | 6     |
| Causal        | Causal inference, Counterfactual, Interventional, Structural equation, Root cause, Systems dynamics | 6     |
| Experience    | Case-based, Pattern recognition, Heuristic, Precedent, Best practice, Lessons learned               | 6     |
| Social        | Stakeholder analysis, Game-theoretic, Negotiation, Consensus building, Coalition, Voting            | 6     |
| Meta          | Meta-reasoning, Method selection, Confidence calibration, Reasoning explanation, Reflection         | 5     |

**Meta-reasoning router:**

```typescript
function scoreMethodsForProblem(
  problemType: string,
  context: Record<string, any>,
): Array<{ method: string; score: number; rationale: string }>;
```

This function auto-selects the most appropriate reasoning method(s) based on:

- Problem classification (diagnostic, planning, evaluation, design, etc.)
- Available evidence type and quality
- Ontology domain context (which domain ontology is active)
- Time constraints
- Confidence requirements

**Invocation modes:**

1. **Explicit method** — The caller specifies which reasoning method to use.
2. **Auto-select** — The meta-reasoning router selects the best method.
3. **Multi-method fusion** — Multiple methods are run in parallel, and their results are synthesized using confidence-weighted aggregation.

### 21.5 Knowledge Query Tools (`knowledge-tools.ts`)

**Relationship to ontology:** These tools provide direct access to the ontology for agent reasoning.

| Tool              | Purpose                                                                                                                     |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `ontology_query`  | Load and return raw JSON-LD for any domain ontology. Agents use this to discover available concepts and properties.         |
| `knowledge_infer` | Perform deductive, inductive, or abductive inference over a set of premises. Uses ontology class hierarchy for subsumption. |
| `rule_evaluate`   | Evaluate business rules defined in an agent's Playbooks.md against a given context. Rules reference ontology concepts.      |

---

## 22. Business Venture Instantiation

### 22.1 How Ontologies Become Businesses

The business venture system (`business-tools.ts`) shows how the abstract ontology is instantiated into concrete business operations. When `business_create` is called:

1. **Business type selection** — The user specifies a business type (ecommerce, saas, marketplace, retail, consulting, or custom).

2. **Domain ontology mapping:**

| Business Type | Primary Ontology      | Additional Imports    |
| ------------- | --------------------- | --------------------- |
| ecommerce     | `ecommerce.jsonld`    | business-core, upper  |
| saas          | `saas.jsonld`         | business-core, upper  |
| marketplace   | `marketplace.jsonld`  | business-core, upper  |
| retail        | `retail.jsonld`       | business-core, upper  |
| consulting    | `consulting.jsonld`   | business-core, upper  |
| hybrid        | `cross-domain.jsonld` | All domain ontologies |

3. **Agent creation** — 9 C-suite agents are created, each specialized for a business function:

| Agent     | Role                 | Primary Ontology Concepts                                       |
| --------- | -------------------- | --------------------------------------------------------------- |
| CEO       | Strategic leadership | Business, Goal, Strategy, Decision                              |
| CFO       | Financial management | Revenue, Expense, Budget, CashFlow, FinancialMetric             |
| COO       | Operations           | BusinessProcess, Pipeline, Workflow, WorkPackage                |
| CMO       | Marketing            | MarketingCampaign, AdCampaign, Audience, SalesChannel           |
| CTO       | Technology           | Integration, Webhook, EnterpriseArchitecture                    |
| HR        | Human resources      | Employee, Role, Organization, Department                        |
| Legal     | Legal and compliance | Contract, ComplianceRequirement, BusinessLicense, TaxObligation |
| Strategy  | Strategic planning   | BusinessModelCanvas, KPI, TroposModel                           |
| Knowledge | Knowledge management | Fact, Rule, InferenceEngine, KnowledgeBase                      |

4. **Cognitive file initialization** — Each agent gets 10 cognitive files:
   - `Persona.md` — Agent identity and behavioral parameters
   - `Capabilities.md` — What the agent can do
   - `Beliefs.md` — Current beliefs about the world
   - `Desires.md` — Desired states of affairs
   - `Goals.md` — Committed goals
   - `Intentions.md` — Active intentions
   - `Plans.md` — Current plans
   - `Playbooks.md` — Business rules and procedures (grounded in ontology rules)
   - `Knowledge.md` — Domain knowledge (grounded in ontology concepts)
   - `Memory.md` — Episodic and semantic memory

5. **Ontology grounding** — Each agent's Playbooks.md and Knowledge.md reference concepts from the appropriate domain ontology, ensuring that agent reasoning is grounded in the formal vocabulary.

---

## 23. Cross-Ontology Statistics Summary

### 23.1 Element Counts by Ontology

| Ontology      | Classes             | Object Properties | Datatype Properties | Business Rules | SHACL Shapes |
| ------------- | ------------------- | ----------------- | ------------------- | -------------- | ------------ |
| mabos-upper   | 33 (+ 12 SBVR meta) | 22                | 11                  | 0              | --           |
| business-core | 37                  | 24                | 10                  | 8              | --           |
| ecommerce     | 21                  | 13                | 16                  | 0              | --           |
| saas          | 20                  | 12                | 16                  | 0              | --           |
| marketplace   | 18                  | 16                | 14                  | 0              | --           |
| retail        | 18                  | 16                | 14                  | 0              | --           |
| consulting    | 18                  | 15                | 15                  | 0              | --           |
| cross-domain  | 4                   | 9                 | 0                   | 0              | --           |
| shapes        | --                  | --                | --                  | --             | 13           |
| shapes-sbvr   | --                  | --                | --                  | --             | 6            |
| **TOTAL**     | **~181**            | **~127**          | **~96**             | **8**          | **19**       |

### 23.2 SBVR Coverage

| Metric                                                                 | Count                       |
| ---------------------------------------------------------------------- | --------------------------- |
| Total SBVR metaclasses                                                 | 12                          |
| Total SBVR properties                                                  | 16                          |
| Total vocabulary elements (classes + properties with SBVR annotations) | ~400                        |
| Business rules with proof tables                                       | 8                           |
| Proof table entries                                                    | 8+                          |
| SBVR validation shapes                                                 | 6                           |
| Domain vocabularies                                                    | 8 (one per domain ontology) |

### 23.3 Relationship Density

| Relationship Type     | Count | Description                        |
| --------------------- | ----- | ---------------------------------- |
| `rdfs:subClassOf`     | ~50   | Inheritance relationships          |
| `owl:imports`         | ~12   | Inter-ontology import declarations |
| `sbvr:constrainsFact` | 8     | Rule-to-fact-type bindings         |
| `sbvr:hasRole`        | ~60   | Role declarations on fact types    |
| Cross-domain mappings | 9     | Inter-domain property bridges      |

### 23.4 TypeDB Projection Summary

| TypeQL Element        | Approximate Count | Source                      |
| --------------------- | ----------------- | --------------------------- |
| Entity types          | ~170              | OWL classes                 |
| Attribute types       | ~96               | OWL datatype properties     |
| Relation types        | ~127              | OWL object properties       |
| Role types            | ~260              | sbvr:FactTypeRole instances |
| Total schema elements | ~650              | Combined                    |

---

## 24. Companion Architecture Documents

This document is part of a series of technical references that together describe the full OpenClaw-MABOS system. The companion documents are:

### 24.1 Memory and Knowledge Management

**File:** `docs/plans/2026-02-24-memory-system-architecture.md`

Covers the Reflective Layered Memory (RLM) system, including working memory, episodic memory, semantic memory, and procedural memory. Explains how facts from the ontology-grounded fact store flow into agent memory layers.

### 24.2 BDI + SBVR Multi-Agent Framework

**File:** `docs/plans/2026-02-24-bdi-sbvr-multiagent-framework.md`

Covers the integration of the BDI cognitive architecture with SBVR formal vocabulary. Explains how agents use beliefs, desires, and intentions — all defined as SBVR concepts in the upper ontology — to reason and act.

### 24.3 Full System Architecture

**File:** `docs/plans/2026-02-24-openclaw-mabos-system-architecture.md`

Covers the complete system architecture from MCP server layer through tool registration, agent lifecycle, and deployment. Provides the "big picture" context for how the ontology system fits into the overall platform.

### 24.4 RLM Memory Enhancements

**File:** `docs/plans/2026-02-24-rlm-memory-enhancements.md`

Covers planned enhancements to the Reflective Layered Memory system, including attention-based retrieval, memory consolidation, and forgetting curves. These enhancements will leverage ontology concepts for semantic similarity and concept clustering.

---

## 25. Glossary

| Term                  | Definition                                                                                          |
| --------------------- | --------------------------------------------------------------------------------------------------- |
| **Alethic modality**  | A rule modality expressing logical necessity — what must be true by the nature of the domain model. |
| **BDI**               | Belief-Desire-Intention — a cognitive architecture for rational agents.                             |
| **Behavioral rule**   | An SBVR rule that constrains what states or transitions are permissible.                            |
| **Deontic modality**  | A rule modality expressing obligation or permission — what should be true by policy.                |
| **Definitional rule** | An SBVR rule that defines the meaning or structure of a concept.                                    |
| **Designation**       | The human-readable term for an SBVR concept (e.g., "Customer").                                     |
| **Fact type**         | A structured proposition combining noun concepts via roles (e.g., "Customer places Order").         |
| **JSON-LD**           | JSON for Linked Data — a W3C standard for encoding RDF as JSON.                                     |
| **Merged graph**      | The result of combining all loaded ontologies into a single queryable structure.                    |
| **Noun concept**      | An SBVR concept representing a category of things (maps to OWL class).                              |
| **OWL**               | Web Ontology Language — a W3C standard for defining ontologies.                                     |
| **Proof entry**       | A single validation record with a truth value and confidence score.                                 |
| **Proof table**       | A collection of proof entries that validate a business rule.                                        |
| **Role player**       | The noun concept that fills a specific role in a fact type.                                         |
| **SBVR**              | Semantics of Business Vocabulary and Business Rules — an OMG standard (v1.6).                       |
| **SHACL**             | Shapes Constraint Language — a W3C standard for validating RDF graphs.                              |
| **SPO triple**        | Subject-Predicate-Object — the fundamental unit of knowledge in the fact store.                     |
| **TypeDB**            | A strongly-typed knowledge graph database used for graph-native queries.                            |
| **TypeQL**            | The query language for TypeDB.                                                                      |
| **Verb concept**      | An SBVR concept representing a relationship (maps to OWL property).                                 |
| **Vocabulary**        | A named collection of SBVR concepts within a domain.                                                |

---

_This document is the definitive technical reference for the SBVR Ontology System and Domain Modeling in OpenClaw-MABOS. For questions about specific subsystems, refer to the companion documents listed in Section 24._
