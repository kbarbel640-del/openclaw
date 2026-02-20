# OpenClaw (clawdbot) Development Guide

## EC2 Production Server

The OpenClaw gateway and Mission Control run on an EC2 instance in us-west-2.

### SSH Connection
```bash
ssh -i ~/.ssh/openclaw-key.pem ec2-user@34.216.126.0
```

- **Key file:** `~/.ssh/openclaw-key.pem`
- **User:** `ec2-user`
- **IP:** `34.216.126.0` (Elastic IP)
- **Region:** us-west-2

### Important Paths on EC2
| Path | Purpose |
|------|---------|
| `/home/ec2-user/.openclaw/openclaw.json` | Main OpenClaw config |
| `/home/ec2-user/.openclaw/workspace/` | Agent workspace (markdown files, skills) |
| `/home/ec2-user/.openclaw/workspace/mission-control/` | Mission Control Next.js app |
| `/home/ec2-user/.openclaw/memory/` | Memory storage |
| `/home/ec2-user/.openclaw/cron/` | Cron configs |
| `/home/ec2-user/.openclaw/logs/` | Log files |
| `/home/ec2-user/clawdbot/` | OpenClaw source code |

### Gateway API
- **Port:** 18789 (loopback only)
- **Protocol:** WebSocket, custom JSON frames (not JSON-RPC)
- **Auth:** Token-based (token in `openclaw.json` → `gateway.auth.token`)
- **Control UI auth:** `allowInsecureAuth: true` is set, so `openclaw-control-ui` can connect with token over HTTP on localhost

#### WebSocket Protocol
```
Server sends: { type: "event", event: "connect.challenge", payload: { nonce, ts } }
Client sends: { type: "req", id: "connect", method: "connect", params: { ...ConnectParams } }
Server sends: { type: "res", id: "connect", ok: true, payload: { type: "hello-ok", ... } }
Client sends: { type: "req", id: "x", method: "<method>", params: {...} }
Server sends: { type: "res", id: "x", ok: true, payload: {...} }
```

#### ConnectParams (for Mission Control)
```json
{
  "minProtocol": 3, "maxProtocol": 3,
  "client": { "id": "openclaw-control-ui", "displayName": "Mission Control", "version": "0.2.0", "platform": "linux", "mode": "backend" },
  "auth": { "token": "<gateway-token>" },
  "role": "operator",
  "scopes": ["operator.admin", "operator.read"]
}
```

#### Available Methods
| Method | Scope | Params | Returns |
|--------|-------|--------|---------|
| `health` | read | `{ probe?: boolean }` | System health snapshot |
| `sessions.list` | read | `{ limit?, sortBy?, sortOrder? }` | `{ sessions, total }` |
| `sessions.usage` | admin | `{ key?, startDate?, endDate?, limit? }` | Usage/cost with aggregates |
| `cron.list` | read | `{ includeDisabled?: boolean }` | `{ jobs }` |
| `cron.runs` | read | `{ id, limit? }` | `{ entries }` |
| `agents.list` | read | `{}` | `{ agents, defaultId }` |
| `channels.status` | read | `{ probe?: boolean }` | Channel connectivity |
| `usage.cost` | read | `{ startDate?, endDate? }` | Cost summary |

### Mission Control (Next.js dashboard)
- **Location:** `/home/ec2-user/.openclaw/workspace/mission-control/`
- **Framework:** Next.js 16, Tailwind CSS 4, no database
- **Port:** 3001 (production: `npm run start`)
- **Architecture:** Client-side pages → Next.js API routes → Gateway WebSocket
- **Gateway token:** Stored in `.env.local` on EC2 (server-side only)

#### Pages & Data Sources
| Page | API Route | Gateway Method |
|------|-----------|---------------|
| Home `/` | `/api/health`, `/api/sessions` | `health`, `sessions.list` |
| Tasks `/tasks` | `/api/sessions` | `sessions.list` |
| Pipeline `/pipeline` | `/api/sessions/usage` | `sessions.usage` |
| Calendar `/calendar` | `/api/cron`, `/api/cron/[id]/runs` | `cron.list`, `cron.runs` |
| Memory `/memory` | `/api/memory` | filesystem (workspace .md files) |
| Team `/team` | `/api/agents`, `/api/channels` | `agents.list`, `channels.status` |
| Office `/office` | `/api/system` | `os` module + `df` command |
| Activity `/activity` | `/api/sessions`, `/api/cron` | `sessions.list`, `cron.list` |

#### Rebuild & Deploy
```bash
ssh -i ~/.ssh/openclaw-key.pem ec2-user@34.216.126.0
cd /home/ec2-user/.openclaw/workspace/mission-control
kill $(pgrep -f next-server) 2>/dev/null
npm run build
nohup npm run start > prod.log 2>&1 &
```

### Network Notes
- EC2 security group may need IP allowlisting for SSH access
- Gateway binds to loopback only — Mission Control accesses it locally
