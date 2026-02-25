# OpenClaw-MABOS: Reasoning and Inference Engine

**Subsystem:** Reasoning, Inference, Rule Engine, Fact Store, CBR, Meta-Reasoning, TypeDB Query Layer
**Architecture Layer:** Cognitive Core -- Deliberation and Knowledge Processing
**Version:** Current as of 2026-02-24
**Scope:** Definitive technical reference for the entire reasoning and inference subsystem
**Source Root:** `extensions/mabos/src/reasoning/` and `extensions/mabos/src/tools/`

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Theoretical Foundations](#3-theoretical-foundations)
4. [Module Directory Structure and File Inventory](#4-module-directory-structure-and-file-inventory)
5. [The 35 Reasoning Methods -- Full Catalog](#5-the-35-reasoning-methods----full-catalog)
6. [Formal Reasoning Category](#6-formal-reasoning-category)
7. [Probabilistic Reasoning Category](#7-probabilistic-reasoning-category)
8. [Causal Reasoning Category](#8-causal-reasoning-category)
9. [Experience-Based Reasoning Category](#9-experience-based-reasoning-category)
10. [Social Reasoning Category](#10-social-reasoning-category)
11. [Meta-Reasoning Engine](#11-meta-reasoning-engine)
12. [Multi-Method Fusion](#12-multi-method-fusion)
13. [The Inference Engine -- Forward Chaining](#13-the-inference-engine----forward-chaining)
14. [Backward Chaining -- Goal-Directed Reasoning](#14-backward-chaining----goal-directed-reasoning)
15. [Abductive Reasoning -- Hypothesis Generation](#15-abductive-reasoning----hypothesis-generation)
16. [The Rule Engine](#16-the-rule-engine)
17. [The Fact Store](#17-the-fact-store)
18. [Case-Based Reasoning (CBR-BDI)](#18-case-based-reasoning-cbr-bdi)
19. [Knowledge Query and Explanation Tools](#19-knowledge-query-and-explanation-tools)
20. [TypeDB Query Layer](#20-typedb-query-layer)
21. [Data Flow Diagrams](#21-data-flow-diagrams)
22. [Algorithmic vs. LLM-Prompted Methods](#22-algorithmic-vs-llm-prompted-methods)
23. [Integration with the BDI Cycle](#23-integration-with-the-bdi-cycle)
24. [Tool Catalog -- Parameter Reference](#24-tool-catalog----parameter-reference)
25. [Shared Type Definitions](#25-shared-type-definitions)
26. [References to Companion Documents](#26-references-to-companion-documents)

---

## 1. Executive Summary

The Reasoning and Inference Engine is the cognitive deliberation core of OpenClaw-MABOS. It provides the intelligent agents in the multi-agent BDI (Belief-Desire-Intention) architecture with the ability to think about problems, derive new knowledge, evaluate options, and justify conclusions using formally grounded reasoning methods.

The subsystem comprises:

- **35 reasoning methods** spanning six categories (formal, probabilistic, causal, experience, social, meta), each with a prompt template and optional algorithmic implementation.
- **A meta-reasoning router** that classifies problems across six dimensions and selects the optimal reasoning method(s) using a weighted selection matrix.
- **A multi-method fusion engine** that combines outputs from multiple reasoning methods, detects disagreements, computes agreement scores, and produces synthesis prompts.
- **A three-mode inference engine** supporting forward chaining (data-driven derivation to fixed-point), backward chaining (goal-directed proof search with knowledge gap identification), and abductive reasoning (hypothesis generation and scoring).
- **A rule engine** supporting three rule types: inference rules (derive new facts), constraint rules (flag violations), and policy rules (trigger actions/escalations).
- **An SPO fact store** implementing RDF-like Subject-Predicate-Object triples with confidence scores, temporal validity windows, provenance tracking, and derivation chain tracing.
- **A CBR-BDI module** implementing case-based reasoning with BDI-weighted similarity matching (belief overlap 60%, desire overlap 40%).
- **A TypeDB query layer** providing 12 query builder classes that generate TypeQL for persistent graph-database storage with full agent scoping.

The subsystem is invoked during the Deliberate phase of the BDI cycle (Perceive - Deliberate - Plan - Act - Learn) and feeds its conclusions into plan generation, intention formation, and the agent's belief revision process.

---

## 2. Architecture Overview

The following ASCII diagram shows the major components of the reasoning and inference subsystem and the data flows between them.

```
                                    +----------------------------+
                                    |   Agent BDI Cycle Layer    |
                                    |   Perceive -> Deliberate   |
                                    |   -> Plan -> Act -> Learn  |
                                    +-----------|----------------+
                                                |
                             invoke reason / infer_forward / etc.
                                                |
                                                v
+-----------------------------------------------------------------------+
|                       REASONING ROUTER (reason tool)                   |
|                                                                       |
|  Mode 1: Explicit method   Mode 2: Auto-select   Mode 3: Multi-fusion|
|  { method: "bayesian" }    { problem_classification }  { multi_method}|
+----------|-------------------|---------------------|------------------+
           |                   |                     |
           v                   v                     v
  +----------------+  +------------------+  +-------------------+
  | Single Method  |  | Meta-Reasoning   |  | Multi-Method      |
  | Invocation     |  | scoreMethodsFor  |  | Fusion Engine     |
  | (35 methods)   |  | Problem()        |  | fuseResults()     |
  +-------+--------+  +--------+---------+  | detectDisagreement|
          |                    |             | computeAgreement  |
          |            picks top method      | formatFusionPrompt|
          |                    |             +--------+----------+
          v                    v                      |
  +----------------------------------------------+   |
  |         REASONING METHOD CATALOG              |   |
  |                                               |   |
  |  formal/  (9)   deductive, inductive, ...     |   |
  |  probabilistic/ (6)  bayesian, fuzzy, ...     |   |
  |  causal/  (5)   causal, temporal, ...         |   |
  |  experience/ (5)  analogical, heuristic, ...  |   |
  |  social/  (7)   dialectical, ethical, ...     |   |
  |  meta/    (4)   meta_reasoning, reflective,...|   |
  +----------------------------------------------+   |
          |                                           |
          |  algorithmic methods compute directly     |
          |  prompt-based methods produce LLM prompts |
          v                                           v
  +----------------------------------------------------+
  |          LLM SYNTHESIS / RESPONSE                  |
  +----------------------------------------------------+

                    INFERENCE ENGINE
  +------------------------------------------------------+
  |  infer_forward     infer_backward    infer_abductive  |
  |  (fixed-point      (goal-directed    (hypothesis      |
  |   derivation)       proof search)     ranking)        |
  +-----------|-----------------|--------------+----------+
              |                 |              |
              v                 v              v
  +------------------------------------------------------+
  |              RULE ENGINE (rule_create,                |
  |              rule_list, rule_toggle,                  |
  |              constraint_check, policy_eval)           |
  |                                                      |
  |  inference rules  |  constraint rules  |  policy rules|
  +-----------+--------------------------------------+---+
              |                                      |
              v                                      v
  +-------------------------+    +-------------------------+
  |      FACT STORE         |    |      CBR-BDI            |
  |  fact_assert            |    |  cbr_retrieve           |
  |  fact_retract           |    |  cbr_store              |
  |  fact_query             |    |  S(B,D) = 0.6Sb + 0.4Sd|
  |  fact_explain           |    +-------------------------+
  |  SPO triples            |
  |  confidence, temporal   |
  |  derivation chains      |
  +----------+--------------+
             |
             | write-through (best-effort)
             v
  +------------------------------------------------------+
  |              TypeDB QUERY LAYER                      |
  |  12 query classes generating TypeQL                  |
  |  Agent-scoped: (owner: $agent, owned: $entity)      |
  |  isa agent_owns                                      |
  |                                                      |
  |  FactStoreQueries | RuleStoreQueries | MemoryQueries |
  |  InferenceQueries | CBRQueries | GoalStoreQueries    |
  |  DesireStoreQueries | BeliefStoreQueries             |
  |  DecisionStoreQueries | WorkflowStoreQueries         |
  |  TaskStoreQueries | IntentionStoreQueries            |
  +------------------------------------------------------+
```

**Key architectural decisions:**

1. **Dual storage:** JSON files are the authoritative source of truth. TypeDB writes are best-effort (write-through). If TypeDB is unavailable, the system continues operating on JSON files.
2. **Hybrid reasoning:** Six of the 35 methods have dedicated algorithmic implementations. The remainder use structured LLM prompts. This gives precision where algorithms excel and flexibility where natural language reasoning is superior.
3. **Agent scoping:** Every query in the TypeDB layer includes an `agent_owns` relation, ensuring strict tenant isolation in multi-agent deployments.

---

## 3. Theoretical Foundations

The reasoning engine draws on several established theoretical traditions. Understanding these foundations is essential for interpreting the design choices.

### 3.1 Classical and Non-Classical Logic

The formal reasoning methods implement or prompt for standard logical inference patterns:

- **Deductive logic:** Truth-preserving inference. If premises are true, the conclusion must be true. The system prompts for Modus Ponens (P->Q, P, therefore Q), Modus Tollens (P->Q, not-Q, therefore not-P), Hypothetical Syllogism, Disjunctive Syllogism, and Universal Instantiation.
- **Inductive logic:** Ampliative inference. Conclusions go beyond what premises strictly entail. The system evaluates sample representativeness, pattern strength, and counterexample vulnerability.
- **Abductive logic (Inference to Best Explanation):** C.S. Peirce's third mode of inference. Given observations, find the hypothesis that best explains them. The system uses an evaluation matrix scoring coverage, simplicity, plausibility, depth, and falsifiability.
- **Modal logic:** Possible-worlds semantics (Kripke frames). Propositions are evaluated across possible worlds for necessity (true in all worlds), possibility (true in some world), and contingency (true but not necessarily so). The system distinguishes alethic, epistemic, doxastic, and temporal modalities.
- **Deontic logic:** Normative reasoning about obligations (O), permissions (P), and prohibitions (F). The system detects deontic dilemmas (conflicting obligations) and applies priority resolution via specificity, recency, and hierarchy.
- **Non-monotonic logic / Default reasoning:** Conclusions can be retracted when new evidence arrives. Defaults hold in typical cases but have exception clauses.

### 3.2 Probability Theory and Fuzzy Logic

- **Bayesian epistemology:** Beliefs are represented as probabilities and updated via Bayes' theorem: `P(H|E) = P(E|H) * P(H) / P(E)`. The algorithmic implementation iteratively applies this formula across multiple evidence items.
- **Fuzzy logic (Mamdani inference):** Lotfi Zadeh's framework for reasoning with vague predicates. The system implements the full Mamdani pipeline: triangular membership functions for fuzzification, min-max rule evaluation, max-based output aggregation, and centroid defuzzification.
- **Decision theory:** Expected utility maximization under uncertainty: `EU(a) = sum_i P(s_i) * U(a, s_i)`.

### 3.3 Causal Reasoning

- **Causal analysis criteria:** Temporal precedence, mechanism plausibility, confounder identification, strength of association, and consistency with observations (drawing on Bradford Hill's criteria adapted for general reasoning).
- **Counterfactual reasoning:** Lewis-Stalnaker possible-worlds approach. "If X had been different, what would have changed?" Trace the causal chain from actual to counterfactual.
- **Temporal reasoning:** Event ordering via topological sort (Kahn's algorithm), cycle detection for circular dependencies, and critical path analysis.

### 3.4 Case-Based Reasoning (CBR)

The CBR module implements the Aamodt and Plaza CBR cycle (Retrieve-Reuse-Revise-Retain) with BDI-specific similarity. Cases are indexed by belief and desire overlap, reflecting the agent's cognitive state at the time of the case.

### 3.5 Argumentation Theory

- **Dialectical method:** Hegelian thesis-antithesis-synthesis. The system implements a 4-phase structured debate: thesis analysis, antithesis analysis, comparative evaluation, and synthesis.
- **Game theory:** Strategic interaction analysis using Nash equilibrium concepts, dominant strategy identification, Pareto optimality analysis, and iterated elimination of dominated strategies.

### 3.6 Ethics

The ethical reasoning framework applies three classical moral traditions in parallel and synthesizes:

- **Utilitarianism (consequentialism):** Maximize aggregate welfare across all affected stakeholders.
- **Deontological ethics (Kantian):** Evaluate against duties, rights, universalizability (Categorical Imperative), and the means-ends distinction.
- **Virtue ethics (Aristotelian):** Assess what a person of good character would do, applying the golden mean between excess and deficiency.

---

## 4. Module Directory Structure and File Inventory

### 4.1 Reasoning Module (`extensions/mabos/src/reasoning/`)

The reasoning module contains 28 TypeScript files organized into six subdirectories by category, plus shared types and the fusion engine at the root level.

```
reasoning/
|-- methods.ts              # 35 method catalog (302 lines)
|-- fusion.ts               # Multi-method fusion engine (117 lines)
|-- types.ts                # Shared interfaces (51 lines)
|-- formal/
|   |-- index.ts            # Aggregator -- collects and exports all formal tools
|   |-- deductive.ts        # Modus Ponens, Tollens, Hypothetical Syllogism
|   |-- inductive.ts        # Generalization from specific observations
|   |-- abductive.ts        # Inference to the best explanation (evaluation matrix)
|   |-- modal.ts            # Possibility/necessity/contingency (possible worlds)
|   |-- deontic.ts          # Obligations/permissions/prohibitions
|   +-- constraint.ts       # Full CSP solver (backtracking + MRV heuristic)
|-- probabilistic/
|   |-- index.ts            # Aggregator
|   |-- bayesian.ts         # Iterative Bayes' theorem: P(H|E) computation
|   |-- statistical.ts      # Hybrid: algorithmic stats + LLM interpretation
|   +-- fuzzy.ts            # Full Mamdani fuzzy inference engine
|-- causal/
|   |-- index.ts            # Aggregator
|   |-- causal.ts           # Root cause analysis (5-criteria evaluation)
|   |-- counterfactual.ts   # What-if alternative scenarios
|   |-- scenario.ts         # Multi-scenario exploration with variations
|   +-- temporal.ts         # Hybrid: topological sort + cycle detection + LLM
|-- experience/
|   |-- index.ts            # Aggregator
|   +-- analogical.ts       # Source-target domain mapping, structural alignment
|-- social/
|   |-- index.ts            # Aggregator
|   |-- dialectical.ts      # Thesis-antithesis-synthesis (4-phase)
|   |-- ethical.ts          # Multi-framework (utilitarian, deontological, virtue)
|   |-- game-theory.ts      # Nash equilibria, dominant strategies, Pareto
|   +-- trust.ts            # Algorithmic: exponential time-decay, sigmoid norm
+-- meta/
    |-- index.ts            # Aggregator
    +-- meta-reasoning.ts   # Problem classification, method scoring, selection
```

### 4.2 Tool Files (`extensions/mabos/src/tools/`)

| File                 | Purpose                                | Tools Exported                                                               |
| -------------------- | -------------------------------------- | ---------------------------------------------------------------------------- |
| `reasoning-tools.ts` | Reasoning router and tool registration | `reason` (router) + all category tools                                       |
| `inference-tools.ts` | Forward/backward/abductive inference   | `infer_forward`, `infer_backward`, `infer_abductive`, `knowledge_explain`    |
| `rule-engine.ts`     | Rule CRUD and evaluation               | `rule_create`, `rule_list`, `rule_toggle`, `constraint_check`, `policy_eval` |
| `fact-store.ts`      | SPO triple store operations            | `fact_assert`, `fact_retract`, `fact_query`, `fact_explain`                  |
| `cbr-tools.ts`       | Case-based reasoning                   | `cbr_retrieve`, `cbr_store`                                                  |

### 4.3 TypeDB Query Layer (`extensions/mabos/src/knowledge/`)

| File                | Purpose                                                         |
| ------------------- | --------------------------------------------------------------- |
| `typedb-queries.ts` | 12 query builder classes + base schema definition (~900+ lines) |
| `typedb-client.ts`  | TypeDB client wrapper with availability checking                |

---

## 5. The 35 Reasoning Methods -- Full Catalog

All 35 methods are defined in `methods.ts` as entries in the `REASONING_METHODS` record. Each entry contains: `category`, `description`, `prompt` (the template), `applicable_when` (conditions for use), `algorithmic` (boolean), and optional `dedicated_tool` reference.

### 5.1 Formal Methods (9)

| #   | Key                       | Description                                          | Algorithmic | Tool                |
| --- | ------------------------- | ---------------------------------------------------- | :---------: | ------------------- |
| 1   | `deductive`               | Derive conclusions from premises using logical rules |     No      | `reason_deductive`  |
| 2   | `inductive`               | Generalize from specific observations                |     No      | `reason_inductive`  |
| 3   | `abductive`               | Infer best explanation for observations              |     No      | `reason_abductive`  |
| 4   | `analogical`              | Reason by analogy from similar situations            |     No      | `reason_analogical` |
| 5   | `modal`                   | Reason about possibility, necessity, contingency     |     No      | `reason_modal`      |
| 6   | `deontic`                 | Reason about obligations, permissions, prohibitions  |     No      | `reason_deontic`    |
| 7   | `spatial`                 | Reason about spatial relationships                   |     No      | --                  |
| 8   | `default_reasoning`       | Non-monotonic reasoning with defeasible defaults     |     No      | --                  |
| 9   | `constraint_satisfaction` | CSP solver with backtracking + MRV heuristic         |   **Yes**   | `reason_constraint` |

### 5.2 Probabilistic Methods (6)

| #   | Key                   | Description                                          | Algorithmic | Tool                 |
| --- | --------------------- | ---------------------------------------------------- | :---------: | -------------------- |
| 10  | `bayesian`            | Update probabilities given new evidence              |   **Yes**   | `reason_bayesian`    |
| 11  | `fuzzy`               | Handle partial truth values with fuzzy membership    |   **Yes**   | `reason_fuzzy`       |
| 12  | `decision_theory`     | Maximize expected utility                            |     No      | --                   |
| 13  | `statistical`         | Analyze data distributions and statistical patterns  |   **Yes**   | `reason_statistical` |
| 14  | `monte_carlo`         | Estimate outcomes through random sampling simulation |     No      | --                   |
| 15  | `pattern_recognition` | Identify recurring patterns in data or situations    |     No      | --                   |

### 5.3 Causal Methods (5)

| #   | Key              | Description                                                | Algorithmic | Tool                    |
| --- | ---------------- | ---------------------------------------------------------- | :---------: | ----------------------- |
| 16  | `causal`         | Identify cause-effect relationships                        |     No      | `reason_causal`         |
| 17  | `counterfactual` | What-if analysis of alternative scenarios                  |     No      | `reason_counterfactual` |
| 18  | `temporal`       | Reason about time-dependent sequences and dependencies     |   **Yes**   | `reason_temporal`       |
| 19  | `scenario`       | Explore multiple future scenarios from varying assumptions |     No      | `reason_scenario`       |
| 20  | `predictive`     | Forecast future states based on current trends             |     No      | --                      |

### 5.4 Experience Methods (5)

| #   | Key           | Description                                            | Algorithmic | Tool |
| --- | ------------- | ------------------------------------------------------ | :---------: | ---- |
| 21  | `heuristic`   | Apply rules of thumb                                   |     No      | --   |
| 22  | `cbr`         | Learn from past cases                                  |     No      | --   |
| 23  | `means_ends`  | Reduce gap between current and goal state              |     No      | --   |
| 24  | `narrative`   | Construct coherent narratives to understand situations |     No      | --   |
| 25  | `model_based` | Reason using mental models of system behavior          |     No      | --   |

### 5.5 Social Methods (7)

| #   | Key              | Description                                           | Algorithmic | Tool                    |
| --- | ---------------- | ----------------------------------------------------- | :---------: | ----------------------- |
| 26  | `game_theory`    | Strategic interaction analysis                        |     No      | `reason_game_theoretic` |
| 27  | `stakeholder`    | Multi-perspective analysis                            |     No      | --                      |
| 28  | `ethical`        | Moral reasoning frameworks                            |     No      | `reason_ethical`        |
| 29  | `dialectical`    | Thesis-antithesis-synthesis dialectic                 |     No      | `reason_dialectical`    |
| 30  | `consensus`      | Aggregate preferences to find group agreement         |     No      | --                      |
| 31  | `trust`          | Evaluate trustworthiness based on interaction history |   **Yes**   | `reason_trust`          |
| 32  | `theory_of_mind` | Model the beliefs and intentions of other agents      |     No      | --                      |

### 5.6 Meta Methods (4)

| #   | Key              | Description                                         | Algorithmic | Tool          |
| --- | ---------------- | --------------------------------------------------- | :---------: | ------------- |
| 33  | `meta_reasoning` | Select the best reasoning method for a problem      |   **Yes**   | `reason_meta` |
| 34  | `epistemic`      | Reason about knowledge, certainty, and ignorance    |     No      | --            |
| 35  | `reflective`     | Evaluate and improve one's own reasoning process    |     No      | --            |
| --  | `optimization`   | Find best solution given objectives and constraints |     No      | --            |

**Summary:** 8 methods are algorithmic (constraint_satisfaction, bayesian, fuzzy, statistical, temporal, trust, meta_reasoning, and pattern matching within the methods catalog). 20 methods have dedicated tools. The remaining 15 methods are invoked through the central `reason` router using their prompt templates.

---

## 6. Formal Reasoning Category

Source: `reasoning/formal/`

### 6.1 Deductive Reasoning (`deductive.ts`)

**Tool:** `reason_deductive`
**Parameters:** `premises: string[]`, `query: string`
**Approach:** LLM-prompted structured deduction.

The tool formats premises with numbered labels (P1, P2, ...) and instructs the LLM to:

1. Identify the logical form of each premise (universal, conditional, disjunctive, etc.).
2. Apply valid inference rules:
   - **Modus Ponens:** If P then Q; P; therefore Q.
   - **Modus Tollens:** If P then Q; not Q; therefore not P.
   - **Hypothetical Syllogism:** If P then Q; if Q then R; therefore if P then R.
   - **Disjunctive Syllogism:** P or Q; not P; therefore Q.
   - **Universal Instantiation:** All X are Y; a is X; therefore a is Y.
3. Chain inferences step by step toward the query.
4. Classify the result: VALID, INVALID, UNDERDETERMINED, or CONTRADICTORY.
5. Provide the full derivation chain showing each step and the rule applied.

### 6.2 Inductive Reasoning (`inductive.ts`)

**Tool:** `reason_inductive`
**Parameters:** `observations: string[]`, `hypothesis?: string`, `domain?: string`
**Approach:** LLM-prompted pattern identification and generalization.

The structured prompt guides the LLM through:

1. Pattern identification across observations.
2. Generalization to a broader principle.
3. Sample assessment (representativeness, selection bias).
4. Counterexample search.
5. Confidence assessment: STRONG, MODERATE, or WEAK.

If a hypothesis is provided, the LLM evaluates it against the patterns. If not, it proposes hypotheses.

### 6.3 Abductive Reasoning (`abductive.ts`)

**Tool:** `reason_abductive`
**Parameters:** `observations: string[]`, `candidate_explanations?: string[]`, `domain?: string`
**Approach:** LLM-prompted inference to the best explanation.

Uses a structured evaluation matrix scoring each candidate explanation on five criteria:

| Criterion      | Definition                                              |
| -------------- | ------------------------------------------------------- |
| Coverage       | How many observations does the explanation account for? |
| Simplicity     | How few assumptions does it require? (Occam's Razor)    |
| Plausibility   | Consistency with background knowledge                   |
| Depth          | Does it identify the underlying mechanism?              |
| Falsifiability | Does it make testable predictions?                      |

Each criterion is scored 1-5. Explanations are ranked and the best is identified with justification.

### 6.4 Modal Reasoning (`modal.ts`)

**Tool:** `reason_modal`
**Parameters:** `proposition: string`, `modality: "possibility" | "necessity" | "contingency"`, `context?: string`

Implements possible-worlds analysis using formal modal operators:

| Modality    | Symbol              | Definition                                              |
| ----------- | ------------------- | ------------------------------------------------------- |
| Possibility | Diamond-P           | True in at least one accessible world                   |
| Necessity   | Box-P               | True in all accessible worlds                           |
| Contingency | P AND Diamond-not-P | True in actual world but false in some accessible world |

The tool distinguishes between alethic (logical/metaphysical), epistemic (knowledge-based), doxastic (belief-based), and temporal modalities. It prompts for possible-worlds analysis, modal evaluation, and related modal property checking.

### 6.5 Deontic Reasoning (`deontic.ts`)

**Tool:** `reason_deontic`
**Parameters:** `action: string`, `norms: Array<{norm, type}>`, `context?: string`
**Norm types:** `obligation` (O(a)), `permission` (P(a)), `prohibition` (F(a))

The structured analysis covers:

1. **Norm applicability:** Which norms apply to the action in context?
2. **Conflict detection:** Is the action both obligated and prohibited (deontic dilemma)?
3. **Norm priority resolution:** Specificity > Recency > Hierarchy > Context.
4. **Deontic status determination:** OBLIGATORY, PERMITTED, FORBIDDEN, or OPTIONAL.
5. **Compliance assessment:** What are the consequences of non-compliance?

### 6.6 Constraint Satisfaction (`constraint.ts`)

**Tool:** `reason_constraint`
**Parameters:** `variables: Array<{name, domain}>`, `constraints: string[]`, `objective?: string`
**Algorithmic:** Yes -- full CSP solver with prompt-based fallback.

**Hard limits:**

- Maximum variables: 20
- Maximum backtracks: 10,000

**Algorithm -- Backtracking Search with MRV Heuristic:**

```
function solveCSP(variables, constraints):
    assignment = empty map
    backtracks = 0
    domains = copy of all variable domains

    function selectVariable():
        // MRV: select unassigned variable with smallest remaining domain
        return variable with min(domain.size) among unassigned

    function isConsistent():
        for each constraint:
            if both variables assigned:
                evaluate constraint (==, !=, <, >, <=, >=)
                if violated: return false
        return true

    function backtrack():
        if assignment.size == variables.length: return true  // solution found
        if backtracks >= MAX_BACKTRACKS: return false         // limit exceeded

        var = selectVariable()
        for each value in var.domain:
            assignment[var] = value
            if isConsistent():
                if backtrack(): return true
            delete assignment[var]
            backtracks++
            if backtracks >= MAX_BACKTRACKS: return false
        return false

    solved = backtrack()
    return { solved, assignment, backtracks, limitExceeded }
```

**Constraint parsing:** Supports binary constraints in the form `"A != B"`, `"X < Y"`, `"P == Q"` etc. Operators supported: `==`, `!=`, `<`, `>`, `<=`, `>=`. Both numeric and string comparison are handled (numeric comparison attempted first).

**Fallback triggers:** The solver falls back to a structured LLM prompt when:

- Variable count exceeds 20
- Any constraint cannot be parsed (e.g., complex multi-variable constraints)
- Constraint variables reference undeclared variables
- Backtrack limit (10,000) is exceeded

The fallback prompt provides the full problem specification and instructs the LLM to solve it using the same algorithmic approach manually.

### 6.7 Spatial Reasoning

**Key:** `spatial`
**No dedicated tool.** Invoked via the `reason` router with `method: "spatial"`.
Analyzes positions, distances, and arrangements.

### 6.8 Default Reasoning

**Key:** `default_reasoning`
**No dedicated tool.** Assumes typical defaults unless exceptions are known. Non-monotonic: conclusions can be retracted.

---

## 7. Probabilistic Reasoning Category

Source: `reasoning/probabilistic/`

### 7.1 Bayesian Reasoning (`bayesian.ts`)

**Tool:** `reason_bayesian`
**Parameters:** `agent_id`, `hypothesis: string`, `prior: number`, `evidence: Array<{description, likelihood, marginal}>`
**Algorithmic:** Yes -- purely computational, no LLM interpretation.

**Algorithm -- Iterative Bayes' Theorem:**

```
function bayesianUpdate(prior, evidence[]):
    posterior = prior
    for each evidence item e:
        // Bayes' theorem: P(H|E) = P(E|H) * P(H) / P(E)
        newPosterior = e.likelihood * posterior / e.marginal
        record step: "P(H|E) = {e.likelihood} x {posterior} / {e.marginal} = {newPosterior}"
        posterior = newPosterior

    interpret:
        if posterior > 0.8: "Strong support"
        if posterior > 0.5: "Moderate support"
        if posterior > 0.2: "Weak support"
        else: "Against hypothesis"

    return posterior
```

**Key properties:**

- Each evidence item updates the posterior, which becomes the prior for the next item.
- The `likelihood` field is P(E|H) -- the probability of observing the evidence given the hypothesis is true.
- The `marginal` field is P(E) -- the total probability of the evidence across all hypotheses.
- The algorithm chains evidence sequentially, producing a trace showing the step-by-step update.
- The result includes a human-readable interpretation bracket.

### 7.2 Fuzzy Logic Reasoning (`fuzzy.ts`)

**Tool:** `reason_fuzzy`
**Parameters:**

- `variables: Array<{name, value, sets: Array<{name, points: [a, b, c]}>}>`
- `rules: Array<{if_var, if_set, then_var, then_set}>`
- `output_variable: string`

**Algorithmic:** Yes -- full Mamdani fuzzy inference engine.

**Algorithm -- Mamdani Fuzzy Inference (4 steps):**

**Step 1: Fuzzification (Triangular Membership Functions)**

For each input variable with crisp value `x` and each fuzzy set defined by points `[a, b, c]`:

```
function triangularMembership(x, a, b, c):
    if x <= a or x >= c: return 0
    if x <= b: return (x - a) / (b - a)     // ascending edge
    return (c - x) / (c - b)                 // descending edge
```

This maps every crisp input to membership degrees in each fuzzy set (e.g., temperature=68 might be 0.4 in "warm" and 0.6 in "cool").

**Step 2: Rule Evaluation (Min-Max Inference)**

For each rule of the form `IF var IS set THEN output IS set`:

- Compute firing strength = membership degree of the antecedent variable in the antecedent set.
- For multi-antecedent rules (not yet implemented but the architecture supports it), firing strength = min of all antecedent memberships.

**Step 3: Output Aggregation (Max)**

For each output fuzzy set, the aggregated membership = max of all firing strengths that target that set:

```
for each activated rule targeting output_variable:
    aggregated[output_set] = max(aggregated[output_set], firing_strength)
```

**Step 4: Defuzzification (Centroid Method)**

```
function centroidDefuzzification(aggregated, outputSets):
    determine range [rangeMin, rangeMax] from all output set points
    STEPS = 100
    step = (rangeMax - rangeMin) / STEPS
    numerator = 0
    denominator = 0

    for i = 0 to STEPS:
        x = rangeMin + i * step
        muAtX = 0
        for each output set definition:
            aggMu = aggregated[set.name]
            if aggMu == 0: continue
            rawMu = triangularMembership(x, set.a, set.b, set.c)
            clipped = min(rawMu, aggMu)       // Mamdani clipping
            muAtX = max(muAtX, clipped)         // Aggregation
        numerator += x * muAtX
        denominator += muAtX

    return denominator > 0 ? numerator / denominator : 0
```

The centroid method samples 101 points across the output universe and computes the weighted center of mass of the aggregated fuzzy output surface.

### 7.3 Statistical Reasoning (`statistical.ts`)

**Tool:** `reason_statistical`
**Parameters:** `data: Array<{label, value}>`, `analysis_type: "descriptive" | "comparative" | "trend"`, `context?: string`
**Algorithmic:** Hybrid -- algorithmic statistics + LLM interpretation.

**Computed Statistics (algorithmic):**

```
function computeStats(values):
    sorted = sort(values)
    n = length(values)
    mean = sum(values) / n
    median = sorted[floor(n/2)]      // or average of two middle values
    variance = sum((v - mean)^2) / n
    stddev = sqrt(variance)
    min = sorted[0]
    max = sorted[n-1]
    return { count, mean, median, stddev, min, max }
```

**Analysis-type-specific LLM interpretation:**

| Type          | LLM Prompt Focus                                                                                    |
| ------------- | --------------------------------------------------------------------------------------------------- |
| `descriptive` | Central tendency, spread, range, outliers, plain-language summary                                   |
| `comparative` | Above/below mean, top/bottom performers, clusters, variation as % of mean                           |
| `trend`       | Direction (up/down/flat), inflection points, first-half vs. second-half, rate of change, projection |

### 7.4 Decision Theory

**Key:** `decision_theory`
**No dedicated tool.** Prompt-based expected utility maximization: enumerate options, probabilities, utilities, compute EU.

### 7.5 Monte Carlo

**Key:** `monte_carlo`
**No dedicated tool.** Prompt-based simulation reasoning: generate random scenarios to estimate probability distributions.

### 7.6 Pattern Recognition

**Key:** `pattern_recognition`
**No dedicated tool.** Identifies recurring structures, trends, and regularities in historical data.

---

## 8. Causal Reasoning Category

Source: `reasoning/causal/`

### 8.1 Causal Analysis (`causal.ts`)

**Tool:** `reason_causal`
**Parameters:** `agent_id`, `effect: string`, `candidate_causes: string[]`, `observations?: string[]`

Evaluates each candidate cause against five criteria:

1. **Temporal precedence:** Did the cause occur before the effect?
2. **Mechanism:** What is the causal pathway?
3. **Confounders:** What alternative explanations exist?
4. **Strength of association:** How strongly correlated are cause and effect?
5. **Consistency:** Does the candidate align with all observations?

Candidates are ranked by causal plausibility.

### 8.2 Counterfactual Analysis (`counterfactual.ts`)

**Tool:** `reason_counterfactual`
**Parameters:** `agent_id`, `actual: string`, `counterfactual: string`, `variables?: string[]`

The structured analysis prompts the LLM to:

1. Trace the causal chain leading to the actual outcome.
2. Identify how the counterfactual change would alter that chain.
3. Enumerate downstream effects that would differ.
4. Assess confidence in the counterfactual outcome.
5. Identify key uncertainties.

### 8.3 Temporal Reasoning (`temporal.ts`)

**Tool:** `reason_temporal`
**Parameters:**

- `events: Array<{id, label, timestamp?, depends_on?: string[]}>`
- `query: string`
- `analysis_type: "ordering" | "critical_path" | "dependencies"`

**Algorithmic:** Yes -- hybrid (algorithmic graph analysis + LLM qualitative reasoning).

**Algorithm -- Kahn's Algorithm (BFS Topological Sort):**

```
function topologicalSort(nodeIds, adjacencyList):
    compute inDegree for each node
    queue = all nodes with inDegree == 0
    order = []

    while queue is not empty:
        node = queue.dequeue()
        order.append(node)
        for each neighbor of node:
            inDegree[neighbor] -= 1
            if inDegree[neighbor] == 0:
                queue.enqueue(neighbor)

    if order.length < nodeIds.length:
        // Cycle detected: nodes not in order are in a cycle
        cycleMembers = nodeIds.filter(id => id not in order)
        return { order, hasCycle: true, cycleMembers }
    else:
        return { order, hasCycle: false, cycleMembers: [] }
```

**Duration computation:** When events have ISO-8601 timestamps, the tool computes durations between dependent events in hours and milliseconds.

**Analysis-type-specific qualitative prompts:**

| Type            | LLM Prompt Focus                                                 |
| --------------- | ---------------------------------------------------------------- |
| `ordering`      | Valid reorderings, parallelizable events, surprising constraints |
| `critical_path` | Longest path, total duration, slack, bottleneck events           |
| `dependencies`  | Root causes, terminal outcomes, hub events, fragility analysis   |

### 8.4 Scenario Planning (`scenario.ts`)

**Tool:** `reason_scenario`
**Parameters:** `base_assumptions: string[]`, `variations: Array<{name, changes: string[]}>`, `eval_criteria?: string[]`

Constructs multiple scenarios from a shared baseline by applying systematic variations. Each scenario is evaluated against criteria (default: feasibility, risk, impact, cost). The LLM traces consequences, identifies risks, and produces a comparison table.

### 8.5 Predictive Reasoning

**Key:** `predictive`
**No dedicated tool.** Projects current trends and models into future states.

---

## 9. Experience-Based Reasoning Category

Source: `reasoning/experience/`

### 9.1 Analogical Reasoning (`analogical.ts`)

**Tool:** `reason_analogical`
**Parameters:**

- `source_domain: string` -- well-understood domain to reason from
- `target_problem: string` -- problem to apply insights to
- `known_mappings?: Array<{source, target}>` -- pre-identified correspondences

The structured prompt guides 6-step analogical analysis:

1. **Source analysis:** Identify key structures, relationships, causal mechanisms, and principles.
2. **Structural alignment:** Find structural parallels (entities, relationships, mechanisms).
3. **Mapping completion:** Extend known mappings into a full mapping table with relationship types.
4. **Inference transfer:** What insights from the source apply to the target?
5. **Disanalogy check:** Where does the analogy break down?
6. **Confidence assessment:** STRONG (deep structural alignment), MODERATE (partial alignment), WEAK (surface similarity only).

### 9.2 Heuristic Reasoning

**Key:** `heuristic`
**No dedicated tool.** Quick approximation using rules of thumb for rapid decision-making under time pressure.

### 9.3 Case-Based Reasoning (CBR)

**Key:** `cbr`
**No dedicated tool in the methods catalog.** The CBR-BDI module (Section 18) provides dedicated `cbr_retrieve` and `cbr_store` tools.

### 9.4 Means-Ends Analysis

**Key:** `means_ends`
**No dedicated tool.** Identifies gaps between current and goal states and selects operators to close them.

### 9.5 Narrative Reasoning

**Key:** `narrative`
**No dedicated tool.** Constructs coherent stories to explain complex situations, making them accessible and memorable.

---

## 10. Social Reasoning Category

Source: `reasoning/social/`

### 10.1 Dialectical Reasoning (`dialectical.ts`)

**Tool:** `reason_dialectical`
**Parameters:** `thesis: string`, `antithesis: string`, `criteria?: string[]`

Implements the Hegelian dialectical method in four structured phases:

**Phase 1 -- Thesis Analysis:**

- Core claims, supporting arguments, unstated assumptions, strengths, limitations.

**Phase 2 -- Antithesis Analysis:**

- Core claims, points of contradiction, supporting arguments, assumptions, strengths, limitations.

**Phase 3 -- Comparative Evaluation:**

- Each position scored on evaluation criteria (default: logical consistency, empirical support, practical implications, scope of applicability). Uses a tabular format with scores 1-5.

**Phase 4 -- Synthesis:**

- Common ground, reconciliation, transcendence (higher-level perspective), synthesized position, remaining tensions, confidence assessment.

### 10.2 Ethical Reasoning (`ethical.ts`)

**Tool:** `reason_ethical`
**Parameters:** `situation: string`, `principles: string[]`, `frameworks?: string[]`
**Default frameworks:** utilitarian, deontological, virtue ethics.

The tool generates framework-specific analysis sections:

**Utilitarian Analysis (Consequentialist):**

1. Stakeholder identification
2. Outcome assessment per action
3. Utility calculus (net benefit across all stakeholders)
4. Distribution fairness analysis
5. Greatest good determination

**Deontological Analysis (Duty-Based / Kantian):**

1. Duties and rights at stake
2. Universalizability test (Categorical Imperative)
3. Means vs. ends distinction
4. Principle alignment assessment
5. Moral permissibility determination

**Virtue Ethics Analysis (Character-Based / Aristotelian):**

1. Relevant virtues (courage, temperance, justice, prudence, honesty, compassion)
2. Character assessment (what would a good person do?)
3. Golden mean (balanced middle ground)
4. Moral exemplar test
5. Virtue cultivation assessment

After individual framework analyses, a cross-framework synthesis identifies agreements, conflicts, principle consistency, and produces a final weighted assessment with a summary table.

### 10.3 Game-Theoretic Reasoning (`game-theory.ts`)

**Tool:** `reason_game_theoretic`
**Parameters:** `players: string[]`, `strategies: Record<string, string[]>`, `payoffs?: string`, `context?: string`

The structured analysis covers five steps:

**Step 1 -- Game Formulation:**

- Game type classification (simultaneous/sequential, zero-sum/non-zero-sum, one-shot/repeated, complete/incomplete information)
- Payoff matrix construction
- Information structure analysis

**Step 2 -- Dominant Strategy Analysis:**

- Strict dominance identification for each player
- Weak dominance identification
- Iterated elimination of dominated strategies

**Step 3 -- Nash Equilibrium Identification:**

- Pure strategy Nash equilibria (no unilateral deviation improves payoff)
- Mixed strategy Nash equilibria (probability distributions over strategies)
- Equilibrium payoffs

**Step 4 -- Pareto Optimality:**

- Pareto-optimal outcomes identification (no Pareto improvements possible)
- Comparison with Nash equilibria (e.g., Prisoner's Dilemma tension)

**Step 5 -- Strategic Recommendations:**

- Cooperative play analysis (self-enforcing agreements)
- Repeated game strategies (tit-for-tat, grim trigger, forgiveness)
- Per-player strategy recommendations

### 10.4 Trust Reasoning (`trust.ts`)

**Tool:** `reason_trust`
**Parameters:**

- `target_agent_id: string`
- `history: Array<{outcome: "success"|"failure"|"partial", value: number, timestamp: string}>`
- `decay_factor?: number` (default: 0.95 per day)

**Algorithmic:** Yes -- purely computational.

**Algorithm -- Exponential Time-Decay Trust Scoring:**

```
function computeTrust(history, decay):
    now = currentTime()

    // Step 1: Compute per-interaction weighted values
    for each interaction h in history:
        ageDays = (now - h.timestamp) / (milliseconds per day)
        weight = decay ^ ageDays                  // exponential decay
        outcomeValue =
            if h.outcome == "success":  h.value
            if h.outcome == "partial":  h.value * 0.5
            if h.outcome == "failure": -h.value

    // Step 2: Raw score (weighted mean)
    rawScore = sum(outcomeValue * weight) / sum(weight)

    // Step 3: Sigmoid normalization to [0, 1]
    trustScore = 1 / (1 + exp(-rawScore))

    // Step 4: Reliability (success fraction)
    reliability = successCount / totalCount

    // Step 5: Consistency (1 - normalized stddev)
    stddev = stddev(outcomeValues)
    range = max(outcomeValues) - min(outcomeValues)
    consistency = 1 - stddev / max(range, 1)

    // Step 6: Recency trend (last 3 vs. overall)
    recentMean = mean(3 most recent outcomeValues)
    recencyTrend = recentMean - overallMean
    trendLabel =
        if recencyTrend > 0.1: "Improving"
        if recencyTrend < -0.1: "Declining"
        else: "Stable"

    // Step 7: Interpretation
    if trustScore >= 0.8: "High trust"
    if trustScore >= 0.6: "Moderate trust"
    if trustScore >= 0.4: "Neutral trust"
    if trustScore >= 0.2: "Low trust"
    else: "Very low trust"

    return { trustScore, reliability, consistency, recencyTrend, trendLabel }
```

**Key properties:**

- The exponential decay factor (default 0.95/day) means an interaction from 14 days ago has weight 0.95^14 = 0.488, half the weight of a current interaction.
- Sigmoid normalization maps the raw weighted score to a bounded [0, 1] range, centered at 0.5 for zero raw score.
- Partial outcomes receive half the value weight of successes.
- Failures receive negative value weight, actively reducing trust.

### 10.5 Stakeholder Reasoning

**Key:** `stakeholder`
**No dedicated tool.** Identifies interests, power, influence of each party.

### 10.6 Consensus Reasoning

**Key:** `consensus`
**No dedicated tool.** Aggregates diverse preferences to find acceptable group agreement.

### 10.7 Theory of Mind

**Key:** `theory_of_mind`
**No dedicated tool.** Infers what other agents believe, want, and intend -- critical for multi-agent coordination.

---

## 11. Meta-Reasoning Engine

Source: `reasoning/meta/meta-reasoning.ts`

The meta-reasoning engine is the system's "thinking about thinking" capability. It classifies problems, scores reasoning methods against the classification, and recommends the optimal approach.

### 11.1 Problem Classification Dimensions

Every problem is classified along six orthogonal dimensions:

| Dimension           | Levels                           | Purpose                                |
| ------------------- | -------------------------------- | -------------------------------------- |
| `uncertainty`       | low, medium, high                | How much is unknown about the problem? |
| `complexity`        | simple, moderate, complex        | How many interacting variables?        |
| `domain`            | formal, empirical, social, mixed | What kind of knowledge is involved?    |
| `time_pressure`     | none, moderate, urgent           | How quickly must a decision be made?   |
| `data_availability` | rich, moderate, sparse           | How much data is available?            |
| `stakes`            | low, medium, high                | How consequential is the decision?     |

### 11.2 The Selection Matrix

The selection matrix is a 3-dimensional lookup table: `SELECTION_MATRIX[dimension][level][category] -> weight`.

For each dimension and level, the matrix assigns a weight (0.0-0.4) to each of the six reasoning categories (formal, probabilistic, causal, experience, social, meta).

**Example entries from the matrix:**

```
uncertainty:
  low:    { formal: 0.3, probabilistic: 0.0, causal: 0.1, experience: 0.1, social: 0.0, meta: 0.0 }
  medium: { formal: 0.1, probabilistic: 0.2, causal: 0.2, experience: 0.1, social: 0.1, meta: 0.1 }
  high:   { formal: 0.0, probabilistic: 0.3, causal: 0.1, experience: 0.2, social: 0.1, meta: 0.1 }

complexity:
  simple:   { formal: 0.2, probabilistic: 0.1, ..., meta: 0.0 }
  moderate: { formal: 0.1, ..., meta: 0.1 }
  complex:  { formal: 0.1, ..., meta: 0.3 }

domain:
  formal:    { formal: 0.4, probabilistic: 0.1, ... }
  empirical: { formal: 0.1, probabilistic: 0.3, causal: 0.2, ... }
  social:    { formal: 0.0, ..., social: 0.3, meta: 0.1 }
  mixed:     { formal: 0.1, ..., meta: 0.2 }

time_pressure:
  none:    { formal: 0.2, ..., causal: 0.2, ... }
  moderate: { ..., experience: 0.2, ... }
  urgent:  { formal: 0.0, ..., experience: 0.3, ... }

data_availability:
  rich:     { ..., probabilistic: 0.3, causal: 0.2, ... }
  moderate: { ..., probabilistic: 0.2, ... }
  sparse:   { formal: 0.2, probabilistic: 0.0, ..., experience: 0.2, ... }

stakes:
  low:    { ..., experience: 0.2, ... }
  medium: { ..., causal: 0.2, ... }
  high:   { formal: 0.2, ..., social: 0.2, meta: 0.2 }
```

### 11.3 Scoring Algorithm (`scoreMethodsForProblem`)

```
function scoreMethodsForProblem(classification, availableMethods?):
    // Step 1: Accumulate category weights from selection matrix
    categoryWeights = { formal: 0, probabilistic: 0, causal: 0,
                        experience: 0, social: 0, meta: 0 }

    for each (dimension, value) in classification:
        weights = SELECTION_MATRIX[dimension][value]
        for each (category, w) in weights:
            categoryWeights[category] += w

    // Step 2: Normalize so all weights sum to 1
    totalWeight = sum(categoryWeights)
    if totalWeight > 0:
        for each category: categoryWeights[category] /= totalWeight

    // Step 3: Score each method by its category weight
    for each method in (availableMethods or all methods):
        categoryScore = categoryWeights[method.category]
        toolBoost = 0.05 if method has dedicated_tool else 0
        score = min(1, categoryScore + toolBoost)
        recommendations.push({ method, score, rationale })

    // Step 4: Sort by score descending
    recommendations.sort(by score descending)
    return recommendations
```

**Design rationale for the tool boost:** Methods with dedicated tools have been implemented with more care and specificity (e.g., structured parameters, algorithm support), so they receive a 5-percentage-point bonus to prefer them over generic prompt-only methods in the same category.

### 11.4 Default Classification

When `problem_classification` is not provided, the meta-reasoning tool defaults to a moderate profile:

```typescript
{
  uncertainty: "medium",
  complexity: "moderate",
  domain: "mixed",
  time_pressure: "none",
  data_availability: "moderate",
  stakes: "medium"
}
```

### 11.5 Tool Output

The `reason_meta` tool returns the top 5 recommended methods with scores, rationales, and a primary recommendation. It also suggests the appropriate invocation -- either via the `reason` router with the recommended method name, or via the dedicated tool if one exists.

---

## 12. Multi-Method Fusion

Source: `reasoning/fusion.ts`

When multiple reasoning methods are applied to the same problem (Mode 3 of the reasoning router), the fusion engine combines their outputs into a coherent synthesis.

### 12.1 `fuseResults(results: ReasoningResult[]): FusionResult`

The main fusion function:

1. Computes agreement score via `computeAgreementScore()`.
2. Detects disagreements via `detectDisagreement()`.
3. Synthesizes conclusions (for single result: pass through; for multiple: concatenates with method labels).
4. Computes overall confidence as the mean of individual confidences.

### 12.2 `computeAgreementScore(results): number`

```
function computeAgreementScore(results):
    if results.length < 2: return 1.0
    confidences = results.map(r => r.confidence)
    mean = average(confidences)
    variance = average((c - mean)^2 for c in confidences)
    return max(0, 1 - sqrt(variance) * 2)
```

**Interpretation:**

- Agreement score of 1.0 means all methods have identical confidence levels.
- Agreement score of 0.0 means extreme variance (standard deviation >= 0.5).
- The factor of 2 is a scaling heuristic: a standard deviation of 0.25 in confidences yields an agreement score of 0.5.

### 12.3 `detectDisagreement(results): string[]`

Detects disagreements using two heuristics:

**Heuristic 1 -- Confidence spread:** If the difference between the highest and lowest confidence exceeds 0.4, a disagreement is flagged:

```
"Confidence spread: {highMethod} (0.85) vs {lowMethod} (0.35)"
```

**Heuristic 2 -- Directional conflict:** Pairwise comparison of conclusions for opposing recommendations. Currently detects "should" vs. "should not" patterns:

```
if conclusion_a contains "should not" AND conclusion_b contains "should" (but NOT "should not"):
    flag "Directional conflict between {method_a} and {method_b}"
```

### 12.4 `formatFusionPrompt(fusion): string`

Renders the fusion result as a structured markdown document for final LLM synthesis:

```markdown
## Multi-Method Reasoning Fusion

**Methods used:** bayesian, causal, dialectical
**Agreement score:** 78%

### bayesian (probabilistic) -- confidence: 82%

[conclusion text]

### causal (causal) -- confidence: 71%

[conclusion text]

### dialectical (social) -- confidence: 69%

[conclusion text]

### Disagreements

- Confidence spread: bayesian (0.82) vs dialectical (0.69)

Synthesize these perspectives into a unified conclusion. Address any disagreements.
```

---

## 13. The Inference Engine -- Forward Chaining

Source: `tools/inference-tools.ts`

### 13.1 Overview

The inference engine operates on the fact store and rule engine to derive new knowledge through three distinct reasoning modes. This section covers forward chaining in full detail.

**Tool:** `infer_forward`
**Parameters:** `agent_id`, `max_iterations?: number` (default: 10), `persist?: boolean` (default: true)

### 13.2 Algorithm -- Forward Chaining to Fixed-Point

```
function forwardChain(facts, rules, maxIterations):
    newFacts = []
    trace = []
    existingTriples = Set of "subject|predicate|object" strings from all facts

    for iter = 0 to maxIterations - 1:
        derived = false
        allFacts = facts + newFacts

        for each rule in rules:
            if rule is disabled or rule.type != "inference": skip

            // Pattern matching with variable unification
            bindings = matchConditions(rule.conditions, allFacts)

            for each binding:
                // Resolve conclusion template using bindings
                conclusion = resolveBinding(rule.conclusion, binding)
                tripleKey = "{conclusion.subject}|{conclusion.predicate}|{conclusion.object}"

                if tripleKey not in existingTriples:
                    // Find supporting facts for confidence calculation
                    supportingFacts = findSupportingFacts(rule.conditions, allFacts, binding)
                    minConfidence = min(f.confidence for f in supportingFacts)
                    derivedConfidence = minConfidence * rule.confidence_factor

                    newFact = {
                        id: "F-inf-{timestamp}-{random}",
                        subject: conclusion.subject,
                        predicate: conclusion.predicate,
                        object: conclusion.object,
                        confidence: round(derivedConfidence, 2),
                        source: "inference",
                        derived_from: [supporting fact IDs],
                        rule_id: rule.id
                    }

                    newFacts.append(newFact)
                    existingTriples.add(tripleKey)
                    trace.append(derivation record)
                    derived = true

        if not derived: break     // Fixed-point reached

    return { newFacts, trace }
```

### 13.3 Variable Binding and Pattern Matching

The `matchConditions` function implements recursive pattern matching with variable unification:

```
function matchConditions(conditions, facts):
    if conditions is empty: return [{}]    // one empty binding

    function matchSingle(condition, fact, binding):
        b = copy(binding)
        if condition.predicate != fact.predicate: return null

        if condition.subject:
            if condition.subject starts with "?":
                // Variable: check existing binding or create new one
                if b[condition.subject] exists and b[condition.subject] != fact.subject:
                    return null    // inconsistent binding
                b[condition.subject] = fact.subject
            else if condition.subject != fact.subject:
                return null        // literal mismatch

        if condition.object:
            if condition.object starts with "?":
                if b[condition.object] exists and b[condition.object] != fact.object:
                    return null
                b[condition.object] = fact.object
            else if condition.object != fact.object:
                return null

        return b

    function solve(conditionIndex, binding):
        if conditionIndex >= conditions.length: return [binding]
        results = []
        for each fact in facts:
            b = matchSingle(conditions[conditionIndex], fact, binding)
            if b is not null:
                results.extend(solve(conditionIndex + 1, b))
        return results

    return solve(0, {})
```

**Key properties:**

- Variables (tokens starting with `?`) bind to actual values from matching facts.
- Bindings are consistent: once `?x` binds to "Alice", all subsequent conditions must match "Alice" for `?x`.
- The algorithm recursively tries all possible fact-condition combinations, producing all valid binding sets.
- This is essentially a join operation across conditions, with variable unification providing the join keys.

### 13.4 Confidence Propagation

Derived fact confidence is computed as:

```
derived_confidence = min(supporting_fact_confidences) * rule.confidence_factor
```

**Rationale:** The confidence of a derived fact is limited by its weakest supporting evidence (min) and further attenuated by the rule's own reliability factor. This ensures that chains of inference naturally degrade in confidence -- a derived fact from facts of confidence 0.8, via a rule with factor 0.9, has confidence 0.72.

### 13.5 TypeDB Integration

Before running file-based forward chaining, the tool attempts to use TypeDB for condition evaluation:

```typescript
const client = getTypeDBClient();
if (client.isAvailable()) {
  for (const rule of rules) {
    for (const cond of rule.conditions) {
      const typeql = InferenceQueries.findMatchingPatterns(
        agentId,
        cond.predicate,
        cond.subject,
        cond.object,
      );
      await client.matchQuery(typeql, databaseName);
    }
  }
}
```

If TypeDB is unavailable, the system falls through to file-based inference without error.

### 13.6 Persistence

When `persist` is true (default), newly derived facts are appended to the agent's `facts.json` file and the version counter is incremented. The derivation trace is included in the tool output so the agent can inspect the reasoning chain.

---

## 14. Backward Chaining -- Goal-Directed Reasoning

**Tool:** `infer_backward`
**Parameters:** `agent_id`, `goal_subject?: string`, `goal_predicate: string`, `goal_object?: string`, `max_depth?: number` (default: 5)

### 14.1 Algorithm

```
function backwardChain(goal, facts, rules):
    // Step 1: Direct fact check
    directMatches = facts.filter(f =>
        f.predicate == goal.predicate AND
        (goal.subject is null OR f.subject == goal.subject) AND
        (goal.object is null OR f.object == goal.object)
    )

    if directMatches is not empty:
        return { status: "Directly supported", matches: directMatches }

    // Step 2: Find rules that could derive the goal
    applicableRules = rules.filter(r =>
        r.enabled AND
        r.type == "inference" AND
        r.conclusion.predicate == goal.predicate
    )

    if applicableRules is empty:
        return { status: "Cannot prove", knowledgeGap: goal.predicate }

    // Step 3: For each applicable rule, analyze condition satisfaction
    for each rule in applicableRules:
        satisfied = rule.conditions.filter(c =>
            facts.some(f => f.predicate == c.predicate)
        )
        missing = rule.conditions.filter(c =>
            NOT facts.some(f => f.predicate == c.predicate)
        )

    // Step 4: Report results
    return {
        status: "Potentially derivable",
        applicableRules,
        satisfiedConditions,
        missingConditions (= knowledge gaps)
    }
```

### 14.2 TypeDB Proof Search

Before file-based reasoning, the tool attempts TypeDB-based proof via:

```typescript
const typeql = InferenceQueries.proveGoal(agentId, goalPredicate, goalSubject, goalObject);
await client.matchQuery(typeql, databaseName);
```

This searches the graph database for facts matching the goal pattern, including facts that may have been derived through TypeDB's own inference rules.

### 14.3 Knowledge Gap Identification

The most valuable output of backward chaining is the explicit identification of **knowledge gaps** -- conditions that are required by applicable rules but not satisfied by any known facts. This directly feeds into the agent's perception and learning phases: the agent knows what information it needs to acquire.

Output format:

```
### Rule: R-001 -- Customer Loyalty Rule
  Conditions: 3 (2 satisfied, 1 missing)
    [checkmark] purchase_amount
    [checkmark] customer_tenure
    [X] satisfaction_score (NEEDED)
```

---

## 15. Abductive Reasoning -- Hypothesis Generation

**Tool:** `infer_abductive`
**Parameters:** `agent_id`, `observation: {subject, predicate, object}`, `max_hypotheses?: number` (default: 5)

### 15.1 Algorithm

```
function abductiveReason(observation, facts, rules, maxHypotheses):
    // Step 1: Find rules whose conclusion matches the observation
    explanatoryRules = rules.filter(r =>
        r.enabled AND r.conclusion.predicate == observation.predicate
    )

    // Step 2: Score each rule as a hypothesis
    hypotheses = []
    for each rule in explanatoryRules:
        supported = count of rule.conditions where
            facts.some(f => f.predicate == condition.predicate)
        total = rule.conditions.length
        score = (supported / total) * rule.confidence_factor

        hypotheses.push({
            rule_id, rule_name, conditions,
            supported, total, score
        })

    // Step 3: Rank by plausibility score (descending)
    hypotheses.sort(by score descending)
    return hypotheses.slice(0, maxHypotheses)
```

### 15.2 Plausibility Scoring

The plausibility score for a hypothesis (rule) is:

```
score = (supported_conditions / total_conditions) * confidence_factor
```

Where:

- `supported_conditions` = number of the rule's conditions that have at least one matching fact in the store.
- `total_conditions` = total number of conditions in the rule.
- `confidence_factor` = the rule's own reliability rating (0.0-1.0).

A score of 1.0 means all conditions are supported and the rule has perfect confidence. A score of 0.0 means no conditions are supported.

### 15.3 Output Format

Each hypothesis is presented with its conditions marked as supported (checkmark) or unknown (question mark):

```
### Hypothesis 1: High Customer Churn (score: 0.72)
  Rule: R-005
  Evidence: 2/3 conditions supported
    [checkmark] (customer, satisfaction_score, low)
    [checkmark] (customer, competitor_offer, available)
    [?] (customer, contract_end, near)
```

---

## 16. The Rule Engine

Source: `tools/rule-engine.ts`

### 16.1 Rule Types

The rule engine supports three distinct rule types, each serving a different purpose:

| Type         | Purpose          | Trigger Semantics                              | Key Fields                      |
| ------------ | ---------------- | ---------------------------------------------- | ------------------------------- |
| `inference`  | Derive new facts | All conditions match -> derive conclusion      | `conclusion`                    |
| `constraint` | Flag violations  | All conditions match = bad state exists        | `violation_message`, `severity` |
| `policy`     | Trigger actions  | Context matches conditions -> required actions | `action`, `escalate`            |

### 16.2 Rule Structure

```typescript
type Rule = {
  id: string; // e.g., "R-001"
  name: string; // Human-readable name
  description: string; // What the rule does
  type: "inference" | "constraint" | "policy";
  conditions: ConditionPattern[];
  conclusion?: {
    // For inference rules
    subject?: string;
    predicate: string;
    object?: string;
    variable?: string;
  };
  violation_message?: string; // For constraint rules
  severity?: "info" | "warning" | "error" | "critical";
  action?: string; // For policy rules
  escalate?: boolean; // For policy rules
  confidence_factor: number; // 0.0-1.0 (default: 0.9)
  enabled: boolean;
  domain?: string; // Business domain scoping
  created_at: string;
};
```

### 16.3 Condition Patterns

Each condition in a rule is a pattern that matches against SPO triples:

```typescript
type ConditionPattern = {
  subject?: string; // Literal value or "?variable"
  predicate: string; // Required literal predicate to match
  object?: string; // Literal value or "?variable"
  operator?: "eq" | "gt" | "lt" | "gte" | "lte" | "ne" | "contains";
};
```

**Variable binding:** Tokens starting with `?` (e.g., `?customer`, `?amount`) are variables that bind to actual values from matched facts. Once bound, the same variable must match the same value across all conditions (unification semantics).

**Operator semantics:** When an operator is specified with a literal object value, the fact's object is compared using that operator:

| Operator       | Meaning               | Example                                                      |
| -------------- | --------------------- | ------------------------------------------------------------ |
| `eq` (default) | Equals                | `object: "gold"` matches `object == "gold"`                  |
| `gt`           | Greater than          | `object: "1000", operator: "gt"` matches fact objects > 1000 |
| `lt`           | Less than             | Numeric comparison                                           |
| `gte`          | Greater than or equal | Numeric comparison                                           |
| `lte`          | Less than or equal    | Numeric comparison                                           |
| `ne`           | Not equal             | String or numeric inequality                                 |
| `contains`     | Substring match       | String containment                                           |

### 16.4 Constraint Checking (`constraint_check`)

**Tool:** `constraint_check`
**Parameters:** `agent_id`, `domain?: string`

The constraint checker evaluates all enabled constraint rules against the current fact store. A constraint is **violated** when all its conditions ARE met -- because for constraints, the conditions describe a bad state.

```
for each constraint rule (enabled, type="constraint", matching domain):
    allMatch = every condition has at least one matching fact
    if allMatch:
        violations.push({rule, message: rule.violation_message})
```

**Severity icons in output:**

| Severity   | Icon          | Meaning                                              |
| ---------- | ------------- | ---------------------------------------------------- |
| `critical` | Red circle    | System-critical violation requiring immediate action |
| `error`    | Orange circle | Significant violation requiring attention            |
| `warning`  | Yellow circle | Potential issue to monitor                           |
| `info`     | Info icon     | Informational notice                                 |

### 16.5 Policy Evaluation (`policy_eval`)

**Tool:** `policy_eval`
**Parameters:** `agent_id`, `context: Record<string, unknown>`

Evaluates all enabled policy rules against the provided context. The tool formats the context and rules as a structured prompt for the LLM to determine which policies are triggered and what actions to execute. For triggered policies with `escalate: true`, the output recommends stakeholder notification.

### 16.6 TypeDB Write-Through

When a rule is created or toggled, the rule engine performs a best-effort write-through to TypeDB:

- `rule_create` -> `RuleStoreQueries.createRule()` (TypeQL insert)
- `rule_toggle` -> `RuleStoreQueries.toggleRule()` (TypeQL delete/insert for enabled attribute)
- `rule_list` -> `RuleStoreQueries.listRules()` (TypeQL match, exercising the connection)

If TypeDB is unavailable, the JSON file remains the authoritative source.

---

## 17. The Fact Store

Source: `tools/fact-store.ts`

### 17.1 SPO Triple Structure

Every fact is a Subject-Predicate-Object (SPO) triple with rich metadata:

```typescript
type Fact = {
  id: string; // Unique ID, e.g., "F-1708000000-a1b2"
  subject: string; // Entity, e.g., "acme-consulting"
  predicate: string; // Relationship, e.g., "hasRevenue"
  object: string; // Value, e.g., "$50000"
  confidence: number; // 0.0 - 1.0
  source: string; // Provenance, e.g., "cfo-report", "inference"
  valid_from?: string; // ISO timestamp -- when fact becomes valid
  valid_until?: string; // ISO timestamp -- when fact expires
  derived_from?: string[]; // Source fact IDs (for inferred facts)
  rule_id?: string; // Rule that produced this fact
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
};
```

### 17.2 Fact Assert (`fact_assert`)

Creates or updates a fact. If a triple with identical subject, predicate, and object already exists, it is updated in place (preserving the original `created_at` but updating confidence, source, and `updated_at`).

**Write-through pipeline:**

1. Save to JSON file (`agents/{agent_id}/facts.json`)
2. Best-effort insert to TypeDB via `FactStoreQueries.assertFact()`
3. Materialize to indexed Markdown for OpenClaw semantic search (async, non-blocking)

### 17.3 Fact Retract (`fact_retract`)

Removes facts by ID, subject, or predicate. Supports three modes:

- **By ID:** `fact_id: "F-123"` -- removes the specific fact.
- **By subject:** `subject: "acme-consulting"` -- removes all facts about that entity.
- **By predicate:** `predicate: "hasRevenue"` -- removes all facts with that relationship.

TypeDB retraction is performed best-effort via `FactStoreQueries.retractFact()`.

### 17.4 Fact Query (`fact_query`)

**Parameters:**

- `subject` -- filter by subject (supports `*` wildcard for all)
- `predicate` -- filter by predicate
- `object` -- filter by object
- `min_confidence` -- minimum confidence threshold
- `valid_at` -- check temporal validity at a specific date
- `include_derived` -- include/exclude inferred facts (default: true)
- `limit` -- max results (default: 50)

**Query algorithm:**

```
function queryFacts(store, params):
    results = store.facts.filter(f =>
        (no subject filter OR subject == "*" OR f.subject == subject) AND
        (no predicate filter OR f.predicate == predicate) AND
        (no object filter OR f.object == object) AND
        (f.confidence >= min_confidence) AND
        (include_derived OR f.derived_from is null) AND
        (no valid_at OR (f.valid_from <= valid_at AND
                         (f.valid_until is null OR f.valid_until >= valid_at)))
    )
    return results.slice(0, limit)
```

**TypeDB query execution:** Before running the JSON filter, the tool attempts to execute an equivalent TypeQL match query via `FactStoreQueries.queryFacts()`. Currently JSON remains authoritative for result parsing.

### 17.5 Fact Explain (`fact_explain`)

**Tool:** `fact_explain`
**Parameters:** `agent_id`, `fact_id`

Traces the derivation chain of a fact up to 2 levels deep:

```
## Fact Explanation: F-inf-123

**Triple:** (customer-001, loyalty_tier, gold)
**Confidence:** 0.72
**Source:** inference
**Created:** 2026-02-24T10:00:00Z

### Derivation Chain
**Rule:** R-001
**Derived from:**
- F-100: (customer-001, purchase_total, 15000) [0.95]
- F-101: (customer-001, tenure_months, 36) [0.85]
  <- F-050: (customer-001, signup_date, 2023-02-01) [0.99]
```

**Recursive tracing:** For each supporting fact that is itself derived, the tool shows one additional level of provenance (the `<-` indented lines).

### 17.6 File Storage Format

Facts are stored in `agents/{agent_id}/facts.json`:

```json
{
  "facts": [
    {
      "id": "F-1708000000-a1b2",
      "subject": "acme-consulting",
      "predicate": "hasRevenue",
      "object": "$50000",
      "confidence": 0.85,
      "source": "quarterly-report",
      "valid_from": "2026-01-01T00:00:00Z",
      "valid_until": "2026-03-31T23:59:59Z",
      "created_at": "2026-02-01T10:00:00Z",
      "updated_at": "2026-02-01T10:00:00Z"
    }
  ],
  "version": 42
}
```

---

## 18. Case-Based Reasoning (CBR-BDI)

Source: `tools/cbr-tools.ts`

### 18.1 BDI-Weighted Similarity Formula

The CBR module uses a BDI-specific similarity function that weights belief overlap more heavily than desire overlap:

```
S(B, D) = 0.6 * Sb + 0.4 * Sd

Where:
    Sb = |beliefs_current INTERSECT beliefs_case| / max(|beliefs_case|, 1)
    Sd = |desires_current INTERSECT desires_case| / max(|desires_case|, 1)
```

**Design rationale:** Beliefs (the agent's understanding of the world) are weighted at 60% because they define the objective situation. Desires (the agent's goals) are weighted at 40% because they define the purpose of the solution. Two cases with identical situations but different goals may require different solutions, but the situation match is more fundamental.

### 18.2 Case Structure

```typescript
{
    case_id: string;        // e.g., "C-001"
    situation: {
        beliefs: string[];  // Belief IDs active during this case
        desires: string[];  // Desire IDs active during this case
        context: string;    // Situation description
    };
    solution: {
        plan_id: string;    // Plan that was used
        actions: string[];  // Actions taken
    };
    outcome: {
        success: boolean;
        metrics: Record<string, number>;  // Outcome metrics
        lessons: string;    // Lessons learned
    };
    stored_at: string;      // ISO timestamp
}
```

### 18.3 Case Retrieval (`cbr_retrieve`)

**Parameters:** `agent_id`, `beliefs: string[]`, `desires: string[]`, `max_results?: number` (default: 5), `include_negative?: boolean`

**Algorithm:**

```
function cbrRetrieve(cases, currentBeliefs, currentDesires, maxResults, includeNegative):
    beliefSet = Set(currentBeliefs)
    desireSet = Set(currentDesires)

    scored = cases
        .filter(c => includeNegative OR c.outcome.success != false)
        .map(c => {
            sb = count of c.situation.beliefs that are in beliefSet
            sd = count of c.situation.desires that are in desireSet
            totalB = max(c.situation.beliefs.length, 1)
            totalD = max(c.situation.desires.length, 1)
            score = (sb / totalB) * 0.6 + (sd / totalD) * 0.4
            return { ...c, score }
        })
        .sort(by score descending)
        .slice(0, maxResults)

    return scored
```

**Negative case filtering:** By default, failure cases are excluded from retrieval to prevent recommending known bad solutions. Setting `include_negative: true` includes them, which is useful for "what not to do" analysis.

### 18.4 Case Storage (`cbr_store`)

**Parameters:** `agent_id`, `case_id`, `situation`, `solution`, `outcome`

Stores a new case or updates an existing one (matching by `case_id`). Cases are stored in `agents/{agent_id}/cases.json`. A configurable maximum case limit (default: 10,000) triggers FIFO pruning when exceeded.

### 18.5 CBR in the BDI Cycle

CBR is invoked during the Deliberate and Plan phases:

- **Deliberate:** Retrieve similar past cases to inform option evaluation.
- **Plan:** Adapt retrieved solution plans to the current situation.
- **Learn:** After execution, store the new case with its outcome for future retrieval.

---

## 19. Knowledge Query and Explanation Tools

### 19.1 Knowledge Explain (`knowledge_explain`)

**Tool:** `knowledge_explain`
**Parameters:** `agent_id`, `question: string`, `method?: "forward" | "backward" | "abductive" | "auto"`

This is the highest-level knowledge tool. It combines:

1. **Fact store contents** (up to 20 facts displayed, full count reported)
2. **Rule inventory** (up to 10 rules listed)
3. **Knowledge.md file** content from the agent's workspace
4. **Method-specific instructions:**

| Method      | Instructions                                          |
| ----------- | ----------------------------------------------------- |
| `forward`   | Run forward chaining to derive new facts, then answer |
| `backward`  | Backward chain from the question to find proofs       |
| `abductive` | Generate hypotheses for the question                  |
| `auto`      | Apply all three as appropriate                        |

The combined output provides the LLM with complete context to answer the question using the specified reasoning method, tracing derivation chains and stating confidence.

### 19.2 Agent Context Loading

The reasoning router loads agent-specific context for every reasoning invocation:

```typescript
const beliefs = await readMd(join(ws, "agents", params.agent_id, "Beliefs.md"));
const kb = await readMd(join(ws, "agents", params.agent_id, "Knowledge.md"));
```

This ensures that reasoning is always grounded in the agent's current belief state and accumulated knowledge.

---

## 20. TypeDB Query Layer

Source: `knowledge/typedb-queries.ts`

### 20.1 Architecture

The TypeDB query layer provides 12 static query builder classes that generate TypeQL strings for the complete MABOS knowledge infrastructure. Every query is agent-scoped via the `agent_owns` relation pattern.

### 20.2 Query Classes

| Class                   | Methods                                                                                | Purpose                                                      |
| ----------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `FactStoreQueries`      | `assertFact`, `retractFact`, `queryFacts`, `explainFact`                               | SPO triple CRUD and provenance tracing                       |
| `RuleStoreQueries`      | `createRule`, `listRules`, `toggleRule`                                                | Inference/constraint/policy rule management                  |
| `MemoryQueries`         | `storeItem`, `recallItems`, `consolidate`                                              | Short-term and long-term memory operations                   |
| `InferenceQueries`      | `findMatchingPatterns`, `proveGoal`                                                    | Forward chaining condition matching, backward chaining proof |
| `CBRQueries`            | `storeCase`, `retrieveSimilar`                                                         | Case storage and domain-scoped retrieval                     |
| `GoalStoreQueries`      | `createGoal`, `linkDesireToGoal`, `linkGoalToPlan`, `queryGoals`, `updateGoalProgress` | Goal hierarchy management                                    |
| `DesireStoreQueries`    | `createDesire`, `queryDesires`                                                         | Desire CRUD with category filtering                          |
| `BeliefStoreQueries`    | `createBelief`, `linkBeliefToGoal`, `queryBeliefs`                                     | Belief management with certainty filtering                   |
| `DecisionStoreQueries`  | `createDecision`, `resolveDecision`, `queryDecisions`, `linkDecisionToGoal`            | Decision tracking and resolution                             |
| `WorkflowStoreQueries`  | `createWorkflow`, `queryWorkflows`                                                     | Workflow CRUD with cron scheduling support                   |
| `TaskStoreQueries`      | `createTask`, `queryTasks`, `updateTaskStatus`                                         | Task management with assignment and dependencies             |
| `IntentionStoreQueries` | `createIntention`, `queryIntentions`, `updateIntentionStatus`                          | BDI intention tracking with commitment strategies            |

### 20.3 Agent Scoping Pattern

Every query includes the agent ownership relation:

```typeql
match
  $agent isa agent, has uid "org/agent-001";
  $fact isa spo_fact, has predicate "hasRevenue", ...;
  (owner: $agent, owned: $fact) isa agent_owns;
```

This ensures strict tenant isolation -- an agent can only access its own entities. The `agent_owns` relation uses the role-playing pattern with `owner` and `owned` roles.

### 20.4 Base Schema (`getBaseSchema()`)

The base schema defines the complete TypeDB type system for MABOS:

**Attributes (70+):**

| Category       | Attributes                                                                                                                                                                                                                                                                                            |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core           | `uid`, `name`, `description`, `confidence`, `source`, `created_at`, `updated_at`                                                                                                                                                                                                                      |
| SPO Facts      | `subject`, `predicate`, `object_value`, `valid_from`, `valid_until`, `rule_id`                                                                                                                                                                                                                        |
| Rules          | `rule_type`, `condition_count`, `confidence_factor`, `enabled`, `domain`                                                                                                                                                                                                                              |
| Memory         | `content`, `memory_type`, `importance`, `store_name`, `access_count`, `accessed_at`, `tag`                                                                                                                                                                                                            |
| CBR            | `situation`, `solution`, `outcome`                                                                                                                                                                                                                                                                    |
| BDI Cognitive  | `category`, `certainty`, `priority`, `urgency`, `alignment`, `hierarchy_level`, `success_criteria`, `deadline`, `progress`, `parent_goal_id`, `commitment_strategy`, `plan_ref`, `plan_source`, `step_count`, `adaptation_notes`, `step_type`, `tool_binding`, `estimated_duration`, `sequence_order` |
| Agent Identity | `role_title`, `department`, `responsibilities`, `autonomy_level`, `approval_threshold`, `proficiency_level`, `skill_category`, `tool_access`                                                                                                                                                          |
| Scheduling     | `cron_expression`, `cron_enabled`, `cron_timezone`                                                                                                                                                                                                                                                    |
| Workflow       | `workflow_type`, `trigger`, `current_step_id`, `assigned_agent_id`, `depends_on_ids`, `task_type`, `tool_used`, `input_summary`, `output_summary`                                                                                                                                                     |
| Decision       | `urgency_level`, `options_json`, `recommendation`                                                                                                                                                                                                                                                     |
| Status         | `status`, `committed_at`                                                                                                                                                                                                                                                                              |

**Entities (20+):**

`agent`, `spo_fact`, `knowledge_rule`, `memory_item`, `cbr_case`, `belief`, `desire`, `goal`, `intention`, `plan`, `plan_step`, `decision`, `workflow`, `task`

**Relations (12+):**

| Relation                 | Roles                       | Purpose                                |
| ------------------------ | --------------------------- | -------------------------------------- |
| `agent_owns`             | `owner`, `owned`            | Agent scoping for all entities         |
| `desire_motivates_goal`  | `motivator`, `motivated`    | Links desires to goals they generate   |
| `goal_requires_plan`     | `requiring`, `required`     | Links goals to their fulfillment plans |
| `belief_supports_goal`   | `believer`, `supported`     | Links beliefs to goals they justify    |
| `decision_resolves_goal` | `resolver`, `resolved_goal` | Links decisions to goals they address  |

### 20.5 Database Naming Convention

TypeDB databases are named using the pattern `mabos_{organization}` where the organization is extracted from the agent ID (e.g., agent ID `acme/agent-001` uses database `mabos_acme`). If no organization prefix exists, `mabos_default` is used.

---

## 21. Data Flow Diagrams

### 21.1 Reasoning Request Flow

```
Agent invokes reason tool
        |
        v
+-- Is method specified? --+
|   YES                    |   NO
|   |                      |
|   v                      +-- Is problem_classification provided? --+
| Look up method           |   YES                                   |
| in REASONING_METHODS     |   |                                     | NO
|   |                      |   v                                     |
|   v                      | scoreMethodsForProblem()                |
| Format prompt            | Pick top method                        |
| with agent context       |   |                                     |
|   |                      |   v                                     |
|   |                      | Format prompt                           |
|   |                      |   |                                     |
|   +----+-----+-----------+   +-- Is multi_method? --+              |
|        |     |                |   YES                | NO           |
|        |     |                |   |                  | |            |
|        v     v                |   v                  | v            |
|    Return to LLM              | Run each method      | Fallback:   |
|    for synthesis              | Format multi prompt  | general     |
|                               | fuseResults()        | reasoning   |
|                               | formatFusionPrompt() | prompt      |
|                               |   |                  |             |
|                               |   v                  v             |
|                               | Return to LLM     Return to LLM   |
+-------------------------------+------+----------------------------+
```

### 21.2 Inference Chain Flow

```
infer_forward invoked
        |
        v
Load facts (facts.json) ----+
Load rules (rules.json) ----+
        |                   |
        v                   |
[Try TypeDB condition       |
 matching (best-effort)]    |
        |                   |
        v                   |
forwardChain(facts, rules)  |
        |                   |
        v                   |
+-- For each iteration: ----+---------+
|   For each inference rule:          |
|     matchConditions(conds, facts)   |
|       |                             |
|       v                             |
|     For each binding:               |
|       resolveBinding(conclusion)    |
|       Is triple new?                |
|         |         |                 |
|        YES       NO                |
|         |         |                 |
|         v         +-- skip          |
|       Compute confidence:           |
|       min(supporting) * rule.cf     |
|         |                           |
|         v                           |
|       Add to newFacts               |
|       Add to existingTriples        |
|       Log to trace                  |
|         |                           |
+-- No new facts derived? (break) ----+
        |
        v
Persist newFacts to facts.json (if persist=true)
        |
        v
Return trace + new facts to agent
```

### 21.3 Rule Evaluation Flow (Constraint Checking)

```
constraint_check invoked
        |
        v
Load facts (facts.json)
Load rules (rules.json)
        |
        v
Filter: enabled constraint rules (matching domain)
        |
        v
+-- For each constraint rule: --------+
|   For each condition:               |
|     Find any matching fact          |
|     (predicate match +              |
|      subject/object match +         |
|      operator evaluation)           |
|       |                             |
|       v                             |
|   All conditions match?             |
|     |          |                    |
|    YES        NO                    |
|     |          +-- rule satisfied   |
|     v                (no violation) |
|   VIOLATION DETECTED                |
|   Record: rule, severity, message   |
+--(next rule)-------------------------+
        |
        v
Format output:
  If no violations: "All constraints satisfied"
  If violations: List with severity icons
```

---

## 22. Algorithmic vs. LLM-Prompted Methods

The reasoning engine employs a deliberate split between purely algorithmic methods (which compute results directly) and prompt-based methods (which generate structured reasoning prompts for the LLM).

### 22.1 Algorithmic Methods (7)

| Method                    | Algorithm                   | Key Properties                                                                                                         |
| ------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `bayesian`                | Iterative Bayes' theorem    | Exact P(H\|E) computation; no LLM needed; chain multiple evidence items                                                |
| `fuzzy`                   | Mamdani fuzzy inference     | Full 4-step pipeline (fuzzify, evaluate, aggregate, defuzzify); triangular membership; centroid with 101 sample points |
| `constraint_satisfaction` | Backtracking CSP with MRV   | Exact solver for small problems; hard limits (20 vars, 10K backtracks); graceful LLM fallback                          |
| `statistical`             | Descriptive statistics      | Algorithmic mean/median/stddev/min/max; LLM interprets results                                                         |
| `temporal`                | Kahn's topological sort     | Exact ordering and cycle detection; LLM provides qualitative analysis                                                  |
| `trust`                   | Exponential decay + sigmoid | Exact trust/reliability/consistency/trend computation; no LLM needed                                                   |
| `meta_reasoning`          | Selection matrix scoring    | Exact method ranking via weighted matrix; deterministic recommendation                                                 |

### 22.2 Design Principles

**When to use algorithmic implementations:**

- The problem has a well-defined mathematical formulation.
- Exact or near-exact computation is feasible in reasonable time.
- The result benefits from precision and reproducibility.
- The domain is narrow enough that structured computation outperforms general reasoning.

**When to use LLM prompts:**

- The problem requires natural language understanding or generation.
- The reasoning involves nuance, context, and judgment.
- Multiple valid approaches exist and flexibility is more important than precision.
- The method's value comes from structured thinking rather than computation.

**Hybrid approach:** Some methods (statistical, temporal) use algorithms for the computational portion and LLM prompts for interpretation and qualitative analysis. This combines the precision of computation with the richness of natural language reasoning.

### 22.3 Fallback Pattern

Algorithmic methods implement a graceful degradation pattern:

```
1. Validate inputs against hard limits
2. If inputs exceed limits: generate structured LLM prompt (fallback)
3. Attempt algorithmic solution
4. If algorithm fails (timeout, no solution): generate structured LLM prompt
5. If algorithm succeeds: format and return exact results
```

This ensures that the system always produces useful output, even when the algorithmic solver cannot handle the specific instance.

---

## 23. Integration with the BDI Cycle

The reasoning and inference engine integrates into the agent's BDI (Belief-Desire-Intention) cognitive cycle at multiple points.

### 23.1 BDI Cycle Phases

```
Perceive --> Deliberate --> Plan --> Act --> Learn
    |            |           |       |        |
    |            |           |       |        +-- cbr_store (retain case)
    |            |           |       |            fact_assert (new observations)
    |            |           |       |
    |            |           |       +-- policy_eval (action policies)
    |            |           |
    |            |           +-- cbr_retrieve (reuse past plans)
    |            |               reason (means_ends, scenario)
    |            |
    |            +-- reason (any method)
    |                infer_forward (derive new beliefs)
    |                infer_backward (check goals)
    |                infer_abductive (explain observations)
    |                constraint_check (validate state)
    |                reason_meta (select approach)
    |
    +-- fact_assert (new perceptions)
        fact_query (check existing knowledge)
```

### 23.2 Perceive Phase

- **fact_assert:** New perceptions from the environment are stored as facts with confidence and source.
- **fact_query:** The agent checks existing knowledge for relevant context.

### 23.3 Deliberate Phase

This is where the reasoning engine is most heavily used:

- **reason (any method):** The agent applies reasoning to evaluate options, analyze situations, and form judgments.
- **reason_meta:** When uncertain about which reasoning approach to use, the agent invokes meta-reasoning to select the optimal method.
- **infer_forward:** Derives new beliefs from existing facts and rules.
- **infer_backward:** Checks whether goals are achievable given current knowledge.
- **infer_abductive:** Generates explanations for surprising observations.
- **constraint_check:** Validates that the current state does not violate any constraints.

### 23.4 Plan Phase

- **cbr_retrieve:** Retrieves similar past cases to inform plan generation.
- **reason (means_ends):** Gap analysis between current state and goal state.
- **reason (scenario):** Explores multiple plan alternatives.

### 23.5 Act Phase

- **policy_eval:** Evaluates policy rules against the current execution context to determine required approvals, escalations, or compliance actions.

### 23.6 Learn Phase

- **cbr_store:** Stores the completed case (situation, solution, outcome) for future retrieval.
- **fact_assert:** New observations from execution results are stored as facts.
- **infer_forward:** Derives new knowledge from execution outcomes.

---

## 24. Tool Catalog -- Parameter Reference

### 24.1 Reasoning Router

| Tool     | Parameters                                                                                                           | Description                                      |
| -------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `reason` | `agent_id`, `method?`, `problem`, `context?`, `constraints?`, `problem_classification?`, `multi_method?`, `methods?` | Central reasoning router with 3 invocation modes |

### 24.2 Formal Reasoning Tools

| Tool                | Parameters                                                                | Description                                  |
| ------------------- | ------------------------------------------------------------------------- | -------------------------------------------- |
| `reason_deductive`  | `premises: string[]`, `query`                                             | Derive conclusions from premises             |
| `reason_inductive`  | `observations: string[]`, `hypothesis?`, `domain?`                        | Generalize from observations                 |
| `reason_abductive`  | `observations: string[]`, `candidate_explanations?`, `domain?`            | Inference to best explanation                |
| `reason_analogical` | `source_domain`, `target_problem`, `known_mappings?`                      | Cross-domain analogical mapping              |
| `reason_modal`      | `proposition`, `modality`, `context?`                                     | Possibility/necessity/contingency analysis   |
| `reason_deontic`    | `action`, `norms: Array<{norm, type}>`, `context?`                        | Obligation/permission/prohibition evaluation |
| `reason_constraint` | `variables: Array<{name, domain}>`, `constraints: string[]`, `objective?` | CSP solver with MRV + fallback               |

### 24.3 Probabilistic Reasoning Tools

| Tool                 | Parameters                                                                                | Description                            |
| -------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------- |
| `reason_bayesian`    | `agent_id`, `hypothesis`, `prior`, `evidence: Array<{description, likelihood, marginal}>` | Iterative Bayes' theorem               |
| `reason_fuzzy`       | `variables: Array<{name, value, sets}>`, `rules`, `output_variable`                       | Mamdani fuzzy inference                |
| `reason_statistical` | `data: Array<{label, value}>`, `analysis_type`, `context?`                                | Descriptive stats + LLM interpretation |

### 24.4 Causal Reasoning Tools

| Tool                    | Parameters                                                                      | Description                        |
| ----------------------- | ------------------------------------------------------------------------------- | ---------------------------------- |
| `reason_causal`         | `agent_id`, `effect`, `candidate_causes: string[]`, `observations?`             | Root cause analysis                |
| `reason_counterfactual` | `agent_id`, `actual`, `counterfactual`, `variables?`                            | What-if analysis                   |
| `reason_temporal`       | `events: Array<{id, label, timestamp?, depends_on?}>`, `query`, `analysis_type` | Temporal ordering and dependencies |
| `reason_scenario`       | `base_assumptions: string[]`, `variations`, `eval_criteria?`                    | Multi-scenario exploration         |

### 24.5 Social Reasoning Tools

| Tool                    | Parameters                                                                        | Description                           |
| ----------------------- | --------------------------------------------------------------------------------- | ------------------------------------- |
| `reason_dialectical`    | `thesis`, `antithesis`, `criteria?`                                               | Thesis-antithesis-synthesis           |
| `reason_ethical`        | `situation`, `principles: string[]`, `frameworks?`                                | Multi-framework ethical analysis      |
| `reason_game_theoretic` | `players: string[]`, `strategies`, `payoffs?`, `context?`                         | Nash equilibria and strategy analysis |
| `reason_trust`          | `target_agent_id`, `history: Array<{outcome, value, timestamp}>`, `decay_factor?` | Trust scoring with time decay         |

### 24.6 Meta-Reasoning Tools

| Tool          | Parameters                                                 | Description                                 |
| ------------- | ---------------------------------------------------------- | ------------------------------------------- |
| `reason_meta` | `problem`, `problem_classification?`, `available_methods?` | Problem classification and method selection |

### 24.7 Inference Tools

| Tool                | Parameters                                                                  | Description                       |
| ------------------- | --------------------------------------------------------------------------- | --------------------------------- |
| `infer_forward`     | `agent_id`, `max_iterations?`, `persist?`                                   | Forward chaining to fixed-point   |
| `infer_backward`    | `agent_id`, `goal_subject?`, `goal_predicate`, `goal_object?`, `max_depth?` | Goal-directed proof search        |
| `infer_abductive`   | `agent_id`, `observation: {subject, predicate, object}`, `max_hypotheses?`  | Hypothesis generation and ranking |
| `knowledge_explain` | `agent_id`, `question`, `method?`                                           | Combined knowledge explanation    |

### 24.8 Rule Engine Tools

| Tool               | Parameters                                                                                                                                                                    | Description                        |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `rule_create`      | `agent_id`, `rule_id`, `name`, `description`, `type`, `conditions`, `conclusion?`, `violation_message?`, `severity?`, `action?`, `escalate?`, `confidence_factor?`, `domain?` | Create/update a rule               |
| `rule_list`        | `agent_id`, `type?`, `enabled_only?`                                                                                                                                          | List rules with optional filtering |
| `rule_toggle`      | `agent_id`, `rule_id`, `enabled`                                                                                                                                              | Enable/disable a rule              |
| `constraint_check` | `agent_id`, `domain?`                                                                                                                                                         | Evaluate constraint rules          |
| `policy_eval`      | `agent_id`, `context`                                                                                                                                                         | Evaluate policy rules              |

### 24.9 Fact Store Tools

| Tool           | Parameters                                                                                                    | Description                 |
| -------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `fact_assert`  | `agent_id`, `subject`, `predicate`, `object`, `confidence`, `source`, `valid_from?`, `valid_until?`           | Assert/update an SPO triple |
| `fact_retract` | `agent_id`, `fact_id?`, `subject?`, `predicate?`                                                              | Remove facts                |
| `fact_query`   | `agent_id`, `subject?`, `predicate?`, `object?`, `min_confidence?`, `valid_at?`, `include_derived?`, `limit?` | Query with pattern matching |
| `fact_explain` | `agent_id`, `fact_id`                                                                                         | Trace derivation chain      |

### 24.10 CBR Tools

| Tool           | Parameters                                                                                | Description                 |
| -------------- | ----------------------------------------------------------------------------------------- | --------------------------- |
| `cbr_retrieve` | `agent_id`, `beliefs: string[]`, `desires: string[]`, `max_results?`, `include_negative?` | Retrieve similar past cases |
| `cbr_store`    | `agent_id`, `case_id`, `situation`, `solution`, `outcome`                                 | Store a case                |

---

## 25. Shared Type Definitions

Source: `reasoning/types.ts`

### 25.1 ReasoningResult

```typescript
interface ReasoningResult {
  method: string; // Method key, e.g., "bayesian"
  category: string; // Category, e.g., "probabilistic"
  conclusion: string; // The reasoning conclusion text
  confidence: number; // 0.0-1.0
  reasoning_trace: string; // Step-by-step reasoning trace
  metadata?: Record<string, unknown>;
}
```

### 25.2 ProblemClassification

```typescript
interface ProblemClassification {
  uncertainty: "low" | "medium" | "high";
  complexity: "simple" | "moderate" | "complex";
  domain: "formal" | "empirical" | "social" | "mixed";
  time_pressure: "none" | "moderate" | "urgent";
  data_availability: "rich" | "moderate" | "sparse";
  stakes: "low" | "medium" | "high";
}
```

### 25.3 MethodRecommendation

```typescript
interface MethodRecommendation {
  method: string; // Method key
  score: number; // 0.0-1.0 suitability score
  rationale: string; // Human-readable justification
}
```

### 25.4 FusionResult

```typescript
interface FusionResult {
  methods_used: string[];
  individual_results: ReasoningResult[];
  synthesized_conclusion: string;
  agreement_score: number; // 0.0-1.0
  disagreements: string[];
  confidence: number; // Mean of individual confidences
}
```

### 25.5 ReasoningMethodEntry

```typescript
interface ReasoningMethodEntry {
  category: string; // "formal", "probabilistic", etc.
  description: string; // Human-readable description
  prompt: string; // LLM prompt template
  applicable_when: string; // Conditions for applicability
  algorithmic: boolean; // Has dedicated algorithm?
  dedicated_tool?: string; // Tool name, e.g., "reason_bayesian"
}
```

---

## 26. References to Companion Documents

This document covers the reasoning and inference subsystem. For related subsystems, refer to:

| Document                                | Coverage                                                               |
| --------------------------------------- | ---------------------------------------------------------------------- |
| `openclaw-mabos-system-architecture.md` | Overall system architecture, deployment, extension model               |
| `bdi-sbvr-framework.md`                 | BDI cognitive cycle, SBVR business vocabulary, agent lifecycle         |
| `sbvr-ontology-system.md`               | SBVR ontology, TypeDB schema generation, vocabulary management         |
| `multi-agent-coordination.md`           | Multi-agent communication, task delegation, coordination protocols     |
| `rlm-memory-enhancements.md`            | Memory system (short-term, long-term, episodic), consolidation, recall |

### Source Files Quick Reference

| Path                                                          | Content                             |
| ------------------------------------------------------------- | ----------------------------------- |
| `extensions/mabos/src/reasoning/methods.ts`                   | Complete 35-method catalog          |
| `extensions/mabos/src/reasoning/types.ts`                     | Shared type definitions             |
| `extensions/mabos/src/reasoning/fusion.ts`                    | Multi-method fusion engine          |
| `extensions/mabos/src/reasoning/meta/meta-reasoning.ts`       | Meta-reasoning and selection matrix |
| `extensions/mabos/src/reasoning/formal/constraint.ts`         | CSP solver                          |
| `extensions/mabos/src/reasoning/probabilistic/bayesian.ts`    | Bayesian updater                    |
| `extensions/mabos/src/reasoning/probabilistic/fuzzy.ts`       | Mamdani fuzzy inference             |
| `extensions/mabos/src/reasoning/probabilistic/statistical.ts` | Statistical analysis                |
| `extensions/mabos/src/reasoning/causal/temporal.ts`           | Temporal reasoning                  |
| `extensions/mabos/src/reasoning/social/trust.ts`              | Trust scoring                       |
| `extensions/mabos/src/reasoning/social/game-theory.ts`        | Game-theoretic analysis             |
| `extensions/mabos/src/reasoning/social/ethical.ts`            | Ethical reasoning                   |
| `extensions/mabos/src/reasoning/social/dialectical.ts`        | Dialectical reasoning               |
| `extensions/mabos/src/reasoning/experience/analogical.ts`     | Analogical reasoning                |
| `extensions/mabos/src/reasoning/formal/deductive.ts`          | Deductive reasoning                 |
| `extensions/mabos/src/reasoning/formal/inductive.ts`          | Inductive reasoning                 |
| `extensions/mabos/src/reasoning/formal/abductive.ts`          | Abductive reasoning                 |
| `extensions/mabos/src/reasoning/formal/modal.ts`              | Modal reasoning                     |
| `extensions/mabos/src/reasoning/formal/deontic.ts`            | Deontic reasoning                   |
| `extensions/mabos/src/reasoning/causal/causal.ts`             | Causal analysis                     |
| `extensions/mabos/src/reasoning/causal/counterfactual.ts`     | Counterfactual analysis             |
| `extensions/mabos/src/reasoning/causal/scenario.ts`           | Scenario planning                   |
| `extensions/mabos/src/tools/reasoning-tools.ts`               | Reasoning router                    |
| `extensions/mabos/src/tools/inference-tools.ts`               | Inference engine                    |
| `extensions/mabos/src/tools/rule-engine.ts`                   | Rule engine                         |
| `extensions/mabos/src/tools/fact-store.ts`                    | Fact store                          |
| `extensions/mabos/src/tools/cbr-tools.ts`                     | CBR-BDI module                      |
| `extensions/mabos/src/knowledge/typedb-queries.ts`            | TypeDB query builders               |

---

_End of document._
