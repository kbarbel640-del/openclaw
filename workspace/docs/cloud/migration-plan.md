# Migration Plan (Draft v0.1)

## Phase 1: Snapshot
- Freeze writes
- Export local .openclaw state
- Transform paths to logical paths

## Phase 2: Import
- Load configs, sessions, cron, memory to Cloud SQL
- Upload media/logs to GCS

## Phase 3: Cutover
- Point node-host to control-api
- Validate session continuity
- Resume message processing

