# Infrastructure Reference

NerdPlanet GPU cluster and services powering the Diabolus Ex Machina agent platform. Operational details and secrets live in `forge/` (gitignored).

## GPU Cluster

| Server | GPU | VRAM | Role | Ollama Tuning |
|--------|-----|------|------|---------------|
| **Claudius** | RTX 3090 | 24GB | Small models, image gen | `NUM_PARALLEL=2`, `MAX_LOADED=1`, `KEEP_ALIVE=10m` |
| **Maximus** | DGX Spark | 128GB | Large models (70B+) | `NUM_PARALLEL=8`, `MAX_LOADED=4`, `KEEP_ALIVE=30m` |
| **Tiberius** | RTX 5090 | 32GB | Mid models (32B), vision | `NUM_PARALLEL=4`, `MAX_LOADED=2`, `KEEP_ALIVE=10m` |

All servers run Ollama with `OLLAMA_HOST=0.0.0.0`, accessible on port `11434` from the `192.168.2.0/24` network.

## Model Inventory

### Maximus (128GB — executive agents)

| Model | Parameters | Use Case |
|-------|-----------|----------|
| `deepseek-r1:70b` | 70B | Chain-of-thought reasoning (CEO) |
| `qwen2.5:72b` | 72B | General purpose (COO validation) |
| `qwen2.5-coder:72b` | 72B | Code generation |
| `dolphin-llama3:70b` | 70B | Instruct-tuned |
| `mixtral:8x22b` | 8x22B | Mixture of Experts |

### Tiberius (32GB — worker agents)

| Model | Parameters | Use Case |
|-------|-----------|----------|
| `deepseek-r1:32b` | 32B | Reasoning (Research agent) |
| `qwen2.5:32b` | 32B | General purpose |
| `qwen2.5-coder:32b` | 32B | Code |
| `gemma3:27b` | 27B | Efficient mid-size |
| `qwen3-vl:32b` | 32B | Vision |

### Claudius (24GB — lightweight/fallback)

| Model | Parameters | Use Case |
|-------|-----------|----------|
| `deepseek-r1:14b` | 14B | Fast reasoning (CFO) |
| `qwen2.5:14b` | 14B | General purpose |
| `codellama:13b` | 13B | Code |
| `mistral:7b` | 7B | Fast fallback |

## Agent → Model Assignment

| Agent | Codename | Model | Server | Rationale |
|-------|----------|-------|--------|-----------|
| CEO | Imperator | `deepseek-r1:70b` | Maximus | Best reasoning for task decomposition and orchestration |
| COO | Praetor | `qwen2.5:72b` | Maximus | Strong general purpose for validation and oversight |
| CFO | Quaestor | `deepseek-r1:14b` | Claudius | Reasoning for financial decisions, smaller model sufficient |
| Research | Explorator | `deepseek-r1:32b` | Tiberius | Good reasoning + fast for iterative research tasks |

OpenClaw connects via OpenAI-compatible API at `http://<host>:11434/v1` with `apiKey: "ollama"`.

## MCP Servers (nasidius — 192.168.2.50)

All MCP servers run on nasidius as Docker containers, exposing SSE transport on dedicated ports.

| Port | Server | Service | DEM Use Case |
|------|--------|---------|-------------|
| 8811 | mcp-grafana | Grafana | Agent monitoring dashboards, PromQL/LogQL |
| 8812 | mcp-wikijs | WikiJS | Documentation management |
| 8813 | mcp-postgres | PostgreSQL | Agent state, event persistence |
| 8814 | mcp-redis | Redis | Auth sessions, nonce store, caching |
| 8815 | mcp-n8n | n8n | Workflow automation for agent tasks |
| 8816 | mcp-docker | Docker | Container management |
| 8817 | mcp-labelstudio | Label Studio | Data labeling (future) |
| 8818 | mcp-minio | MinIO | Object storage (future) |
| 8819 | mcp-ollama | Ollama via Open WebUI | Unified model access across all GPU servers |
| 8820 | mcp-comfyui | ComfyUI | Image generation (future) |

SSE endpoints: `http://192.168.2.50:<port>/sse`

## Open WebUI

- **External**: `https://chat.nerdplanet.net` (Cloudflare tunnel)
- **Internal**: `http://nasidius:8080`
- **Ollama backends**: `http://maximus:11434;http://tiberius:11434;http://claudius:11434`
- Provides unified model list across all Ollama instances
- OpenAI-compatible API for programmatic access

## Network Topology

```
Internet
  │
  ├── Cloudflare Tunnels (cloudflared on nasidius)
  │     ├── chat.nerdplanet.net → Open WebUI
  │     ├── wiki.nerdplanet.net → WikiJS
  │     ├── grafana.nerdplanet.net → Grafana
  │     └── ...
  │
  └── 192.168.2.0/24 (LAN)
        │
        ├── nasidius (Synology NAS) — Core services hub
        │     ├── Docker: postgres, redis, wikijs, n8n, grafana, ...
        │     ├── MCP servers: ports 8811-8820
        │     └── Open WebUI: port 8080
        │
        ├── maximus (DGX Spark) — Primary GPU
        │     └── Ollama: port 11434 (128GB VRAM)
        │
        ├── tiberius (RTX 5090) — Secondary GPU
        │     └── Ollama: port 11434 (32GB VRAM)
        │
        └── claudius (RTX 3090) — Tertiary GPU
              ├── Ollama: port 11434 (24GB VRAM)
              └── ComfyUI: port 8188
```

## Deployment

Infrastructure changes are deployed via `forge/scripts/deploy.sh`:

```bash
# Deploy core services to nasidius
./forge/scripts/deploy.sh --server nasidius --stack core

# Deploy Ollama to GPU servers
./forge/scripts/deploy.sh --server maximus --stack ollama
./forge/scripts/deploy.sh --server tiberius --stack ollama
./forge/scripts/deploy.sh --server claudius --stack ollama
```

Secrets managed via 1Password Connect (`http://nasidius:8080`).

## SSH Access

| Server | Command |
|--------|---------|
| nasidius | `ssh alpha@nasidius` |
| claudius | `ssh alpha@claudius` |
| maximus | `ssh titus@maximus` |
| tiberius | `ssh titus@tiberius` |

## VRAM Budget

| Model Size | Full Precision | Q4 Quantized |
|------------|----------------|--------------|
| 7B | ~14GB | ~4GB |
| 14B | ~28GB | ~8GB |
| 32B | ~64GB | ~20GB |
| 70B | ~140GB | ~40GB |

Context overhead: ~2GB additional. Larger contexts require more VRAM.
