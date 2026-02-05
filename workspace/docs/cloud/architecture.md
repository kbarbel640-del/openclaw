# OpenClaw Cloud Architecture (Draft v0.1)

## Goals
- Node is stateless: any machine can join and run without local state.
- State is centralized: sessions/configs/cron/auth/memory live in cloud.
- Paths are portable: no hardcoded absolute paths in stored memory.

## Components
1. control-api (Cloud Run)
   - Auth, config management, agent/session registry
   - Path Map policies
   - Health + audit endpoints

2. runtime-api (Cloud Run)
   - Executes agent runs
   - Receives run requests from nodes
   - Reads/writes session state in Cloud SQL
   - Streams partial replies to node

3. node-host (local, ephemeral)
   - Connects to control-api
   - Runs tools (browser, filesystem, docker, etc.)
   - Writes no durable state (cache only)

4. Cloud SQL (PostgreSQL)
   - Authoritative store for sessions/memory/config/cron/auth

5. Cloud Storage
   - Large artifacts/media/logs

## Data Flow
User/Channel -> node-host -> runtime-api -> Cloud SQL (persist)
                                     -> control-api (config)
                                     -> GCS (media/logs)

## Security
- Service account for control/runtime
- Row-level scoping by ownerId/orgId
- Sensitive fields encrypted at rest (tokens, API keys)

## Environments
- stg and prod separated by project or database schema

