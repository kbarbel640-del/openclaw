# Verification Checklist (Draft v0.1)

## Infra
- [ ] Cloud Run services deployed (control-api, runtime-api)
- [ ] Cloud SQL reachable from Cloud Run
- [ ] Storage bucket created

## Auth
- [ ] Login works
- [ ] Token required for protected endpoints

## State
- [ ] sessions can be listed
- [ ] config update persists
- [ ] cron job create/update persists

## Node
- [ ] node-host registers with control-api
- [ ] path map applied (logical -> physical)
- [ ] runs complete and session updated

## Channels
- [ ] Telegram messages flow end-to-end
- [ ] LINE messages flow end-to-end

