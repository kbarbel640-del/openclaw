---
name: agent-development
description: This skill should be used when the user asks to "create an agent", "add an agent", "write a subagent", or needs guidance on agent structure, system prompts, or agent development best practices.
version: 1.0.0
---

# Agent Development for OpenClaw

## Overview

Agents in OpenClaw are autonomous subprocesses that handle complex, multi-step tasks. They can be defined either as:

1.  **TypeScript Classes** (for robust, complex workflows)
2.  **Markdown Prompts** (for lighter, specific personals)

This skill focuses on **Markdown Agents**, which are lightweight and easy to create.

## Agent File Structure

Create a new file in `src/agents/prompts/[agent-name].md`:

```markdown
---
name: code-reviewer
description: Use this agent when the user asks to review code for bugs or style issues.
model: sonnet
color: blue
tools: ["read_file", "grep_search"]
---

You are an expert code reviewer.

**Your Responsibilities:**

1. Analyze the code for logic errors.
2. Check for security vulnerabilities.
3. Verify adherence to project style guides.

**Output Format:**

- List issues with file path and line number.
- Suggest concrete fixes.
```

## Creating Agents

1.  **Choose an Identifier**: Use kebab-case (e.g., `test-generator`).
2.  **Define Trigger**: Write a clear description of _when_ this agent should be used.
3.  **Write System Prompt**: Define the persona, responsibilities, and output format.
4.  **Select Tools**: List the tools the agent needs access to.

## Best Practices

- **Be Specific**: The more specific the system prompt, the better the agent performs.
- **Limit Tools**: Only give the agent the tools it needs to do its job (Principle of Least Privilege).
- **Use Examples**: In the description, include examples of user queries that should trigger this agent.
