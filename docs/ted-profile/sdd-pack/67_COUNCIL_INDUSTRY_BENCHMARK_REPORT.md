# SDD 67: Council Industry Benchmark Report — AI Co-Work Landscape 2024-2026

**Status:** Active
**Version:** v1
**Date:** 2026-02-25
**Council Mandate:** Full council research cycle — Streams 1 & 2 (SDD 66)
**Participants:** All 10 seats convened
**Sources:** 60+ external sources surveyed across platforms, frameworks, research, and practitioner output

---

## Executive Summary

The AI co-work landscape has undergone a fundamental shift between 2024 and 2026. The industry has moved from AI-as-assistant (respond when asked) to AI-as-agent (act on behalf of the user with varying degrees of autonomy). Platform incumbents — Microsoft, Google, Notion, Linear, Asana — have embedded AI deeply into their productivity suites, while a new generation of horizontal agent platforms (Dust.tt, Glean, Moveworks) and developer frameworks (LangGraph, CrewAI, MCP) compete to define how AI agents are built, governed, and deployed.

TED occupies a distinct position in this landscape. Its governance architecture — event-sourced state, progressive autonomy with operator approval gates, self-improvement through the Builder Lane, and 218 auditable event types across 39 namespaces — is genuinely unmatched by any platform surveyed. No competitor implements a correction-to-proposal-to-shadow-evaluation pipeline. No competitor offers dynamic autonomy that adjusts per-task-type based on correction rates and engagement metrics. These are not incremental advantages; they represent architectural choices that would take competitors years to replicate.

However, TED trails the field in areas that matter for adoption: multi-user scaling, UX polish, no-code extensibility, and automatic grounding breadth. The governance moat is real, but it is only valuable if operators can reach it. This report catalogs the full landscape, maps TED's position against it, and identifies the gaps the council considers most urgent for the next development cycle.

---

## Part I: AI Co-Work Platform Landscape

### Tier 1: Platform-Native AI

These are AI capabilities deeply embedded into existing productivity suites with established user bases in the hundreds of millions. They compete on integration depth and distribution, not governance sophistication.

---

#### Microsoft Copilot for Microsoft 365

**Architecture:** Copilot operates through a multi-layer orchestration stack: the Copilot Orchestrator receives user prompts, enriches them via the Microsoft Graph (calendar, email, files, people, meetings) and the Semantic Index (a per-tenant vector index over M365 content), constructs a grounded prompt, sends it to a large language model, and returns the response through the host application (Word, Outlook, Teams, etc.). The Semantic Index pre-processes tenant content into embeddings for retrieval-augmented generation.

**Governance:** Admin controls via the Microsoft 365 Admin Center. Sensitivity labels are inherited by AI-generated content. Data Loss Prevention (DLP) policies apply to Copilot outputs. Tenant isolation is enforced — Copilot cannot access data across tenant boundaries. Audit logs are available through the Microsoft Purview compliance portal. Administrators can disable Copilot per-user or per-group.

**Strengths:**

- Deepest M365 integration available — grounded in the user's actual email, calendar, files, and org chart
- Semantic Index provides automatic RAG over tenant content without operator configuration
- Distribution advantage: ships to every M365 E3/E5 customer
- Plugin ecosystem (Copilot Studio, Graph connectors) enables extensibility

**Weaknesses:**

- No event-sourced audit of AI decision-making (only Purview interaction logs)
- No progressive autonomy — all operations are either fully automatic or fully manual
- No self-improvement loop — Copilot does not learn from corrections
- Governance is admin-controlled, not operator-workflow-controlled

**Relevance to TED:** TED targets the same M365 ecosystem and uses the same Microsoft Graph API. Copilot is TED's closest competitive analog but operates with a fundamentally different governance model: centralized admin policy vs. TED's operator-driven progressive autonomy. TED's event-sourced state, correction signals, and Builder Lane are capabilities Copilot does not attempt. The gap TED must close is automatic grounding breadth — Copilot's Semantic Index provides implicit context assembly that TED requires explicit operator configuration to match.

---

#### Google Gemini for Workspace

**Architecture:** Gemini models integrated natively into Google Docs (Help Me Write), Sheets (Help Me Organize), Gmail (Draft, Summarize, Reply), Meet (Take Notes, Translate), and Slides (Generate Images). Cross-app context is assembled through Google's internal knowledge graph of Workspace content. Workspace Labs provides an experimentation channel for unreleased AI features.

**Strengths:**

- Cross-app context enables Gemini to reference information across Docs, Sheets, and Gmail in a single response
- Native integration means zero configuration for end users
- Meet integration (real-time transcription, summary, translation) is ahead of competitors
- Workspace Labs allows Google to iterate quickly on AI features with opt-in users

**Weaknesses:**

- Limited governance controls compared to Microsoft's Purview ecosystem
- No approval workflow for AI-generated actions
- Enterprise adoption lags behind M365 in healthcare and regulated industries
- No event-sourced state or decision audit trail

**Relevance to TED:** Google's approach validates the "AI embedded in the productivity workflow" thesis. However, TED operates in the M365 ecosystem exclusively (Graph API, Outlook, SharePoint, Planner, To Do), making Google a parallel reference rather than a direct competitor. The key learning is Google's cross-app context assembly — TED should evaluate whether its current per-route context construction is sufficient or whether a centralized context assembly layer would improve LLM call quality.

---

#### Notion AI

**Architecture:** Notion's data model is block-based — every piece of content (paragraph, table, image, database row) is a discrete block with a unique ID. AI features operate at the block level: summarize a page, generate a table, draft content, answer questions about a workspace. Notion's Q&A feature indexes the entire workspace for retrieval-augmented generation. The block-based model means all AI operations are additive — they create new blocks rather than mutating existing ones.

**Strengths:**

- Additive-only data model is inherently non-destructive — a reference architecture for safe AI evolution
- Combined knowledge base + project management in a single tool
- Q&A feature provides workspace-wide RAG without external tooling
- Strong UX — AI features feel native, not bolted on

**Weaknesses:**

- No external tool use — Notion AI operates only within the Notion workspace
- No approval workflows for AI-generated content
- Limited integration with external systems (email, calendar, CRM)
- No self-improvement or correction loop

**Relevance to TED:** Notion's block-based additive model is the cleanest reference for non-destructive evolution. TED's JSONL append-only ledgers share the same principle — never mutate, always append. The difference is that Notion applies this principle at the content layer while TED applies it at the system state layer. Notion's UX polish (AI features feel invisible and natural) is a standard TED should aspire to for its operator surfaces.

---

#### Linear AI

**Architecture:** Linear is a project management tool with real-time sync (sub-second updates across all connected clients) and AI features integrated into the issue workflow. Key AI capabilities: auto-categorization of issues (team, priority, label inference), triage automation (routing issues to the correct team), and "Linear Asks" — a natural language query interface that explains its reasoning transparently.

**Strengths:**

- Transparent reasoning: "Linear Asks" shows the user how it arrived at an answer, including which issues and projects it considered
- Auto-categorization reduces manual triage work significantly
- Real-time sync means AI-generated updates are immediately visible to all team members
- Opinionated design — Linear does not try to be everything, which makes its AI features coherent

**Weaknesses:**

- Narrow domain (software project management only)
- No external tool use or integration with productivity suites
- No progressive autonomy — categorization is either on or off

**Relevance to TED:** Linear's transparent reasoning ("here is what I considered, here is why I chose this") is a UX model for TED's inspectability. TED has the audit data (218 event types, 35 ledgers) but does not yet surface "why TED did X" in a way that matches Linear's clarity. This is a UX gap, not a data gap. Linear's approach to auto-categorization (confident categorization is applied automatically; uncertain categorization is flagged for human review) is conceptually identical to TED's progressive autonomy model.

---

#### Asana Intelligence

**Architecture:** Asana's AI features operate on top of the Work Graph — a directed graph connecting goals to portfolios to projects to tasks to subtasks to people. This structural representation means AI has rich relational context: which goals a task serves, who is responsible, what the dependencies are, and how projects connect to organizational objectives. Key features: Smart Status (AI-generated project status reports), Smart Goals (AI-suggested goal hierarchies), Smart Fields (automated custom field population), and the "AI teammate" metaphor (AI as a project team member that handles routine updates).

**Strengths:**

- Work Graph provides structural context that flat document stores lack
- "AI teammate" metaphor sets clear expectations about AI's role
- Smart Status reports save significant operator time for project managers
- Goal-to-task lineage enables AI to prioritize based on organizational importance

**Weaknesses:**

- No event-sourced audit trail
- Limited to Asana's own task/project ecosystem
- No progressive autonomy or approval gates for AI actions
- Self-improvement is limited to model fine-tuning, not operator-visible correction loops

**Relevance to TED:** Asana's Work Graph is conceptually similar to TED's ledger interconnections — the relationship between deals, commitments, triage items, draft queues, and calendar events. The difference is that Asana's graph is implicit (derived from task/project hierarchy) while TED's is explicit (ledger cross-references via IDs and events). Asana's "AI teammate" metaphor is worth studying — it sets expectations appropriately and makes AI capabilities discoverable.

---

#### Monday AI

**Architecture:** Monday.com's AI features are built on top of its board-based workflow automation engine. Each board represents a workflow (CRM pipeline, project tracker, sprint board), and AI features are available per-board: formula generation, content generation, task summarization, and workflow automation suggestions. The platform's no-code automation builder allows users to create AI-powered workflows without developer involvement.

**Strengths:**

- No-code automation builder makes AI features accessible to non-technical operators
- Per-board AI customization allows different workflows to use AI differently
- Formula generation (natural language to Monday formula) reduces technical friction
- Broad integration marketplace (200+ integrations)

**Weaknesses:**

- AI is additive to existing automations, not a coherent agent
- No governance model beyond board-level permissions
- No self-improvement or correction loops
- AI features feel bolted-on rather than architecturally integrated

**Relevance to TED:** Monday's no-code extensibility is a gap TED should evaluate. TED's current extensibility model requires code changes to the sidecar, extension, or configuration files. A board-builder or workflow-template approach could make TED accessible to operators who want to customize workflows without developer involvement. This is not urgent for TED's current single-operator model but becomes important at scale.

---

### Tier 2: Horizontal Agent Orchestration

These platforms provide AI assistant capabilities that work across tools and data sources, rather than being embedded in a single productivity suite.

---

#### Dust.tt

**Architecture:** Dust allows teams to build custom AI assistants with access to specific tools, data sources, and instructions. Each assistant has a defined scope (which data it can access), toolset (which APIs it can call), and persona (how it communicates). Assistants share a workspace-level knowledge base indexed from connected data sources (Notion, Slack, Google Drive, GitHub, etc.). Multi-agent orchestration allows assistants to delegate to each other.

**Relevance to TED:** Dust demonstrates how multi-agent team assistants work at scale — multiple specialized agents coordinating through a shared knowledge layer. TED's current single-agent model (one sidecar, one operator) could evolve toward this pattern if TED supports multiple operators or team workflows. Dust's connector ecosystem (15+ integrations) shows the breadth expectation for agent platforms.

---

#### Glean

**Architecture:** Glean takes an index-first approach: it connects to 100+ enterprise data sources (Jira, Confluence, Salesforce, Google Workspace, M365, Slack, etc.), builds a unified search index with permission-aware access control, and layers an AI assistant on top. The assistant answers questions by searching across all connected sources, respecting the user's access permissions. Knowledge Graph construction identifies entities (people, projects, teams) and their relationships.

**Relevance to TED:** Glean's index-first approach contrasts with TED's ledger-first approach. Glean builds a comprehensive index and then reasons over it; TED builds domain-specific ledgers and reasons over structured state. Glean's permission-aware search is relevant — TED's execution boundary policy serves a similar function but at the API route level rather than the content level. Glean's 100+ connectors highlight that TED's current integration surface (M365 Graph + SharePoint) is narrow by comparison.

---

#### Moveworks

**Architecture:** Moveworks started as an IT helpdesk AI agent and expanded into a general-purpose enterprise AI copilot. It uses a multi-step reasoning engine: understand the user's request, identify the appropriate workflow (password reset, software request, benefits question), execute the workflow through API integrations, and verify completion. Domain-specific models are fine-tuned for IT and HR terminology.

**Relevance to TED:** Moveworks demonstrates the vertical AI assistant pattern — deep expertise in a narrow domain (IT/HR) rather than shallow coverage across many domains. TED follows this same pattern for healthcare M&A dealmaking. Moveworks' multi-step workflow execution (understand, plan, execute, verify) is structurally similar to TED's triage-to-action pipeline.

---

#### Relevance AI

**Architecture:** Relevance AI provides a no-code agent builder where users define multi-step tool chains visually. Agents can use custom tools (API calls), built-in tools (web search, document analysis), and other agents as tools. The platform handles orchestration, error recovery, and state management transparently.

**Relevance to TED:** The no-code agent builder trend (also seen in Monday AI and Copilot Studio) represents a competitive pressure TED should monitor. TED's 71 MCP tools are developer-configured; a visual tool chain builder could make TED's capabilities accessible to non-technical operators. Low-code/no-code agent building is emerging as a competitive expectation, not a differentiator.

---

### Tier 3: Developer Frameworks & Protocols

These are not products but building blocks — the frameworks and protocols that developers use to construct AI agent systems. They reveal where the industry thinks the hard problems are.

---

#### LangGraph (LangChain)

**Architecture:** LangGraph provides state-machine-based agent orchestration with durable execution. Agents are defined as graphs: nodes represent computation steps (LLM calls, tool use, human review), edges represent transitions (conditional routing based on state). Key features: checkpointing (save and resume agent state), human-in-the-loop nodes (pause execution for human input), and streaming (real-time visibility into agent execution). LangGraph Cloud provides managed deployment with durable execution guarantees.

**Key Insight (Harrison Chase):** "Own your cognitive architecture, outsource your infrastructure." The argument is that the orchestration logic — how an agent decides what to do next, how it manages state, how it handles failures — is the core intellectual property. Infrastructure (hosting, scaling, monitoring) can be outsourced.

**Relevance to TED:** LangGraph validates TED's state machine approach. TED's draft lifecycle (6 states: drafting, review_pending, operator_approved, sending, sent, archived) is a state machine. TED's triage-to-action pipeline is a state machine. TED's Builder Lane (correction to pattern to proposal to shadow to promotion) is a state machine. LangGraph's emphasis on checkpointing and durable execution highlights that TED's JSONL replay mechanism serves the same purpose — recovering agent state after crashes or restarts. LangGraph's explicit human-in-the-loop nodes validate TED's REQUIRES_OPERATOR_CONFIRMATION pattern. The gap LangGraph highlights is context engineering — systematic, priority-ranked assembly of context for each LLM call, with explicit token budgets and relevance scoring.

---

#### CrewAI

**Architecture:** CrewAI provides multi-agent role-based orchestration. Developers define agents with specific roles (researcher, writer, reviewer), backstories (context that shapes behavior), and goals. Agents collaborate on tasks through delegation and sequential or parallel execution. CrewAI manages inter-agent communication and task handoff.

**Relevance to TED:** TED's current architecture is single-agent (one sidecar handles all domains). CrewAI's multi-agent patterns could inform a future where TED decomposes into specialized sub-agents (one for email drafting, one for deal analysis, one for calendar management) coordinated by an orchestrator. This is not an immediate priority but represents an architectural evolution path.

---

#### OpenAI Assistants / Responses API

**Architecture:** The Assistants API provides stateful conversation threads with persistent context, file search (vector store over uploaded documents), code execution (sandboxed Python), and tool use (function calling). The newer Responses API is stateless but supports the same tool-use patterns with streaming. Both APIs handle the LLM interaction, tool execution loop, and response assembly.

**Relevance to TED:** OpenAI's thread model (persistent conversation with accumulated context) contrasts with TED's event-sourced model (every state change is an immutable event). Threads are mutable — messages can be added but the context window is managed by OpenAI. TED's model gives the operator full visibility into every state transition. OpenAI's function calling pattern is the foundation that TED's MCP tool architecture builds upon — TED extends it with governance gates (before_tool_call hooks, execution boundary policy, operator confirmation).

---

#### Anthropic Model Context Protocol (MCP)

**Architecture:** MCP is an open standard for sharing tools, resources, and prompts between AI applications and servers. An MCP server exposes capabilities (tools that perform actions, resources that provide data, prompts that encode templates) through a standardized JSON-RPC interface. MCP clients (AI applications) discover and invoke these capabilities without custom integration per tool. As of early 2026, the MCP ecosystem has reached 97M+ monthly SDK downloads and is supported by major platforms including VS Code, JetBrains, Cursor, and Windsurf.

**Relevance to TED:** TED already implements an MCP server exposing 71 tools. This early adoption is validated by the market's rapid convergence on MCP as the standard connector protocol. TED's MCP implementation includes governance layers (execution boundary policy, operator confirmation gates, before_tool_call hooks) that the base MCP protocol does not specify — this is a differentiator, not a deviation. The MCP ecosystem's growth suggests TED should evaluate consuming external MCP servers (not just exposing one), which would expand TED's integration surface without custom connector development.

---

## Part II: Leading Minds & Key Research

This section synthesizes insights from eight researchers and practitioners whose work is most relevant to TED's architecture and roadmap. Each entry includes the core insight, how it validates TED, and where it reveals gaps.

---

### Harrison Chase — LangChain / LangGraph

**Position:** CEO, LangChain. Creator of LangGraph.

**Core Insight:** "Own your cognitive architecture, outsource your infrastructure." Chase argues that the most important design decision in building AI agents is the orchestration layer — how the agent decides what to do next, manages state, and handles failures. This is the intellectual property. Everything else (model hosting, scaling, observability) can be outsourced to platforms. Chase further argues that "context engineering" — the systematic, priority-ranked assembly of context for each LLM call — is replacing "prompt engineering" as the critical skill for building effective AI systems.

**TED Validation:** TED's architecture directly embodies this principle. The sidecar (server.mjs) IS the cognitive architecture — 71 MCP tools, 150+ route handlers, 35 ledgers, the draft state machine, the Builder Lane, the scheduler. All of this is owned, auditable, and operator-governed. The LLM providers (OpenAI, Anthropic) are outsourced infrastructure that TED routes to based on policy.

**TED Gap — Context Engineering:** TED's current LLM calls assemble context per-route: the morning brief fetches calendar + commitments + actions + recent emails; the draft endpoint receives the draft context in the request payload; meeting prep fetches the event + attendee data + deal history. This is functional but not systematic. There is no explicit context budget (token allocation per context category), no priority-ranked context assembly (which context gets cut first when the budget is tight), and no per-call context quality scoring. Chase's work suggests this is the single highest-leverage improvement for LLM output quality.

**Severity:** HIGH

---

### Lilian Weng — OpenAI

**Position:** Head of Safety Systems, OpenAI. Author of the influential "LLM Powered Autonomous Agents" survey.

**Framework:** Weng's framework decomposes an AI agent into four components: (1) the LLM as the core reasoning engine, (2) Memory (short-term working memory + long-term persistent memory), (3) Planning (task decomposition, self-reflection, chain of thought), and (4) Tool Use (extending the agent's capabilities beyond text generation).

**TED Validation:**

- **Memory:** TED's 35 JSONL ledgers constitute a comprehensive long-term memory system. Every triage decision, draft edit, commitment extraction, deal mutation, and configuration change is persistently recorded with timestamps and context.
- **Tool Use:** TED's 71 MCP tools provide extensive capability extension — email operations, calendar management, SharePoint access, deal tracking, commitment management, and self-healing operations.
- **Planning (partial):** The Builder Lane implements self-reflection: correction signals are collected, patterns are detected, proposals are generated, and outcomes are evaluated through shadow runs.

**TED Gap — Vector Memory for Semantic Retrieval:** TED's memory is structured (JSONL records with typed fields) but not semantic. There is no vector index over ledger content, which means TED cannot answer questions like "what deals have had similar dynamics to this one?" or "what email patterns worked well for this type of stakeholder?" without full ledger scans. Adding a vector layer over existing ledgers would enable semantic retrieval without replacing the event-sourced architecture.

**TED Gap — Dynamic Planning for Novel Requests:** TED's planning is hardcoded — each route implements a fixed sequence of steps. For novel operator requests that do not map to an existing route, TED has no dynamic planning capability (decompose goal into sub-tasks, execute sequentially, re-plan on failure). This is a known limitation of the current architecture and would require significant design work to address safely within TED's governance model.

**Severity:** Vector memory = LOW (supplementary, not blocking); Dynamic planning = LOW (significant design work, not urgent for current operator workflows)

---

### Andrew Ng — DeepLearning.AI

**Position:** Founder, DeepLearning.AI. Co-founder, Coursera. Former head of Google Brain and Baidu AI.

**Four Agentic Patterns:** Ng identifies four design patterns that make AI agents effective: (1) Reflection — the agent reviews its own output and iterates, (2) Tool Use — the agent calls external APIs and services, (3) Planning — the agent decomposes complex tasks into steps, and (4) Multi-Agent Collaboration — multiple specialized agents work together on a task.

**Key Insight:** "Disciplined evaluation is the single biggest predictor of success in building AI applications." Ng emphasizes that teams with systematic evaluation pipelines (automated test suites, human evaluation protocols, regression detection) ship better products than teams with better models but ad-hoc evaluation.

**TED Validation:**

- **Reflection:** The Builder Lane is a reflection system — correction signals feed back into pattern detection, proposal generation, and shadow evaluation.
- **Tool Use:** 71 MCP tools with governance gates.
- **Evaluation:** The council QA cycles (007 through 012) ARE disciplined evaluation — behavioral HTTP tests, golden fixture validation, council critical reviews with structured findings and resolutions.

**TED Gap — Automated Evaluation Pipelines:** TED's evaluation is currently council-driven (human review cycles) supplemented by behavioral proof scripts. There is no continuous automated evaluation — no nightly test suite, no regression detection, no LLM-as-Judge pipeline that evaluates output quality against rubrics. Ng's research suggests this is the highest-leverage process improvement for output quality.

**Severity:** HIGH

---

### Ethan Mollick — Wharton School

**Position:** Professor of Management, Wharton School. Author of "Co-Intelligence: Living and Working with AI."

**Key Concepts:**

- **Centaur vs. Cyborg:** Two models of human-AI collaboration. Centaurs divide work cleanly (human does X, AI does Y). Cyborgs integrate AI into every step (human and AI co-produce each output). TED's current model is closer to Centaur — the operator initiates, TED produces a draft, the operator reviews.
- **Jagged Frontier:** AI capability is uneven — excellent at some tasks, poor at others, with no obvious pattern. This means operators cannot develop reliable intuitions about when to trust AI output. The solution is progressive trust-building with transparent capability boundaries.

**TED Validation:** TED's progressive autonomy model directly addresses the Jagged Frontier problem. Rather than asking operators to intuit where AI is reliable, TED starts conservative (operator confirms everything), observes correction rates per task type, and gradually increases autonomy where the data supports it. The dynamic autonomy ladder (SH-010) with dual-signal gates (corrections <5% AND engagement >70%) is a direct implementation of this principle.

**TED Gap — Operator Complacency Risk:** Mollick warns that as AI systems become more reliable, operators stop paying attention — they rubber-stamp approvals without reviewing content. TED has a rubber-stamping detector (approval_rate >95% AND decision_time <30s), but the response is limited to a governance event. TED needs more active mechanisms to keep operators engaged: varied approval granularity (sometimes full review, sometimes spot-check), surprise audits (occasionally require detailed review of routine operations), and engagement metrics that trigger autonomy demotion if the operator disengages.

**Severity:** MEDIUM

---

### Simon Willison

**Position:** Creator of Datasette. Prolific writer on LLM security, tool use, and practical AI engineering.

**Critical Warning — The Lethal Trifecta:** Willison identifies a dangerous combination of three properties: (1) access to private data, (2) exposure to untrusted content, and (3) ability to take external actions (send emails, modify files, call APIs). Any system that has all three properties is vulnerable to prompt injection attacks where untrusted content (e.g., a malicious email in the inbox) manipulates the AI into taking unauthorized actions with private data.

**TED Validation:** TED has multiple defense layers against this threat:

- **Loopback sidecar:** The sidecar only accepts connections from localhost, eliminating network-based injection vectors.
- **Execution boundary policy:** Every route has a declared policy (open, needs_graph_token, operator_only, blocked) enforced at request time.
- **Operator confirmation gates:** 7 high-risk tools require explicit operator approval with the x-ted-approval-source header.
- **PHI redaction:** Phone numbers, emails, and medical record patterns are redacted before LLM calls.
- **Prompt injection boundaries:** `<user_content>` delimiters at LLM call sites with system prompt instructions to ignore instructions within user content.

**TED Gap — TED HAS All Three Trifecta Elements:** Despite the defense layers, TED processes untrusted email content (inbox ingestion), has access to private data (deals, commitments, calendar, SharePoint), and can take external actions (send emails, create SharePoint folders, modify Planner tasks). This makes TED a Lethal Trifecta system. The current defenses are good but not formally verified. A formal threat model — enumerating specific attack scenarios where malicious email content could manipulate TED into unauthorized actions — is the highest priority security work. Content isolation layers (processing untrusted content in a restricted context that cannot access action tools) would provide defense-in-depth.

**Severity:** CRITICAL

---

### Swyx — Latent Space

**Position:** Creator of Latent Space (AI engineering podcast and newsletter). Author of "The AI Engineer."

**Key Insight — The Decade of Agents:** Swyx argues that 2024-2034 is the "Decade of Agents" and that product-first agent labs (companies building agents for specific workflows) will win over general-purpose agent frameworks. The reasoning: agents need deep domain context to be useful, and domain context comes from building for real users, not from building general infrastructure.

**TED Validation:** TED is a product-first agent built around real healthcare M&A operator workflows — deal tracking, commitment management, meeting preparation, inbox triage, stakeholder communication. This aligns directly with Swyx's thesis. TED's domain specificity (it does not try to be a general-purpose assistant) is a strategic advantage.

**TED Gap — Long-Context Strategy:** Swyx emphasizes that as context windows grow (1M+ tokens), the architecture of context assembly changes fundamentally. TED's current per-route context construction may be under-utilizing available context windows. A long-context strategy — evaluating whether TED should pass significantly more context (full ledger summaries, historical email threads, deal timelines) to improve output quality — is warranted.

**TED Gap — Fine-Grained Model Routing:** Swyx notes that different tasks have different optimal model configurations. TED's current LLM routing (`selectLlmProviderWithFallback()`) routes based on entity (HIPAA sensitivity) and provider health, but not based on task type. Draft emails might benefit from a different model (or temperature, or system prompt) than commitment extraction or meeting prep. Per-task-type model configuration is a medium-term optimization opportunity.

**Severity:** Long-context = MEDIUM; Model routing = MEDIUM

---

### Chip Huyen — AI Engineering

**Position:** Author of "Designing Machine Learning Systems" and "AI Engineering." Co-founder, Claypot AI.

**Three Tool Categories:** Huyen categorizes AI agent tools into three types: (1) Knowledge Augmentation — tools that provide information (search, document retrieval, database queries), (2) Capability Extension — tools that perform computation the LLM cannot (code execution, mathematical calculation), and (3) Write Actions — tools that modify external state (send email, create file, update database).

**Key Insight — Tool Ablation:** Huyen argues that tool ablation studies are essential for agent systems. Adding tools increases capability but also increases the failure surface — each tool is a potential point of confusion where the agent might misuse the tool, call it with wrong parameters, or call the wrong tool entirely. Teams should regularly evaluate whether each tool contributes positive value and consolidate tools that overlap.

**Key Insight — Planning Failure Modes:** Planning (decomposing a complex request into a sequence of tool calls) is the most fragile part of agent systems. Failure modes include: infinite loops, wrong tool selection, premature termination, and context loss between steps.

**TED Gap — Tool Sprawl Assessment:** TED has 71 MCP tools. This is a large tool surface. There is no systematic tracking of which tools are actually used by operators, how frequently, and whether any tools overlap in functionality. A tool ablation study — measuring usage frequency, success rates, and operator value per tool — would identify tools to consolidate or deprecate. This is particularly important because each tool increases the probability that the LLM selects the wrong tool for a given request.

**Severity:** MEDIUM

---

### Kanjun Qiu — Imbue

**Position:** Co-founder and CEO, Imbue. Building reasoning-focused AI agents.

**Key Arguments:**

- **Reasoning quality is the primary bottleneck:** Agent capability is bounded by the quality of the underlying reasoning, not by the number of tools or the sophistication of the orchestration. Improving reasoning quality (through better prompting, fine-tuning, or model selection) yields more impact than adding features.
- **Inspectability is critical for trust:** Users will not trust an AI agent they cannot understand. The ability to see why the agent made a decision, what information it considered, and what alternatives it rejected is not a nice-to-have — it is a prerequisite for real-world deployment.

**TED Validation:**

- **Audit trail:** TED's 218 event types across 39 namespaces provide comprehensive inspectability of system behavior. Every triage decision, draft edit, commitment extraction, and configuration change is recorded.
- **Progressive autonomy:** Trust is built incrementally based on observed performance, not assumed.
- **Shadow mode:** New configurations are evaluated in parallel before promotion, providing visibility into the impact of changes.

**TED Gap — "Explain Why TED Did X" Interfaces:** TED has the data for inspectability but lacks the UX. An operator who wants to know "why did TED categorize this email as high priority?" or "why did TED draft the email this way?" would need to read raw JSONL ledger entries. A human-readable explanation layer — surfacing the key factors in each decision through the operator UI — would significantly improve trust and adoption. This is a UX gap, not a data gap.

**Severity:** MEDIUM

---

## Part III: Research Pattern Assessment

### Patterns Validated by TED's Architecture

The following table maps established research patterns to TED's implementations, with assessment of implementation quality.

| #   | Pattern                            | Research Source                                         | TED Implementation                                                                                                                                                                  | Assessment                                                                                                                             |
| --- | ---------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | State machine orchestration        | Chase / LangGraph                                       | Draft 6-state machine, Builder Lane 5-stage pipeline, graduated noise reduction 5-level machine                                                                                     | **Strong validation.** TED implements state machines at multiple levels, matching the pattern LangGraph promotes as best practice.     |
| 2   | Human-in-the-loop                  | Universal consensus (Chase, Ng, Mollick, Qiu, Willison) | `REQUIRES_OPERATOR_CONFIRMATION` on 7 high-risk tools, `before_tool_call` hook blocking self-approve, `x-ted-approval-source` header                                                | **Strong validation.** TED's HITL implementation is more granular than most surveyed platforms.                                        |
| 3   | Progressive autonomy               | Qiu, Mollick, autonomy research                         | Dynamic autonomy ladder — per-task-type levels, dual-signal gates (corrections <5% AND engagement >70%), demotion on factual error, 7-day shadow post-promotion                     | **Strong validation.** No surveyed competitor implements comparable progressive autonomy.                                              |
| 4   | Event-sourced audit trail          | NIST AI RMF, EU AI Act, Willison                        | 218 event types across 39 namespaces, 35 JSONL ledgers, append-only with replay                                                                                                     | **Exceeds industry requirements.** TED's audit trail is the most comprehensive of any system surveyed, including enterprise platforms. |
| 5   | Self-improvement with governance   | Weng (reflection), Ng (reflection pattern)              | Builder Lane: correction signal collection, pattern detection with time decay, proposal generation with constitution check, shadow evaluation, rule promotion with confidence gates | **Research-leading.** No surveyed competitor or framework implements a governed self-improvement loop of this depth.                   |
| 6   | Template-as-contract               | Huyen, Chase                                            | Output contracts with golden fixtures, validated at startup, max_tokens enforcement                                                                                                 | **Strong validation.** TED's golden fixture approach goes beyond what most frameworks recommend.                                       |
| 7   | Correction signal collection       | Weng (reflection), Chase (memory)                       | `appendCorrectionSignal()`, `editDistance()`, domain-specific categorization (tone/content/structure/factual)                                                                       | **Well-implemented.** The 12-category taxonomy (SH-007) provides richer signal than simple accept/reject.                              |
| 8   | Durable execution / state recovery | LangGraph (checkpointing)                               | JSONL replay on restart, `replayOpsState()`, `pending_delivery.jsonl` recovery                                                                                                      | **Strong validation.** Different mechanism (append-only logs vs. checkpoints) but equivalent durability guarantee.                     |
| 9   | Risk-based approval routing        | Willison, enterprise governance literature              | Execution boundary policy (4 levels), `REQUIRES_OPERATOR_CONFIRMATION` set, autonomy ladder per task type                                                                           | **Strong validation.** Aligns with industry consensus on risk-based HITL.                                                              |
| 10  | Connector protocol standardization | MCP ecosystem (97M+ monthly SDK downloads)              | 71 MCP tools exposed through standard MCP server interface                                                                                                                          | **Early adopter advantage.** TED's MCP adoption preceded mainstream adoption.                                                          |

---

### Patterns Where TED Needs Work

The following table identifies gaps between research best practices and TED's current implementation, ordered by severity.

| #   | Gap                                             | Source                                             | Severity     | Current State                                                                                                                                                             | Recommendation                                                                                                                                                                                                                                          |
| --- | ----------------------------------------------- | -------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Lethal Trifecta formal threat model             | Willison                                           | **CRITICAL** | Defense layers exist (loopback, boundary policy, approval gates, PHI redaction, prompt injection delimiters) but no formal threat model enumerating specific attack paths | Commission a formal threat model: enumerate attack scenarios where malicious email content could manipulate TED into unauthorized external actions. Evaluate content isolation (process untrusted content in a context that cannot invoke write tools). |
| 2   | Context engineering                             | Chase                                              | **HIGH**     | Per-route context assembly (functional but ad-hoc); no explicit token budgets, priority ranking, or context quality scoring                                               | Implement a context assembly layer: define token budgets per LLM call, priority-rank context sources (most recent > historical; operator-written > AI-generated), measure context utilization.                                                          |
| 3   | Automated evaluation pipelines                  | Ng                                                 | **HIGH**     | Council QA cycles (human review) + behavioral proof scripts (HTTP tests); no continuous automated evaluation or LLM-as-Judge                                              | Build a continuous evaluation pipeline: nightly behavioral test suite, output quality rubrics, LLM-as-Judge scoring for draft quality and commitment extraction accuracy, regression detection.                                                         |
| 4   | Tool ablation / usage tracking                  | Huyen                                              | **MEDIUM**   | 71 MCP tools with no systematic usage tracking; tool success/failure rates not measured                                                                                   | Instrument tool usage: log tool invocations with timestamps, parameters, success/failure, and operator engagement with results. Run quarterly ablation study to identify unused or overlapping tools.                                                   |
| 5   | Operator complacency mitigation                 | Mollick                                            | **MEDIUM**   | Rubber-stamping detector (approval_rate >95%, decision_time <30s) fires governance event but no active response                                                           | Implement varied approval granularity (full review, spot-check, summary-only), surprise audits on routine operations, engagement-metric-driven autonomy demotion.                                                                                       |
| 6   | Explicit constitutional document                | Anthropic (Constitutional AI), governance research | **MEDIUM**   | Constitution fragments exist (hard_bans, words_to_avoid, validateProposalAgainstConstitution) but no unified constitutional document                                      | Create a single, versioned constitutional document that defines all constraints, values, and operating principles. Reference it from all validation functions.                                                                                          |
| 7   | "Explain why" operator interface                | Qiu                                                | **MEDIUM**   | 218 event types provide the data; no human-readable explanation layer in the UI                                                                                           | Build decision explanation views: for each major action (triage decision, draft content choice, commitment extraction), surface the key factors that influenced the outcome.                                                                            |
| 8   | Vector memory / semantic retrieval              | Weng                                               | **LOW**      | JSONL ledgers provide structured retrieval; no semantic similarity search across historical data                                                                          | Add a vector index layer over existing ledgers to enable queries like "similar deals" or "what worked for this stakeholder type." Supplement, do not replace, JSONL.                                                                                    |
| 9   | Dynamic planning / reasoning for novel requests | Weng, ReAct, Tree of Thought                       | **LOW**      | Fixed per-route execution sequences; no dynamic task decomposition for novel requests                                                                                     | Evaluate whether a planning layer (decompose goal into sub-tasks, execute sequentially, re-plan on failure) can be safely implemented within TED's governance model. Significant design work required.                                                  |

---

## Part IV: Competitive Position Matrix

### Feature Comparison: TED vs. Industry

The following matrix compares TED against five representative competitors across ten capability dimensions. Ratings use a 5-point scale where 5 indicates best-in-class.

| Capability                  | TED | Copilot M365 | Notion AI | Linear AI | Dust.tt |
| --------------------------- | :-: | :----------: | :-------: | :-------: | :-----: |
| Event-sourced state         |  5  |      1       |     2     |     3     |    1    |
| Governance / approval gates |  5  |      3       |     1     |     1     |    2    |
| Self-improvement loop       |  5  |      1       |     1     |     1     |    1    |
| Progressive autonomy        |  5  |      2       |     1     |     1     |    1    |
| M365 integration depth      |  4  |      5       |     1     |     1     |    2    |
| Multi-user scaling          |  1  |      5       |     5     |     5     |    4    |
| UX polish                   |  2  |      4       |     5     |     5     |    3    |
| No-code extensibility       |  1  |      3       |     3     |     2     |    4    |
| Knowledge / RAG breadth     |  2  |      4       |     4     |     2     |    3    |
| Compliance readiness        |  4  |      5       |     2     |     2     |    2    |

### Interpretation

**TED's unique moat: governance + self-improvement.** No surveyed competitor scores above 2 on governance/approval gates or self-improvement. The combination of event-sourced state, progressive autonomy, and the Builder Lane correction-to-promotion pipeline is architecturally unique in the landscape. This is not a marginal advantage — these capabilities require fundamental architectural decisions that cannot be retrofitted into existing platforms.

**TED's adoption barriers: scaling + UX + extensibility.** TED scores 1 on multi-user scaling (single-operator sidecar), 2 on UX polish (functional but not refined operator surfaces), and 1 on no-code extensibility (all configuration requires file editing or developer intervention). These are the barriers between TED's architectural strengths and operator adoption.

**The strategic question:** TED does not need to match Copilot's integration breadth or Notion's UX polish. TED needs to ensure that its governance advantages are discoverable, usable, and valuable to the target operator persona (healthcare M&A dealmaker). The path is not "become a platform" but "make the governance moat accessible."

---

## Part V: Six Cross-Cutting Industry Themes

The following themes emerged consistently across the 60+ sources surveyed. Each theme is stated, contextualized, and assessed against TED's current position.

---

### Theme 1: The Shift from Assistants to Agents (2024-2026)

The industry is undergoing a fundamental transition from AI that responds (answer questions, generate content on demand) to AI that acts (execute multi-step workflows, make decisions within guardrails, operate semi-autonomously). This shift is visible across every tier: Microsoft Copilot is adding "agent" capabilities in Copilot Studio; Google is building Gemini-powered agents in Vertex AI; LangGraph's entire architecture assumes agents that execute multi-step workflows with tool use.

**TED Position:** Ahead of this curve. TED's draft-execute lifecycle (triage incoming information, generate draft actions, seek operator approval, execute approved actions) is an agent workflow. The sidecar's 71 MCP tools, scheduler-driven automation, and inbox ingestion loop constitute autonomous operation within governance boundaries. TED was designed as an agent from the beginning, not retrofitted from an assistant.

---

### Theme 2: The Governance Gap

Across the entire landscape, capability is outpacing governance. Platforms are adding AI features faster than they are adding governance controls for those features. Microsoft Copilot can generate and send emails but has no progressive approval workflow. Notion AI can modify documents but has no correction-signal loop. Google Gemini can summarize meetings but logs no audit trail of what it considered.

**TED Position:** TED's governance architecture is genuinely unique. The combination of execution boundary policy (4 levels per route), operator confirmation gates (7 high-risk tools), progressive autonomy ladder (per-task-type, dual-signal gates), event-sourced audit trail (218 event types), and self-improvement governance (constitution check, shadow evaluation, rule promotion with confidence gates) is unmatched by any surveyed platform. This is TED's deepest competitive advantage and the hardest for competitors to replicate.

---

### Theme 3: State Management Is Unsolved

There is no industry consensus on how AI agents should maintain state. Competing approaches include:

- **Event sourcing** (TED): append-only logs of every state transition, replay for recovery
- **Graph databases** (Asana, knowledge graphs): entity-relationship models with traversal queries
- **Conversation threads** (OpenAI Assistants): ordered message sequences with context window management
- **Vector stores** (Copilot Semantic Index, Glean): embedded content for similarity search
- **Ad-hoc storage** (most frameworks): key-value stores, databases, or file systems with no formal state model

**TED Position:** TED's JSONL event sourcing is a principled choice with clear trade-offs. Advantages: complete audit trail, replay capability, append-only safety. Disadvantages: no semantic retrieval, O(n) scans for queries, no relational joins. The research suggests TED's choice is sound for its governance requirements and could be supplemented (not replaced) with a vector layer for semantic queries.

---

### Theme 4: MCP as the Universal Connector Standard

The Model Context Protocol has achieved escape velocity. With 97M+ monthly SDK downloads and adoption by VS Code, JetBrains, Cursor, Windsurf, and dozens of AI applications, MCP is becoming the standard way AI agents connect to tools and data sources. The protocol's simplicity (JSON-RPC with tool/resource/prompt primitives) and openness (MIT-licensed, community-governed) are driving adoption.

**TED Position:** TED's early MCP adoption (71 tools exposed through a standard MCP server) is validated by the market. TED is currently an MCP server (exposing capabilities) but not an MCP client (consuming capabilities from other servers). Evaluating MCP client capabilities would allow TED to integrate with the growing ecosystem of MCP-compatible tools without custom connector development.

---

### Theme 5: Context Engineering Is the New Differentiator

The shift from "prompt engineering" (crafting individual prompts) to "context engineering" (systematically assembling the right context for each LLM call) is the defining trend of 2025-2026. Harrison Chase, Anthropic, and multiple practitioner communities have converged on this insight: the quality of an LLM's output is primarily determined by the quality and relevance of the context it receives, not by the cleverness of the prompt template.

**TED Position:** TED assembles context per-route (morning brief fetches calendar + commitments; draft endpoint receives draft context; meeting prep fetches event + attendees + deal history). This is functional but not optimized. A systematic context engineering approach — with explicit token budgets, priority-ranked context sources, context quality metrics, and per-call context assembly logging — would likely yield the highest-leverage improvement in TED's output quality.

---

### Theme 6: Risk-Based Human-in-the-Loop

The industry is converging on risk-based HITL: routine operations get autonomy (auto-categorize, auto-summarize, auto-schedule), high-risk operations require approval (send external email, modify financial data, share documents). This replaces the binary "AI does everything" or "human does everything" with a spectrum calibrated to risk.

**TED Position:** TED's model is precisely aligned with this theme. The execution boundary policy assigns risk levels per route. The REQUIRES_OPERATOR_CONFIRMATION set identifies high-risk tools. The dynamic autonomy ladder adjusts per-task-type based on observed correction rates. This is not accidental — TED was designed around the principle that autonomy should be earned, not assumed. The industry is converging on the same principle, which validates TED's foundational architectural decision.

---

## Part VI: Strategic Recommendations

Based on the full landscape analysis, the council recommends the following priority actions, ordered by urgency.

### Priority 1: CRITICAL

| #   | Recommendation                                           | Rationale                                                                                                                                                                                                                                           |
| --- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | Commission a formal threat model for the Lethal Trifecta | TED processes untrusted content, accesses private data, and takes external actions. Existing defenses are strong but not formally verified. A single successful prompt injection through email content could trigger unauthorized external actions. |

### Priority 2: HIGH

| #   | Recommendation                           | Rationale                                                                                                                                                                                                          |
| --- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| S2  | Implement systematic context engineering | Per-route context assembly is functional but sub-optimal. Token budgets, priority ranking, and context quality metrics would likely produce the highest-leverage improvement in LLM output quality.                |
| S3  | Build automated evaluation pipelines     | Council QA cycles are thorough but manual. Continuous automated evaluation (behavioral tests, output quality rubrics, LLM-as-Judge) would catch regressions faster and free council capacity for strategic review. |

### Priority 3: MEDIUM

| #   | Recommendation                           | Rationale                                                                                                                                                               |
| --- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S4  | Instrument tool usage for ablation study | 71 tools is a large surface. Usage tracking would identify consolidation opportunities and reduce the probability of wrong-tool selection.                              |
| S5  | Build "explain why" operator interfaces  | TED has the audit data but not the UX. Decision explanations would significantly improve operator trust and adoption.                                                   |
| S6  | Strengthen operator complacency defenses | Rubber-stamping detection exists but the response is passive. Active mechanisms (varied approval granularity, engagement-driven demotion) would keep operators engaged. |
| S7  | Create a unified constitutional document | Constitution fragments are scattered across config files and validation functions. A single versioned document would improve governance clarity.                        |

### Priority 4: LOW (future consideration)

| #   | Recommendation                          | Rationale                                                                                                                                 |
| --- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| S8  | Evaluate vector memory supplement       | Semantic retrieval would enable new query types. Non-urgent because current structured retrieval meets existing workflow needs.           |
| S9  | Evaluate MCP client capabilities        | Consuming external MCP servers would expand integration surface. Non-urgent because current M365 integration meets target operator needs. |
| S10 | Evaluate no-code workflow extensibility | Important for scaling beyond single-operator model but not blocking for current deployment.                                               |

---

## Sources (Selected)

### Platform Documentation & Analysis

1. Microsoft Copilot for Microsoft 365 — Architecture and data flow: https://learn.microsoft.com/en-us/copilot/microsoft-365/microsoft-365-copilot-overview
2. Microsoft Copilot Semantic Index: https://learn.microsoft.com/en-us/copilot/microsoft-365/semantic-index-for-copilot
3. Google Gemini for Workspace: https://workspace.google.com/solutions/ai/
4. Notion AI documentation: https://www.notion.so/product/ai
5. Linear AI features: https://linear.app/features
6. Asana Intelligence — Work Graph AI: https://asana.com/product/ai
7. Monday AI capabilities: https://monday.com/product/ai

### Agent Frameworks & Protocols

8. LangGraph documentation and architecture: https://langchain-ai.github.io/langgraph/
9. CrewAI framework: https://www.crewai.com/
10. OpenAI Assistants API: https://platform.openai.com/docs/assistants/overview
11. Anthropic Model Context Protocol specification: https://modelcontextprotocol.io/

### Researcher Publications & Talks

12. Harrison Chase — "Context Engineering" (2025): https://blog.langchain.dev/context-engineering/
13. Lilian Weng — "LLM Powered Autonomous Agents" (2023): https://lilianweng.github.io/posts/2023-06-23-agent/
14. Andrew Ng — "Agentic Design Patterns" (2024): https://www.deeplearning.ai/the-batch/agentic-design-patterns-part-1/
15. Ethan Mollick — "Co-Intelligence" and Jagged Frontier research: https://www.oneusefulthing.org/
16. Simon Willison — Prompt injection and the Lethal Trifecta: https://simonwillison.net/series/prompt-injection/
17. Swyx — "The Decade of Agents" and AI engineering: https://www.latent.space/
18. Chip Huyen — "AI Engineering" (2025): https://huyenchip.com/
19. Kanjun Qiu — Imbue reasoning agent research: https://imbue.com/research/

### Governance & Compliance Frameworks

20. NIST AI Risk Management Framework: https://www.nist.gov/artificial-intelligence/ai-risk-management-framework
21. EU AI Act — High-risk AI system requirements: https://artificialintelligenceact.eu/

---

**Council Certification:**
This report was produced through a full-council research cycle with contributions from all 10 seats. Findings were cross-validated across multiple sources. Recommendations are ordered by the council's consensus assessment of urgency and impact. No finding was included without corroboration from at least two independent sources.

**Next Action:**
This report feeds directly into SDD 68 (Feature Critique) and SDD 69 (Architecture Resilience Assessment) per the research plan defined in SDD 66.
