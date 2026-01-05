# Web Search - Unified Implementation

## Overview

The web search functionality in Clawdis now uses a **Single Source of Truth (SSOT)** approach:
- Both `/web` slash command and Pi agent use the **same underlying CLI**
- Visual marker `🌐 Результат поиска:` indicates web search results
- No tool execution streaming (clean Telegram UI)

## Architecture

### Unified Flow
```
User Request
    ↓
(Telegram: /web command OR Pi agent with web_search tool)
    ↓
google_web CLI (google-web-cli.sh)
    ↓
web-search-by-Gemini.sh
    ↓
gemini CLI with web search
    ↓
Results with 🌐 marker
```

### Two Entry Points, One Implementation

1. **Telegram `/web` Command** (`src/telegram/bot.ts`)
   - Path: `runWebSearch()` → `executeWebSearch()` → `google_web` CLI

2. **Pi Agent `web_search` Tool** (`src/agents/pi-tools.ts`)
   - Path: `createWebSearchTool()` → `google_web` CLI

Both use the **same CLI**, ensuring consistent behavior.

## Key Files

- **`google-web-cli.sh`** - Main CLI wrapper (handles both entry points)
- **`src/web-search/executor.ts`** - TypeScript wrapper for /web command
- **`src/agents/pi-tools.ts`** - Pi agent tool definition
- **`/home/almaz/TOOLS/web_search_by_gemini/web-search-by-Gemini.sh`** - Gemini CLI wrapper

## Usage

### Via Telegram Bot
```
User: /web 2666 novel
Bot: 🌐 Результат поиска: [результат]
```

### Via Pi Agent (automatic)
```
User: google 2666 for me
Agent: [auto-uses web_search tool]
Bot: 🌐 Результат поиска: [результат]
```

### Direct CLI
```bash
cd /home/almaz/zoo_flow/clawdis
./google_web "погода в Москве"
```

## Features

✅ **Unified Implementation** - One code path for all web searches  
✅ **Visual Markers** - Always shows `🌐 Результат поиска:`  
✅ **No Streaming** - Clean UI, no tool execution updates  
✅ **Russian Results** - Always returns Russian language content  
✅ **Error Handling** - Graceful error messages in Russian  

## Configuration

Environment variables in `.env`:
```bash
GEMINI_CLI_PATH="/home/almaz/TOOLS/web_search_by_gemini/web-search-by-Gemini.sh"
WEB_SEARCH_TIMEOUT="30"
```

## Maintenance

- Modify system prompt in `src/agents/system-prompt.ts` to adjust when Pi agent uses web search
- Modify `google-web-cli.sh` to change CLI behavior
- Modify `src/web-search/messages.ts` to adjust user-facing messages
