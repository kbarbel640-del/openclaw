# Telegram Resilience

Utilities for handling Telegram API failures, retries, and recovery.

## Overview

This module provides three core mechanisms for building resilient Telegram bot interactions:

- **BotHealthCheck**: Continuous monitoring of bot connectivity
- **Circuit Breaker**: Prevents cascading failures by stopping requests to failing services
- **Retry with Backoff**: Automatic retry logic with exponential backoff for transient failures

## Usage

```typescript
import { BotHealthCheck } from "./health.js";
import { Circuit } from "./circuit.js";
import { retryWithBackoff } from "../infra/retry.js";

const health = new BotHealthCheck(bot, logger, {
  interval: 30000,
  onFail: () => console.log("bot offline"),
  onRecover: () => console.log("bot back online"),
});
health.start();

const result = await retryWithBackoff(() => bot.api.sendMessage(chatId, text), {
  attempts: 3,
  minDelayMs: 1000,
});

const circuit = new Circuit(logger, { failures: 5 });
