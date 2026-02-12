---
name: collaborate
description: "Team collaboration skill. Use collaboration debates, polls, code reviews, and team_workspace artifacts to make decisions and share work."
metadata: { "openclaw": { "emoji": "🤝", "always": true, "skillKey": "collaborate" } }
user-invocable: true
---

# Skill: Team Collaboration

Use `collaboration` and `team_workspace` tools to debate decisions, share artifacts, review code, and coordinate team work.

## Tool Reference

| Action                   | Tool           | Use When                                                         |
| ------------------------ | -------------- | ---------------------------------------------------------------- |
| `session.init`           | collaboration  | Start a structured debate on an architectural or design decision |
| `session.create_focused` | collaboration  | Start a private session (not broadcast to team chat)             |
| `session.invite`         | collaboration  | Invite another agent mid-debate                                  |
| `proposal.publish`       | collaboration  | Submit a proposal with reasoning to a decision thread            |
| `proposal.challenge`     | collaboration  | Challenge an existing proposal with a counter-argument           |
| `proposal.agree`         | collaboration  | Agree with a proposal                                            |
| `decision.finalize`      | collaboration  | Moderator finalizes after min 3 debate rounds                    |
| `dispute.escalate`       | collaboration  | Escalate unresolved dispute to next superior in hierarchy        |
| `poll`                   | collaboration  | Quick team vote (yes/no or multi-choice)                         |
| `poll.vote`              | collaboration  | Cast vote in a poll                                              |
| `poll.get`               | collaboration  | Check poll results                                               |
| `submit_review`          | collaboration  | Submit work artifact for async code review                       |
| `review.submit`          | collaboration  | Submit review feedback (approve/reject)                          |
| `review.get`             | collaboration  | Read a review request                                            |
| `review.list`            | collaboration  | List all review requests                                         |
| `standup`                | collaboration  | Get aggregated status of all active agents                       |
| `write_artifact`         | team_workspace | Write output to shared team artifacts                            |
| `read_artifact`          | team_workspace | Read a shared artifact                                           |
| `list_artifacts`         | team_workspace | List all shared artifacts                                        |
| `set_context`            | team_workspace | Store a key-value pair in shared context                         |
| `get_context`            | team_workspace | Read from shared context                                         |
| `list_decisions`         | team_workspace | List all recorded team decisions                                 |
| `get_summary`            | team_workspace | Get formatted summary of team state                              |

## When to Use What

```
Need a decision?
|
+-- Simple preference (naming, style) --> poll
|   collaboration({ action: "poll", question: "...", options: [...], voters: [...] })
|
+-- Binary decision (go/no-go) --> poll (yes/no)
|   collaboration({ action: "poll", question: "...", options: ["yes", "no"], voters: [...] })
|
+-- Complex tradeoff (architecture, tech choice) --> debate session
|   collaboration({ action: "session.init", topic: "...", agents: [...] })
|
+-- Unresolvable disagreement --> escalate
    collaboration({ action: "dispute.escalate", sessionKey: "..." })
```

## Debate Flow

### 1. Start a Session

```typescript
collaboration({
  action: "session.init",
  topic: "REST vs GraphQL for the orders API",
  agents: ["backend-architect", "frontend-architect", "system-architect"],
  moderator: "system-architect",
});
// Returns: { sessionKey: "collab-abc123" }
```

### 2. Publish Proposals

```typescript
collaboration({
  action: "proposal.publish",
  sessionKey: "collab-abc123",
  decisionTopic: "API Protocol",
  proposal: "Use REST with OpenAPI spec",
  reasoning: "Team expertise, simpler caching, wider tooling support",
});
```

### 3. Challenge or Agree

```typescript
// Challenge with alternative
collaboration({
  action: "proposal.challenge",
  sessionKey: "collab-abc123",
  decisionId: "dec-xyz",
  challenge: "REST requires multiple round-trips for nested data",
  suggestedAlternative: "Use GraphQL with code-first schema generation",
});

// Agree
collaboration({
  action: "proposal.agree",
  sessionKey: "collab-abc123",
  decisionId: "dec-xyz",
});
```

### 4. Finalize Decision (Moderator)

```typescript
// Requires minimum 3 debate rounds
collaboration({
  action: "decision.finalize",
  sessionKey: "collab-abc123",
  decisionId: "dec-xyz",
  finalDecision: "Use REST with OpenAPI spec. GraphQL considered but team expertise favors REST.",
});
```

## Shared Artifacts

Write outputs to the team workspace so other agents can access them.

```typescript
// Write an artifact
team_workspace({
  action: "write_artifact",
  name: "api-design.md",
  content: "# Orders API Design\n\n## Endpoints\n...",
  description: "REST API design for orders module",
  tags: ["api", "design", "orders"],
});

// Read an artifact
team_workspace({ action: "read_artifact", name: "api-design.md" });

// List all artifacts
team_workspace({ action: "list_artifacts" });
```

## Shared Context

Store and retrieve key-value context shared across all agents.

```typescript
// Set context
team_workspace({ action: "set_context", key: "auth-strategy", value: "JWT with refresh tokens" });

// Get context
team_workspace({ action: "get_context", key: "auth-strategy" });

// Get full summary
team_workspace({ action: "get_summary" });
```

## Code Review Workflow

### Submit for Review

```typescript
collaboration({
  action: "submit_review",
  artifact: "src/auth/login.ts",
  reviewers: ["security-engineer", "quality-engineer"],
  context: "New JWT-based login flow. Focus on token handling and session security.",
});
// Returns: { reviewId: "rev-abc123" }
```

### Submit Review Feedback

```typescript
collaboration({
  action: "review.submit",
  reviewId: "rev-abc123",
  approved: true,
  feedback: "Token rotation looks solid. Consider adding rate limiting on the refresh endpoint.",
});
```

### Check Review Status

```typescript
// Get specific review
collaboration({ action: "review.get", reviewId: "rev-abc123" });

// List all reviews
collaboration({ action: "review.list" });
// Filter completed reviews
collaboration({ action: "review.list", completed: true });
```

## Quick Polls

```typescript
// Multi-choice poll
collaboration({
  action: "poll",
  question: "Which ORM should we use?",
  options: ["Drizzle", "Prisma", "TypeORM"],
  voters: ["backend-architect", "database-engineer", "tech-lead"],
});

// Vote
collaboration({ action: "poll.vote", pollId: "poll-xyz", choice: "Drizzle" });

// Check results
collaboration({ action: "poll.get", pollId: "poll-xyz" });
```

## Team Status

```typescript
// Get status of all active agents
collaboration({ action: "standup" });
```

## Rules

1. **Check get_summary before starting** -- read team_workspace context before planning
2. **Always provide reasoning** -- proposals and challenges must include reasoning
3. **Write outputs as artifacts** -- share results via team_workspace, not just inline
4. **Minimum 3 rounds before finalizing** -- debates need at least 3 rounds of discussion
5. **Escalate, don't deadlock** -- use dispute.escalate if debate is stuck after 5+ rounds
6. **Record decisions** -- finalized decisions are auto-recorded in team_workspace
7. **Use polls for preferences** -- quick votes for non-critical choices (naming, style, tooling)
8. **Use debates for architecture** -- structured sessions for decisions with tradeoffs
