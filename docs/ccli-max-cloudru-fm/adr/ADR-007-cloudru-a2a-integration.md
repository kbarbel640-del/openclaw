# ADR-007: Cloud.ru AI Agents A2A Integration

## Status: PROPOSED

## Date: 2026-02-16

## Bounded Context: Agent Orchestration

## Context

Cloud.ru provides an AI Agents service with proprietary Agent-to-Agent (A2A) coordination technology. Their platform supports combining up to 5 AI agents into a single system with a visual editor for managing agent workflows.

OpenClaw already integrates with Cloud.ru Foundation Models (FM) via a local proxy (ADR-001) and has a native MAX Messenger channel extension (ADR-006). The next logical step is agent-level integration with Cloud.ru's AI Agents platform.

### Cloud.ru A2A vs Standard A2A Protocol

| Aspect                 | Cloud.ru A2A                   | Google/LF A2A                                |
| ---------------------- | ------------------------------ | -------------------------------------------- |
| Protocol               | Proprietary, platform-specific | Open standard (Agent Cards, Tasks, Messages) |
| External agent support | REST API only (no native A2A)  | Full peer-to-peer via Agent Cards            |
| Agent discovery        | Cloud.ru platform UI only      | Agent Card JSON at `/.well-known/agent.json` |
| Max agents per system  | 5                              | Unlimited                                    |
| Open source            | No                             | Yes (Apache 2.0)                             |

### Key Finding

Cloud.ru's A2A implementation is **not compatible** with the standard Google/Linux Foundation A2A protocol. External agents (including OpenClaw) can only participate in Cloud.ru agent systems via their REST API — not via native A2A coordination.

However, Cloud.ru's open-source team (`cloud-ru-tech`) has published an **A2A Router MCP Server** built on Google's Agent Development Kit (ADK) that bridges standard A2A with MCP:

- Discovery: automatic agent discovery via Agent Cards
- Routing: routing requests to the appropriate agent
- Load Balancing: distributing load across agents
- Error Handling: error handling and fallback strategies

## Decision

**Defer implementation** until Cloud.ru publishes stable external agent APIs or the A2A Router MCP Server matures.

### Integration Options (ranked by feasibility)

1. **MCP Server Bridge** (recommended first step)
   - Connect Cloud.ru Managed RAG as an MCP tool server in Claude Code's tool chain
   - Use for knowledge base access (document search, FAQ retrieval)
   - Low integration complexity, high immediate value

2. **A2A Router MCP Server**
   - Use `cloud-ru-tech`'s A2A Router MCP Server to bridge OpenClaw sessions to Cloud.ru agents
   - Requires: Agent Card endpoint in OpenClaw, task management protocol support
   - Medium complexity, enables bidirectional agent communication

3. **Direct REST API Integration**
   - Call Cloud.ru AI Agent endpoints directly from OpenClaw
   - Limited to Cloud.ru's proprietary API surface
   - Lowest flexibility, tightest coupling

### OpenClaw's Existing A2A

OpenClaw already has native agent-to-agent communication (`sessions_send` tool) with:

- Ping-pong message exchange between sessions (up to 5 turns)
- Cross-channel delivery (A2A result → user's original channel)
- Configurable announce summaries
- Skip tokens for early termination

The Cloud.ru integration should complement — not replace — this mechanism.

## Consequences

### Positive

- No premature coupling to an unstable proprietary API
- Time for Cloud.ru's A2A Router MCP Server to mature
- Can validate the MCP bridge approach with Managed RAG first
- OpenClaw's native A2A continues to serve inter-session communication

### Negative

- No Cloud.ru agent orchestration in v1
- Users needing Cloud.ru agent coordination must use Cloud.ru's own UI

### Risks

- Cloud.ru may change their agent API without notice (proprietary, no SLA for external consumers)
- A2A Router MCP Server is early-stage open source (may be abandoned)

## Related

- [ADR-001: Cloud.ru FM Proxy Integration](/docs/ccli-max-cloudru-fm/adr/ADR-001-cloudru-fm-proxy-integration)
- [ADR-003: Claude Code Agentic Engine](/docs/ccli-max-cloudru-fm/adr/ADR-003-claude-code-agentic-engine)
- [ADR-006: MAX Messenger Extension](/docs/ccli-max-cloudru-fm/adr/ADR-006-max-messenger-extension)
- [Cloud.ru AI Fabric Research](/docs/ccli-max-cloudru-fm/cloud-ru-ai-fabric-research)
- [Cloud.ru AI Agents Integration Research](/docs/ccli-max-cloudru-fm/research/cloudru-ai-agents-integration)
