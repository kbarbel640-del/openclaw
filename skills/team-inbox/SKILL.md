---
name: team-inbox
description: "Team communication skill. Check your inbox, discover team members, and send direct messages to other agents."
metadata: { "openclaw": { "emoji": "📬", "always": true, "skillKey": "team-inbox" } }
user-invocable: true
---

# Skill: Team Inbox & Communication

Use `sessions_inbox`, `agents_list`, and `sessions_send` to communicate with your team.

## Check Your Inbox

Read messages from other agents before starting work.

```typescript
// Check messages for your agent (across all sessions)
sessions_inbox({ scope: "agent" });

// Check messages for current session only
sessions_inbox({ scope: "session" });
```

**Returns:**

```json
{
  "count": 2,
  "messages": [
    {
      "id": "msg-1",
      "from": "system-architect",
      "message": "Use REST for the API",
      "age": "5m ago"
    },
    {
      "id": "msg-2",
      "from": "testing-specialist",
      "message": "Auth tests passing",
      "age": "2m ago"
    }
  ]
}
```

### When to Check Inbox

| Timing                | Why                                               |
| --------------------- | ------------------------------------------------- |
| Start of task         | Pick up instructions or context from other agents |
| Before decisions      | Check if anyone has sent relevant input           |
| After completing work | Look for follow-up requests or feedback           |
| Before spawning       | Someone may have already addressed the need       |

## Discover Your Team

Find available agents and their capabilities before delegating.

```typescript
agents_list({});
```

**Returns:**

```json
{
  "requester": "orchestrator",
  "agents": [
    {
      "id": "backend-architect",
      "role": "architect",
      "capabilities": ["api-design", "middleware"]
    },
    {
      "id": "security-engineer",
      "role": "specialist",
      "capabilities": ["owasp", "threat-modeling"]
    }
  ]
}
```

### When to Discover

- **Before spawning** -- check who is available and what they can do
- **When unsure who to delegate to** -- find the right specialist
- **When building a team** -- understand composition before session.init

## Direct Messaging

Send messages to specific agents or sessions.

```typescript
// Send to a specific agent
sessions_send({
  agentId: "backend-architect",
  message: "The database schema is ready. You can start the API implementation.",
});

// Send to a session by key
sessions_send({
  sessionKey: "session-abc123",
  message: "Tests are all passing. Ready for review.",
});

// Send to a session by label
sessions_send({
  label: "API Design",
  message: "Updated the endpoint spec based on the debate decision.",
});

// Async send (don't wait for response)
sessions_send({
  agentId: "quality-engineer",
  message: "Coverage report is in the team workspace.",
  timeoutSeconds: 0,
});

// Sync send (wait up to 60s for response)
sessions_send({
  agentId: "database-engineer",
  message: "What's the primary key type for the orders table?",
  timeoutSeconds: 60,
});
```

## Communication Patterns

| Pattern          | Tool                           | Example                                        |
| ---------------- | ------------------------------ | ---------------------------------------------- |
| Broadcast update | sessions_send                  | Notify all relevant agents of a completed task |
| Direct question  | sessions_send (sync)           | Ask a specialist for quick input               |
| Status check     | sessions_inbox                 | Read pending messages before deciding          |
| Find specialist  | agents_list                    | Discover who handles auth before delegating    |
| Check for work   | sessions_inbox                 | Look for assigned tasks or requests            |
| Share output     | team_workspace + sessions_send | Write artifact, then notify the team           |

## Best Practices

1. **Always check inbox first** -- read sessions_inbox at the start of each task
2. **Use agents_list before spawning** -- don't guess agent IDs; verify they exist
3. **Send status updates** -- notify relevant agents when you complete work
4. **Use labels for targeting** -- sessions_send with label is easier than tracking session keys
5. **Async for notifications** -- use timeoutSeconds: 0 for fire-and-forget updates
6. **Sync for questions** -- use timeoutSeconds: 30-60 when you need an answer to proceed
7. **Share via workspace** -- write artifacts to team_workspace, then send a message pointing to them
