# MVP Spec (Draft v0.1)

## MVP Definition
- Any machine can login and resume Wuji without copying local state.

## Must-Haves
1. State in Cloud SQL (sessions/config/memory/cron/auth)
2. Path Map conversion in persistent records
3. Node loads config from control-api at boot
4. Web login + session list

## Out of Scope
- Multi-tenant billing
- Full UI management
- Public sharing links

## Success Criteria
- New machine can run node-host, login, and respond in Telegram/LINE
- Existing session continuity preserved

