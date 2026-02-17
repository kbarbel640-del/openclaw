---
name: ask-agent
description: Send a message to a Cloud.ru AI Agent via A2A protocol and display the response. Use when a user wants to query a Cloud.ru AI Fabric agent, delegate a task to a remote agent, or interact with Cloud.ru AI Agents from Telegram or other channels.
---

# Ask Cloud.ru AI Agent

Send a message to a Cloud.ru AI Agent via the A2A (Agent-to-Agent) protocol.

## Prerequisites

- Cloud.ru AI Fabric must be configured (`aiFabric.enabled: true` in `openclaw.json`)
- IAM credentials must be available (`aiFabric.keyId` + `CLOUDRU_IAM_SECRET` env var)
- At least one agent must be configured in `aiFabric.agents[]`

## Usage

```
/ask-agent <agent-name-or-id> <message>
```

Examples:

- `/ask-agent code-reviewer Review this function for bugs`
- `/ask-agent data-analyst What are the top 5 sales trends?`
- `/ask-agent summarizer Summarize the latest project updates`

## Workflow

### 1. Resolve agent

Look up the agent from the `aiFabric.agents` config array by name or ID:

```typescript
import { readConfig } from "../config/config.js";

const config = await readConfig();
const agents = config.aiFabric?.agents ?? [];
```

If no agents are configured, tell the user to run onboarding:

> No Cloud.ru AI Agents configured. Run `openclaw onboard` and enable AI Fabric to add agents.

If multiple agents match, list them and ask the user to pick one.

### 2. Resolve IAM credentials

```typescript
const keyId = config.aiFabric?.keyId;
const secret = process.env.CLOUDRU_IAM_SECRET;

if (!keyId || !secret) {
  // Tell user to set CLOUDRU_IAM_SECRET in .env
}
```

### 3. Send message via A2A

```typescript
import { CloudruA2AClient } from "../src/ai-fabric/cloudru-a2a-client.js";

const client = new CloudruA2AClient({
  auth: { keyId, secret },
});

const result = await client.sendMessage({
  endpoint: agent.endpoint,
  message: userMessage,
});
```

### 4. Display response

Show the agent's response to the user. If the request failed, show a helpful error message.

Format the response with the agent name as a header:

```
**Agent: {agent.name}**

{result.text}
```

### 5. Error handling

- **IAM auth failure**: "Could not authenticate with Cloud.ru IAM. Check your keyId and CLOUDRU_IAM_SECRET."
- **Agent unreachable**: "Agent '{name}' is not responding at {endpoint}. It may be suspended or deleted."
- **Timeout**: "Agent '{name}' did not respond within 30 seconds. The agent may be starting up (cold start)."
- **No agents configured**: "No agents configured. Add agents to `aiFabric.agents` in openclaw.json or run onboarding."

## Agent configuration

Agents are stored in `openclaw.json`:

```json
{
  "aiFabric": {
    "enabled": true,
    "projectId": "proj-xxxx",
    "keyId": "key-xxxx",
    "agents": [
      {
        "id": "agent-123",
        "name": "code-reviewer",
        "endpoint": "https://ai-agents.api.cloud.ru/a2a/agent-123"
      }
    ]
  }
}
```
