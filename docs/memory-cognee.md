---
summary: "Cognee knowledge graph memory: setup, Docker config, and usage"
read_when:
  - Setting up Cognee memory provider
  - Configuring knowledge graph memory
  - Running Cognee with Docker
---

# Cognee Memory Provider

Clawdbot supports **Cognee** as an optional memory provider. Unlike the default SQLite-based vector memory, Cognee builds a knowledge graph with entity extraction and semantic relationships, providing richer contextual memory for your AI agent.

## What is Cognee?

Cognee is an AI memory framework that:
- Extracts entities (people, places, concepts) from documents
- Builds a knowledge graph of relationships
- Enables semantic search with LLM-powered reasoning
- Supports multiple search modes (insights, chunks, summaries)

Learn more at [docs.cognee.ai](https://docs.cognee.ai/).

## Setup Options

### Option 1: Local Docker (Recommended)

Run Cognee locally using Docker Compose:

**Step 1: Create docker-compose.yml**

```yaml
version: '3.8'

services:
  cognee:
    image: topoteretes/cognee:latest
    container_name: cognee
    ports:
      - "8000:8000"
    environment:
      # Optional: Set API key for authentication
      - COGNEE_API_KEY=your-local-api-key
      # Database configuration
      - DATABASE_URL=postgresql://cognee:cognee@postgres:5432/cognee
    volumes:
      - cognee_data:/app/data
    depends_on:
      - postgres
    restart: unless-stopped

  postgres:
    image: postgres:15-alpine
    container_name: cognee-postgres
    environment:
      - POSTGRES_USER=cognee
      - POSTGRES_PASSWORD=cognee
      - POSTGRES_DB=cognee
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  cognee_data:
  postgres_data:
```

**Step 2: Start Cognee**

```bash
docker-compose up -d
```

**Step 3: Verify**

```bash
curl http://localhost:8000/status
# Should return: {"status":"healthy"}
```

### Option 2: Cognee Cloud

Use the hosted Cognee service:

1. Sign up at [platform.cognee.ai](https://platform.cognee.ai/)
2. Get your API key from the dashboard
3. Use base URL: `https://cognee--cognee-saas-backend-serve.modal.run`

## Configuration

Add Cognee memory configuration to your `~/.clawdbot/config.yaml`:

### Basic Configuration (Docker Local)

```yaml
agents:
  defaults:
    memorySearch:
      enabled: true
      provider: cognee
      sources: [memory]  # or [memory, sessions]
      cognee:
        baseUrl: http://localhost:8000
        datasetName: clawdbot
        searchType: insights  # or "chunks", "summaries"
        maxResults: 6
        autoCognify: true
```

### Cloud Configuration

```yaml
agents:
  defaults:
    memorySearch:
      enabled: true
      provider: cognee
      sources: [memory, sessions]
      cognee:
        baseUrl: https://cognee--cognee-saas-backend-serve.modal.run
        apiKey: your-api-key-here  # Required for cloud
        datasetName: clawdbot
        searchType: insights
        maxResults: 8
        autoCognify: true
        timeoutSeconds: 60
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `baseUrl` | string | `http://localhost:8000` | Cognee API endpoint |
| `apiKey` | string | - | API key (required for cloud, optional for local) |
| `datasetName` | string | `"clawdbot"` | Dataset name for organizing memories |
| `searchType` | string | `"insights"` | Search mode: `insights`, `chunks`, or `summaries` |
| `maxResults` | number | `6` | Maximum search results returned |
| `autoCognify` | boolean | `true` | Auto-process documents after adding |
| `cognifyBatchSize` | number | `100` | Batch size for processing |
| `timeoutSeconds` | number | `30` | Request timeout in seconds |

## Search Types

Cognee offers three search modes:

### Insights (Recommended)
Best for: **High-level understanding and reasoning**
- Returns AI-generated insights from knowledge graph
- Combines multiple related facts
- Good for: "What projects am I working on?" or "Summarize my notes about X"

### Chunks
Best for: **Specific text matching**
- Returns raw document chunks
- Similar to traditional vector search
- Good for: Finding exact quotes or specific information

### Summaries
Best for: **Document overviews**
- Returns condensed summaries
- Good for: Quick scanning of content

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

### Manual Sync

Force a memory sync:

```bash
# Not yet implemented - coming soon
clawdbot memory sync --provider cognee
```

### Check Status

```bash
# Not yet implemented - coming soon
clawdbot memory status --provider cognee
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
| **Offline** | No (needs service) | Yes (fully local) |
| **Search** | Knowledge graph + LLM | Vector + BM25 hybrid |
| **Entities** | Extracted automatically | Not available |
| **Relationships** | Yes (graph-based) | No |
| **Speed** | Slower (API calls) | Faster (local DB) |
| **Memory** | Stored externally | SQLite file |
| **Best for** | Rich context, reasoning | Fast lookup, privacy |

## Troubleshooting

### Connection Failed

**Error**: `Failed to connect to Cognee at http://localhost:8000`

**Solutions**:
1. Verify Docker is running: `docker ps | grep cognee`
2. Check Cognee logs: `docker logs cognee`
3. Test manually: `curl http://localhost:8000/status`
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
          searchType: insights
          maxResults: 10
```

### Hybrid Setup (Not Yet Supported)

Future versions may support using both Cognee and SQLite:
- Cognee for semantic understanding
- SQLite for fast local lookup

## Docker Production Tips

### Health Checks

Add health checks to docker-compose.yml:

```yaml
services:
  cognee:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/status"]
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
  - ./cognee_data:/app/data
  - ./cognee_logs:/app/logs
```

## Roadmap

Planned features:
- [ ] `clawdbot memory status --provider cognee` command
- [ ] `clawdbot memory sync --provider cognee` command
- [ ] Hybrid mode (Cognee + SQLite)
- [ ] Graph visualization export
- [ ] Manual entity management

## Resources

- [Cognee Documentation](https://docs.cognee.ai/)
- [Cognee GitHub](https://github.com/topoteretes/cognee)
- [Clawdbot Memory Guide](/memory)
- [Docker Setup Guide](/install/docker)

## Feedback

Cognee integration is new. Report issues at:
- Clawdbot: [github.com/clawdbot/clawdbot/issues](https://github.com/clawdbot/clawdbot/issues)
- Cognee: [github.com/topoteretes/cognee/issues](https://github.com/topoteretes/cognee/issues)
