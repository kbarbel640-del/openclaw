# System Overview

## What This Is

**Moltbot** (codebase: `clawdbot`) is an AI agent runtime that:
- Connects to messaging channels (WhatsApp, Telegram, Slack, Discord, iMessage, Signal)
- Routes messages to LLM providers (local or hosted)
- Executes tools and returns results to users

**SIOE** (Specialty One Intelligence Engine) is the adaptation of Moltbot for Commercial Real Estate workflows. Moltbot provides the agent infrastructure; SIOE provides the domain-specific intelligence layer.

## Why Local-First

CRE workflows involve:
- Sensitive deal information (rent rolls, financial terms, tenant data)
- High-volume document processing (OMs, leases, surveys)
- Time-sensitive operations where latency matters

Local-first means:
1. Default to local models (Ollama) when available
2. Keep sensitive data on the gateway host when possible
3. Only escalate to hosted models when local cannot handle the task
4. Never require network connectivity for basic operations

## Core Principle: Reliability Over Intelligence

In CRE, a system that works 100 times out of 100 is more valuable than one that works brilliantly 95 times but fails unpredictably.

This means:
- Deterministic model routing (no "smart" routing that changes behavior)
- Fail-fast startup validation (don't accept connections if the agent cannot respond)
- Explicit configuration (no magic defaults that change based on context)
- Clear error messages (operator must be able to diagnose failures)

## What Moltbot Is NOT

- Not a chatbot framework (it runs agents, not scripts)
- Not a multi-tenant SaaS (one gateway per host)
- Not a model training platform (inference only)
- Not a document storage system (processes documents, doesn't own them)

## Key Vocabulary

| Term | Meaning |
|------|---------|
| Gateway | Long-running process that owns all connections |
| Agent | LLM-powered runtime that handles messages |
| Provider | Source of model inference (Ollama, Anthropic, Moonshot) |
| Channel | Messaging surface (WhatsApp, Telegram, etc.) |
| Node | Mobile/desktop device connected to the gateway |
| Session | Conversation context with a user |
| TUI | Terminal UI for operator interaction |

## Current State (Phase 0)

The system currently supports:
- Local Ollama with auto-discovery and `auth: "none"`
- Hosted providers (Anthropic, OpenAI, Moonshot/Kimi)
- Startup validation with fail-fast on misconfiguration
- Context window enforcement (minimum 16000 tokens)

What is NOT yet built:
- Task-based model routing
- CRE-specific extraction pipelines
- Spine/memory layer
- Multi-agent orchestration for CRE workflows
