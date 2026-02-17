# Message Flow: From "Send" to "Reply"

How a message travels from someone's phone (WhatsApp, Telegram, etc.) through OpenClaw/Clawdbot, gets processed by the AI agent, and comes back as a reply.

Written for someone who does NOT code. No jargon.

---

## The Big Picture (Text Diagram)

```
PHONE / APP                     CLAWDBOT SERVER                          AI BRAIN
===========                     ===============                          ========

 You send a       -->  [Channel Adapter]  -->  [Message Context]
 WhatsApp or           (WhatsApp Web,          (Who sent it?
 Telegram msg          Telegram Bot, etc.)      What did they say?
                                                Which chat?)
                                                     |
                                                     v
                                            [Command Check]
                                            (Is this a /stop,
                                             /reset, /help, etc?)
                                                     |
                                          +----------+----------+
                                          |                     |
                                     YES: handle            NO: continue
                                     command and                |
                                     reply immediately          v
                                                     [Queue Mode Decision]
                                                     (Is the agent already
                                                      busy with this chat?)
                                                          |
                                              +-----------+-----------+
                                              |           |           |
                                         NOT BUSY     BUSY:steer  BUSY:followup
                                              |           |           |
                                              v           v           v
                                         [Session     [Inject msg  [Add to
                                          Lane         into the     followup
                                          Queue]       active run]  queue]
                                              |                       |
                                              v                       |
                                         [Global                  (waits for
                                          Lane                    current run
                                          Queue]                  to finish)
                                              |                       |
                                              v                       v
                                         [Agent Runner] <-------- [Drain Queue]
                                         (AI thinks,               (runs next
                                          uses tools,               message)
                                          generates
                                          response)
                                              |
                                              v
                                         [Route Reply]
                                         (Send response back
                                          through the SAME
                                          channel it came from)
                                              |
                                              v
                                         [Channel Adapter]
                                         (WhatsApp, Telegram,
                                          etc. delivers reply)
                                              |
                                              v
                                    YOU SEE THE REPLY ON YOUR PHONE
```

---

## Step-by-Step Walkthrough

### Step 1: You Send a Message

You type something in WhatsApp, Telegram, Discord, Slack, Signal, iMessage, or any other connected channel and hit send.

**Files involved:**
- Nothing in Clawdbot yet -- this is happening on your phone or app.

---

### Step 2: The Gateway Server Receives It

The Clawdbot system runs a central "gateway server" that stays online and manages all connected channels. When it starts up, it boots every channel that has been configured (WhatsApp, Telegram, Discord, etc.) and begins listening for incoming messages.

Think of the gateway as the front desk of a hotel. Every message from every channel comes through it first.

**Files involved:**
- `/src/gateway/server.impl.ts` -- The main gateway server that boots up and coordinates everything.
- `/src/gateway/server-channels.ts` -- The Channel Manager that starts and stops individual channel connections.
- `/src/gateway/server-startup.ts` -- Starts all the "sidecar" services (hooks, Gmail watcher, browser control, etc.).
- `/src/gateway/server-lanes.ts` -- Sets up the lane concurrency limits when the gateway starts (how many things can run at once).

---

### Step 3: The Channel Adapter Picks It Up

Each messaging platform has its own "adapter" -- a piece of code that knows how to talk to that specific platform. The adapter receives the raw message from the platform and converts it into a standard internal format that the rest of the system can understand.

For **Telegram**, a bot using the Telegram Bot API receives the message, figures out the chat ID, the sender, whether it is a group or direct message, handles media/stickers, and packages it all up.

For **WhatsApp**, a WhatsApp Web connection picks up the message, extracts the sender phone number, determines the chat type, and builds the same kind of internal package.

All adapters end up creating the same kind of "message context" -- a standardized envelope that says: who sent it, what channel it came from, what the message text is, whether there are media attachments, the chat type (group vs. direct), and so on.

**Files involved:**
- `/src/telegram/bot.ts` -- Main Telegram bot setup and message listener.
- `/src/telegram/bot-message.ts` -- Creates the Telegram message processor (builds context, then dispatches).
- `/src/telegram/bot-message-context.ts` -- Builds the standardized message context from a Telegram update.
- `/src/telegram/bot-message-dispatch.ts` -- Dispatches a prepared Telegram message into the auto-reply pipeline.
- `/src/web/auto-reply/monitor/process-message.ts` -- The WhatsApp Web message processor (equivalent role for WhatsApp).
- `/src/web/inbound/extract.ts` -- Extracts and normalizes WhatsApp inbound messages.
- `/src/channels/registry.ts` -- The master list of all supported channels and their metadata.

---

### Step 4: The Auto-Reply Pipeline Takes Over

Once the adapter has a standardized message context, it calls into the "dispatch" system. This is a chain of functions that processes the message step by step.

First, it checks for duplicates (has this exact message already been processed?). Then it fires any plugin hooks that want to know about incoming messages. Then it checks if replies need to be routed to a different channel than usual (cross-provider routing).

**Files involved:**
- `/src/auto-reply/reply/provider-dispatcher.ts` -- The entry point that each channel adapter calls to start processing.
- `/src/auto-reply/dispatch.ts` -- Coordinates the dispatch: finalizes context, creates the reply dispatcher, calls the config-based reply logic.
- `/src/auto-reply/reply/dispatch-from-config.ts` -- The central dispatcher that checks for duplicates, fires hooks, handles abort triggers, and then calls the reply generator.
- `/src/auto-reply/reply/inbound-context.ts` -- Finalizes the inbound message context (fills in missing fields, normalizes data).

---

### Step 5: Commands Get Checked First

Before the AI ever sees the message, the system checks if the message is a "command" -- something like /stop, /reset, /new, /help, /usage, /restart, etc.

If it IS a command, it gets handled immediately and a response is sent back. The AI agent is never involved.

If it is NOT a command, the message continues down the pipeline to reach the AI.

**Files involved:**
- `/src/auto-reply/reply/commands-core.ts` -- The command handler chain. Each command type (bash, activation, send policy, help, status, etc.) gets a chance to handle the message. If any handler matches, processing stops.
- `/src/auto-reply/reply/commands-session.ts` -- Session-related commands: /stop (aborts the current run), /restart, /usage, /activation, /send.
- `/src/auto-reply/reply/get-reply.ts` -- The main "get a reply" function. It sets up the workspace, resolves the model, processes media and links, initializes session state, handles directives, and then calls the prepared reply runner.

---

### Step 6: Session State Gets Resolved

Every conversation has a "session." A session tracks which AI model is being used, the conversation history file, who the sender is, and various settings. When a message comes in, the system either finds the existing session for that chat or creates a new one.

The session also determines the "session key" -- a unique identifier for this conversation. For a WhatsApp DM, it might be the phone number. For a Telegram group, it might be the group ID.

**Files involved:**
- `/src/auto-reply/reply/session.ts` -- Initializes or loads the session state for the current message.
- `/src/config/sessions.ts` -- The session store: reads/writes session entries from disk.

---

### Step 7: The Queue Mode Decision

This is where it gets interesting. What happens when someone sends a second message while the AI is still thinking about the first one?

The system has several "queue modes" that control this behavior. The mode can be set globally, per channel, or per session.

#### Queue Modes Explained:

- **collect** (the default): If the agent is busy, hold onto the new message. When the agent finishes, combine ALL waiting messages into a single batch and send them to the agent as one prompt. This avoids a flurry of back-and-forth and gives the agent the full picture.

- **steer**: If the agent is currently streaming its response (actively generating text), inject the new message directly into the running agent session. The agent sees the new message in real time and can adjust what it is saying. If the agent is NOT streaming, this falls back to followup behavior.

- **followup**: If the agent is busy, hold the new message. When the current run finishes, send the new message as its own separate turn (one by one, not combined).

- **steer-backlog** (steer + backlog): Like steer, but ALSO saves the message for a followup turn. This means the agent sees it during the current run AND will process it again after. Can produce duplicate responses -- use carefully.

- **interrupt** (legacy): Abort the current run entirely and start fresh with the new message.

- **queue** (legacy alias): Same as steer.

#### How It Decides:

The system checks: Is the agent currently active for this session? Is it streaming?

- If the agent is **NOT busy**: proceed normally -- run the agent right away.
- If the agent IS busy and mode is **steer**: try to inject the message into the live stream. If that fails (not streaming), enqueue as followup.
- If the agent IS busy and mode is **followup/collect**: add the message to the followup queue and return immediately (no reply yet -- the sender has to wait).

**Files involved:**
- `/src/auto-reply/reply/get-reply-run.ts` -- Where the queue mode decision happens. Checks if the agent is active, resolves queue settings, decides whether to steer/followup/run.
- `/src/auto-reply/reply/queue/settings.ts` -- Resolves which queue mode to use based on config, channel defaults, session overrides, and inline directives.
- `/src/auto-reply/reply/queue/types.ts` -- Defines the queue mode types: steer, followup, collect, steer-backlog, interrupt, queue.
- `/src/auto-reply/reply/queue/enqueue.ts` -- Adds a message to the followup queue (with deduplication and cap enforcement).
- `/src/auto-reply/reply/queue/drain.ts` -- Drains the followup queue after the current run completes. For "collect" mode, it merges all waiting messages into one prompt.
- `/src/auto-reply/reply/agent-runner.ts` -- The function `runReplyAgent` that executes the steer/followup/run decision and then calls the actual agent.

---

### Step 8: The Lane System (Traffic Control)

Before the AI agent actually starts thinking, the message has to pass through the "lane system." Lanes are like traffic lanes on a highway -- they control how many things can run at the same time and prevent collisions.

#### What Is a Lane?

A lane is a named queue with a concurrency limit. Each lane processes its items one at a time (or up to its concurrency cap).

#### The Two-Lane Guarantee:

Every agent run passes through TWO lanes:

1. **Session Lane** (`session:<key>`): There is one lane per conversation. This guarantees that only ONE agent run touches a given conversation at a time. If you send three messages fast, they line up and run one after another, not simultaneously. This prevents the AI from writing to the same conversation file at the same time and creating chaos.

2. **Global Lane** (usually `main`): After getting through the session lane, the run enters the global lane. This controls how many total agent runs can happen across ALL conversations at once. The default concurrency is set by `agents.defaults.maxConcurrent`. If it is set to 4, at most 4 conversations can have active AI runs at the same time. Others wait their turn.

#### Other Lanes:

- **cron**: Background scheduled jobs run in their own lane so they do not block incoming messages.
- **subagent**: Sub-agents (agents spawned by other agents) have their own lane with higher concurrency (default 8).
- **nested**: For nested operations that need their own lane.

#### Why This Matters:

Without lanes, if ten people messaged the bot at once, ten AI runs would start simultaneously. That could overwhelm the system, hit API rate limits, and cause session file corruption. Lanes make everything orderly.

While a message is waiting in the lane queue, the system can still show a "typing" indicator to the user, so they know the bot is working on it.

**Files involved:**
- `/src/process/command-queue.ts` -- The core lane queue implementation. A simple in-process FIFO queue that supports multiple named lanes with configurable concurrency.
- `/src/process/lanes.ts` -- Defines the lane names: Main, Cron, Subagent, Nested.
- `/src/agents/pi-embedded-runner/lanes.ts` -- Helper functions that resolve lane names: `resolveSessionLane` (creates `session:<key>`), `resolveGlobalLane` (defaults to "main").
- `/src/gateway/server-lanes.ts` -- Called at startup to set the concurrency limits for each lane type.

---

### Step 9: The AI Agent Runs

Once the message makes it through both lanes, the actual AI agent starts. This is the expensive part -- it calls the AI model (Claude, GPT, Gemini, etc.), which reads the conversation history, thinks about the message, and generates a response.

The agent can also use "tools" -- it can run bash commands, read files, search the web, send messages, and more. Each tool call is another step in the agent's thinking process.

The agent runner also handles:
- Model fallback (if the primary model fails, try a backup)
- Auth profile rotation (if one API key hits rate limits, try another)
- Session compaction (if the conversation gets too long, summarize the old parts to fit in the context window)
- Timeout handling (if the AI takes too long, abort)

**Files involved:**
- `/src/agents/pi-embedded-runner/run.ts` -- The main `runEmbeddedPiAgent` function. This is where the session lane and global lane enqueuing happens, and then the actual AI run is executed inside the lane.
- `/src/agents/pi-embedded-runner/run/attempt.ts` -- A single attempt at running the agent (called by the fallback wrapper).
- `/src/agents/pi-embedded-runner/compact.ts` -- Session compaction: summarizes old conversation history to free up context window space.
- `/src/agents/pi-embedded-runner/runs.ts` -- Tracks active runs. The `queueEmbeddedPiMessage` function here is what "steer" mode uses to inject a message into a live, streaming run.

---

### Step 10: The Response Goes Back

Once the AI generates its response, the reply travels back through the system:

1. The agent runner produces one or more "reply payloads" (text, media, etc.).
2. The reply goes to the "route reply" function, which figures out where to send it. It uses the "originating channel" information saved from Step 3 to send the reply back to the SAME platform and chat where the message came from.
3. The channel-specific outbound delivery code formats the reply for that platform (splits long messages for Telegram's 4096-character limit, formats markdown correctly, etc.) and sends it.
4. The user sees the reply in their app.

After the reply is sent, the followup queue is checked. If there are more messages waiting (from Step 7), the system drains the queue and processes them. In "collect" mode, all waiting messages get bundled together. In "followup" mode, they run one at a time.

**Files involved:**
- `/src/auto-reply/reply/route-reply.ts` -- The unified reply router. Takes a reply payload and sends it to the correct channel based on originating channel info.
- `/src/auto-reply/reply/followup-runner.ts` -- Runs followup turns from the queue after the main run completes. Routes replies back to originating channels.
- `/src/infra/outbound/deliver.ts` -- The low-level delivery function that sends the actual API calls to WhatsApp, Telegram, etc.
- `/src/telegram/send.ts` -- Telegram-specific message sending.
- `/src/web/outbound.ts` -- WhatsApp Web-specific message sending.

---

## The Heartbeat System

The heartbeat is a scheduled "self-check" that the bot performs on itself. At a regular interval (default: every 30 minutes), the system sends a special internal message to the agent that says "check your HEARTBEAT.md file and do whatever it says."

This lets the bot perform recurring tasks (checking for updates, running reminders, monitoring things) without anyone sending it a message.

Heartbeat runs go through the same lane system as regular messages, so they wait their turn and do not interfere with active conversations.

**Files involved:**
- `/src/auto-reply/heartbeat.ts` -- Defines the heartbeat prompt and helper functions.
- `/src/infra/heartbeat-runner.ts` -- Actually runs the heartbeat.
- `/src/gateway/server-cron.ts` -- The cron service that can trigger heartbeat runs on schedule.

---

## The Cron System

The cron system lets you schedule recurring jobs (like "run this agent task every day at 9am"). Cron jobs run in their own dedicated "cron" lane, so they do not block regular messages.

A cron job can either:
- Trigger a heartbeat run (reuses the main session)
- Run an isolated agent turn with its own session (does not interfere with the main conversation)

**Files involved:**
- `/src/gateway/server-cron.ts` -- Builds the cron service and wires it into the gateway.
- `/src/cron/service.ts` -- The cron scheduler itself.
- `/src/cron/isolated-agent.ts` -- Runs an isolated agent turn for cron jobs.

---

## Summary of Key Concepts

| Concept | What It Is | Why It Matters |
|---------|-----------|----------------|
| Channel Adapter | Code that talks to WhatsApp, Telegram, etc. | Translates platform-specific messages into a standard format |
| Gateway Server | The central hub that manages everything | Single entry point for all channels, manages lifecycle |
| Session | A conversation's state and history | Tracks who is talking, what model to use, conversation file |
| Lane | A named queue with a concurrency limit | Prevents collisions and controls parallelism |
| Session Lane | One lane per conversation | Guarantees one AI run per conversation at a time |
| Global Lane | One lane for all conversations | Limits total simultaneous AI runs across the system |
| Queue Mode | How to handle messages that arrive while the agent is busy | collect, steer, followup, steer-backlog, interrupt |
| Followup Queue | A holding area for messages waiting their turn | Messages sit here until the current run finishes |
| Heartbeat | A scheduled self-check for the agent | Lets the bot perform recurring tasks without human prompting |
| Cron | Scheduled recurring jobs | Runs agent tasks on a timer, in its own lane |

---

## Lane Concurrency Defaults

| Lane | Default Concurrency | Purpose |
|------|-------------------|---------|
| main | Set by `agents.defaults.maxConcurrent` (default 4) | All inbound messages and main heartbeats |
| cron | Set by `cron.maxConcurrentRuns` (default 1) | Scheduled background jobs |
| subagent | Set by `agents.defaults.subagentMaxConcurrent` (default 8) | Sub-agents spawned by other agents |
| session:* | 1 (always) | Per-conversation serialization (never configurable -- always 1) |

---

## Queue Mode Defaults

| Setting | Default |
|---------|---------|
| Mode | collect |
| Debounce | 1000ms (1 second of quiet before draining) |
| Cap | 20 messages max in the queue |
| Drop policy | summarize (if cap is hit, summarize the dropped messages) |
