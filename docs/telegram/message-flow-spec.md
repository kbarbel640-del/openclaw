# Message Flow Spec

## Overview

- Inbound Telegram updates are captured by `src/telegram/bot.ts` and routed through `dispatchTelegramMessage` (`src/telegram/bot-message-dispatch.ts`).
- Every inbound is logged as `telegram inbound queued: ...` once the queue handoff succeeds, which immediately assigns an `⏳` reaction using `reactMessageTelegram`.
- The queue worker (anti-timeout orchestrator) owns the rest of the status lifecycle and final delivery.

## Reaction orchestration

- **⏳** is added by `dispatchTelegramMessage` directly before enqueueing (same routine that calls `enqueue_telegram_inbound.sh`).
- Worker start clears `⏳` and swaps it for **👀** via `reactMessageTelegram`, then runs the queued `run_queued_agent_prompt.py` job.
- Final reply reaction removes **👀** and adds **👌** after delivery. Reactions are logged through the new `telegram/reactions` subsystem so you can trace the transitions in `data/.pm2/logs/openclaw-gateway-dev-out.log`.

## Queue flow

- `dispatchTelegramMessage` passes `--chat-id`, `--message-id`, `--text`, and `--agent` to `/home/node/.openclaw/workspace/scripts/enqueue_telegram_inbound.sh`.
- The enqueue script writes a prompt file in `./tmp/queue-prompts` and calls `anti-timeout-orchestrator/scripts/enqueue_task.sh`, which persists the task in `queues/anti-timeout-orchestrator/queue.sqlite3`.
- Workers are driven by `scripts/run_queue.sh` / `queue.py` in the same skill; `queue.py` claims tasks, updates status in SQLite, and calls `/home/node/.openclaw/workspace/scripts/run_queued_agent_prompt.py` using `openclaw agent --message ... --reply-channel telegram --reply-to <chat-id>`.

## Key files

- `src/telegram/bot-message-dispatch.ts`: reads environment variable `OPENCLAW_TELEGRAM_INBOUND_QUEUE_SCRIPT`, builds queue args, and logs `telegram inbound queued`.
- `scripts/enqueue_telegram_inbound.sh`: sanitizes arguments, writes a prompt file in `tmp/queue-prompts/`, and hands off to `skills/anti-timeout-orchestrator/scripts/enqueue_task.sh`.
- `skills/anti-timeout-orchestrator/scripts/queue.py`: SQLite-backed queue with `enqueue`, `claim`, `complete`, and `requeue-stale` commands; `run_queue.sh` loops over claims to keep the worker pumping.
- `scripts/run_queued_agent_prompt.py`: wraps `openclaw agent` execution, injecting `[[reply_to:<messageId>]]` and delivering to Telegram.
- `src/telegram/send.ts`: exposes `reactMessageTelegram` and now logs reaction actions at `telegram/reactions`.

## Runtime observability

- Enable `telegram.reply-route` diagnostic flag via `config` to trace routing decisions in `data/.pm2/logs/openclaw-gateway-dev-out.log`.
- Reaction events now log lines like `telegram reaction added ✅ chat=123 message=456` / `telegram reaction cleared (cleared) ...`.
- Queue state can be inspected with `skills/anti-timeout-orchestrator/scripts/queue.py list` and temporary prompts in `tmp/queue-prompts/`.

## Deployment notes

- `docker-compose.yml` must keep `OPENCLAW_TELEGRAM_INBOUND_QUEUE_SCRIPT` pointing to `/home/node/.openclaw/workspace/scripts/enqueue_telegram_inbound.sh`.
- After code or script changes, run `pnpm build && pnpm check && pnpm test` then `docker compose build && docker compose up -d` to refresh the gateway container.
