# Control + Runtime API (Draft v0.1)

## Auth
- POST /auth/login
- POST /auth/logout
- GET /auth/me

## Control API
- GET /agents
- GET /agents/:agentKey
- PUT /agents/:agentKey (config update)
- GET /sessions
- GET /sessions/:sessionKey
- POST /sessions/:sessionKey/reset
- GET /cron
- PUT /cron/:id
- POST /cron

## Runtime API
- POST /run
  body: { sessionKey, agentKey, prompt, context, toolsEnabled }
  returns: { runId }
- GET /run/:runId/stream (SSE / WS)
- POST /run/:runId/complete

## Node Registration
- POST /nodes/register
  body: { nodeId, pathMap, capabilities }
- POST /nodes/heartbeat

## Storage
- POST /media/upload
- GET /media/:id

