---
summary: "Cognee knowledge graph memory: setup, Docker config, and usage"
read_when:
  - Setting up Cognee memory provider
  - Configuring knowledge graph memory
  - Running Cognee with Docker
---

# Cognee Memory Provider

MoltBot supports [**Cognee**](https://www.cognee.ai/) as an optional memory provider. Unlike the default SQLite-based vector memory, Cognee builds a knowledge graph with entity extraction and semantic relationships, providing richer contextual memory for your AI agent.

## What is Cognee?

Cognee is an [open source AI memory](https://github.com/topoteretes/cognee) framework that:
- Ingests unstructured/structured data from 30+ sources 
- Extracts entities (people, places, concepts) from documents
- Builds a knowledge graph of relationships backed by embeddings
- Enables semantic search with LLM-powered reasoning
- Supports multiple search modes (e.g., GRAPH_COMPLETION, chunks, summaries)

Learn more at [docs.cognee.ai](https://docs.cognee.ai/).

## Setup Options

### Option 1: Local Docker (Recommended)

Use the repo example compose file:

```bash
docker compose -f examples/cognee-docker-compose.yaml up -d
```

This binds to `127.0.0.1:8000`, so Cognee is only reachable from your machine.

**Verify:**

```bash
curl http://localhost:8000/health
```

You can use `http://localhost:8000/docs` to register user and login to get your token. 

### Option 2: Cognee Cloud

Use the hosted Cognee service:

1. Sign up at [platform.cognee.ai](https://platform.cognee.ai/)
2. Get your API key from the dashboard
3. Use base URL: `https://cognee--cognee-saas-backend-serve.modal.run`

## Configuration

Moltbot reads `~/.clawdbot/moltbot.json` (JSON5). For local + secure setup, use an env var for the Cognee token and reference it in config.

### Step 1: Put tokens in `~/.clawdbot/.env`

```bash
COGNEE_API_KEY="your-cognee-access-token"
CLAWDBOT_GATEWAY_TOKEN="your-random-gateway-token"
```

### Step 2: Configure Cognee in `~/.clawdbot/moltbot.json`

```json5
{
  agents: {
    defaults: {
      memorySearch: {
        enabled: true,
        provider: "cognee",
        sources: ["memory", "sessions"],
        experimental: { sessionMemory: true },
        cognee: {
          baseUrl: "http://localhost:8000",
          apiKey: "${COGNEE_API_KEY}",
          datasetName: "clawdbot",
          searchType: "GRAPH_COMPLETION",
          maxResults: 6,
          autoCognify: true,
          timeoutSeconds: 180
        }
      }
    }
  }
}
```

### Step 3: Start the gateway with env loaded

```zsh
set -a; source "$HOME/.clawdbot/.env"; set +a
pnpm moltbot gateway --port 18789 --token "$CLAWDBOT_GATEWAY_TOKEN" --verbose
```



## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `baseUrl` | string | `http://localhost:8000` | Cognee API endpoint |
| `apiKey` | string | - | Access token (required if Cognee auth is enabled) |
| `datasetName` | string | `"clawdbot"` | Dataset name for organizing memories |
| `searchType` | string | `"GRAPH_COMPLETION"` | Search mode: `GRAPH_COMPLETION`, `chunks`, or `summaries` |
| `maxResults` | number | `6` | Maximum search results returned |
| `autoCognify` | boolean | `true` | Auto-process documents after adding |
| `cognifyBatchSize` | number | `100` | Batch size for processing |
| `timeoutSeconds` | number | `180` | Request timeout in seconds |

## Search Types

Cognee offers these modes. GRAPH_COMPLETION is the default mode.

Learn more from [cognee documentation](https://docs.cognee.ai/core-concepts/main-operations/search)

## Usage

### Memory Files

Cognee automatically syncs your memory files:
- `MEMORY.md` or `memory.md` in workspace root
- All `*.md` files in `memory/` directory

### Session Transcripts (Optional)

Enable session memory to index conversation history:

```yaml
agents:
  defaults:
    memorySearch:
      provider: cognee
      sources: [memory, sessions]  # Include sessions
      experimental:
        sessionMemory: true
```

### Manual Sync and Status

```bash
# Manually sync cognee memory for the current agent
pnpm moltbot memory status --index --json
```

## How It Works

1. **Add**: Memory files are sent to Cognee with metadata
2. **Cognify**: Cognee processes documents:
   - Extracts entities (people, places, concepts)
   - Identifies relationships
   - Builds knowledge graph
3. **Search**: Agent queries use semantic search:
   - Searches knowledge graph
   - Returns relevant insights/chunks/summaries
   - Includes metadata and scores

## Comparison: Cognee vs SQLite Memory

| Feature | Cognee | SQLite (Default) |
|---------|--------|------------------|
| **Setup** | Requires Docker/cloud | Built-in, no setup |
| **Offline** | Yes (Optional cloud) | Yes (fully local) |
| **Search** | Knowledge graph + LLM | Vector + BM25 hybrid |
| **Entities** | Extracted automatically | Not available |
| **Relationships** | Yes (graph-based) | No |
| **Speed** | Slower (API calls) | Faster (local DB) |
| **Memory** | Stored locally (Optional cognee configs) | SQLite file |
| **Best for** | Rich context, reasoning | Fast lookup, privacy |

## Troubleshooting

### Connection Failed

**Error**: `Failed to connect to Cognee at http://localhost:8000`

**Solutions**:
1. Verify Docker is running: `docker ps | grep cognee`
2. Check Cognee logs: `docker logs cognee`
3. Test manually: `curl http://localhost:8000/health`
4. Ensure port 8000 is not blocked

### Slow Performance

**Solutions**:
1. Reduce `maxResults` (try 3-5 instead of 10+)
2. Use `searchType: "chunks"` for faster results
3. Set `autoCognify: false` and cognify manually
4. Check Docker resource limits

### Out of Memory

**Solutions**:
1. Increase Docker memory limit (Docker Desktop settings)
2. Reduce `cognifyBatchSize` (try 50 instead of 100)
3. Process fewer files at once
4. Clear old datasets via Cognee API

### 401 Unauthorized (Cognee auth)

**Cause**: Cognee auth is enabled, but Moltbot is missing/using an invalid `COGNEE_API_KEY`.

**Fix**:
1. Log in to Cognee and get a fresh access token.
2. Update `COGNEE_API_KEY` in `.clawd/.env`.
3. Restart the gateway with env loaded (see Step 3 above).

## Advanced Configuration

### Per-Agent Override

```yaml
agents:
  defaults:
    memorySearch:
      provider: openai  # Default for all agents

  agents:
    research-bot:
      memorySearch:
        provider: cognee  # Override for this agent
        cognee:
          searchType: GRAPH_COMPLETION
          maxResults: 10
```

## Docker Production Tips

### Health Checks

Add health checks to docker-compose.yml:

```yaml
services:
  cognee:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

### Resource Limits

```yaml
services:
  cognee:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '1'
          memory: 2G
```

### Persistent Storage

Mount volumes for persistence:

```yaml
volumes:
  - ./cognee_data:/app/cognee/.cognee_system
  - ./cognee_logs:/app/logs
```

## Resources

- [Cognee Documentation](https://docs.cognee.ai/)
- [Cognee GitHub](https://github.com/topoteretes/cognee)
- [Clawdbot Memory Guide](/memory)
- [Docker Setup Guide](/install/docker)

## Feedback

Cognee integration is new. Report issues at:
- Clawdbot: [github.com/clawdbot/clawdbot/issues](https://github.com/clawdbot/clawdbot/issues)
- Cognee: [github.com/topoteretes/cognee/issues](https://github.com/topoteretes/cognee/issues)
