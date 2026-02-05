# Errors

Command failures, API errors, and unexpected behaviors.

**Areas**: frontend | backend | infra | tests | docs | config | agent
**Statuses**: pending | in_progress | resolved | wont_fix

---

## [ERR-20260203-001] cloudflared_oauth

**Logged**: 2026-02-03T20:00:00-03:00
**Priority**: medium
**Status**: resolved
**Area**: infra

### Summary

Cloudflare Quick Tunnel требует интерактивный браузер

### Error

```
cloudflared tunnel через exec открывает OAuth в браузере — не работает без GUI
```

### Context

- Попытка создать tunnel для webhook
- exec не поддерживает интерактивный OAuth flow

### Suggested Fix

Для Cloudflare туннелей — либо named tunnel с pre-auth, либо ngrok (не требует браузер)

### Metadata

- Reproducible: yes
- Tags: cloudflare, tunnel, oauth

### Resolution

- **Resolved**: 2026-02-03T20:30:00-03:00
- **Notes**: Использовать ngrok или pre-configured named tunnels

---
