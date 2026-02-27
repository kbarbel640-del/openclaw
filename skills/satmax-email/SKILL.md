---
name: satmax-email
description: Manages Max's email inbox at max@klabo.world via SATMAX CLI and JMAP. Use when checking email, sending messages, waiting for replies, or managing Max's email identity.
invocation: user
arguments: "[inbox|read|send|reply|wait|check]"
---

# SATMAX Email

Operate Max's email (max@klabo.world) through the `satmax email` CLI. All commands output JSON.

## Quick Reference

| Task           | Command                                                        |
| -------------- | -------------------------------------------------------------- |
| List inbox     | `satmax email inbox --limit 10`                                |
| Read email     | `satmax email read <id>`                                       |
| Send email     | `satmax email send --to <addr> --subject "..." --body "..."`   |
| Reply          | `satmax email reply <id> --body "..."`                         |
| Wait for email | `satmax email wait --from <addr> --subject "..." --timeout 5m` |

## Infrastructure

| Component | Detail                                                   |
| --------- | -------------------------------------------------------- |
| Account   | max@klabo.world                                          |
| Server    | Stalwart on mail.klabo.world (Azure VM 172.185.89.35)    |
| Protocol  | JMAP (REST/JSON) via `/.well-known/jmap`                 |
| DKIM      | Ed25519 (202602e) + RSA (202602r)                        |
| DNS       | Cloudflare (A, MX, SPF, DMARC, DKIM TXT records)         |
| Azure RG  | satmax-mail-rg                                           |
| Creds     | 1Password Agents vault: "SATMAX Email - max@klabo.world" |
| Admin     | 1Password Agents vault: "SATMAX Mail Server"             |

## Workflow: Check Inbox

1. Run: `satmax email inbox --limit 10`
2. Scan for bounties, Lightning opportunities, and earning-related emails
3. Read interesting ones: `satmax email read <id>`
4. Reply or flag for human review

## Workflow: Send Email

```bash
satmax email send \
  --to "recipient@example.com" \
  --subject "Subject line" \
  --body "Message body. Sign as Max (SATMAX Agent)."
```

Verify: check the output is `{"ok":true}`.

## Workflow: Wait for Reply

Block until an email matching criteria arrives (or timeout):

```bash
satmax email wait \
  --from "sender@example.com" \
  --subject "keyword" \
  --timeout 5m \
  --poll 10s
```

- `--from` and `--subject` are substring matches (case-insensitive)
- Returns the matching email as JSON, or errors on timeout
- Use this instead of manual polling loops

## Troubleshooting

| Problem                       | Fix                                                                              |
| ----------------------------- | -------------------------------------------------------------------------------- |
| "email not configured"        | Check `~/.satmax/satmax.yaml` has `email.jmap_url` set (use underscored keys)    |
| JMAP 401                      | Verify username/password in satmax.yaml match 1Password                          |
| JMAP 404 on `/jmap`           | URL must be `https://mail.klabo.world/.well-known/jmap` (not `/jmap`)            |
| TLS cert error                | Check ACME: Stalwart admin > Settings > TLS > ACME Providers                     |
| Send succeeds but no delivery | Check DKIM/SPF DNS records; verify with `dig 202602e._domainkey.klabo.world TXT` |
| Stalwart down                 | `ssh honkbox "ssh azureuser@172.185.89.35 'sudo docker ps'"`                     |
| Restart Stalwart              | `ssh honkbox "ssh azureuser@172.185.89.35 'sudo docker restart stalwart'"`       |

## Rules for Email Agent

- Check inbox at the start of each session
- Prioritize emails about bounties, Lightning, and earning opportunities
- Reply professionally, sign as "Max (SATMAX Agent)"
- Never send more than 10 emails per session
- Flag important emails for human review
- Use `satmax email wait` to poll for expected replies instead of manual loops

## Config (satmax.yaml)

```yaml
email:
  jmap_url: "https://mail.klabo.world/.well-known/jmap"
  username: "max@klabo.world"
  password: "<from 1Password>"
  from: "max@klabo.world"
```

**Gotcha:** Always use underscored YAML keys (`jmap_url`, not `jmapurl`). Viper's `WriteConfig` outputs without underscores, but `mapstructure` tags require them.

## Server Admin

- Admin UI: `http://172.185.89.35:8080` (creds in 1Password "SATMAX Mail Server")
- Docker: `ssh honkbox "ssh azureuser@172.185.89.35 'sudo docker logs stalwart 2>&1 | tail -20'"`
- DKIM DNS records: `curl -s -u admin:<pass> http://172.185.89.35:8080/api/dns/records/klabo.world`

## Validation

```bash
# Inbox works
satmax email inbox --limit 1

# Send works
satmax email send --to "test@example.com" --subject "Test" --body "Hello"

# DKIM/SPF pass (check received email headers)
# Look for: dkim=pass, spf=pass

# DNS records
dig +short mail.klabo.world A           # → 172.185.89.35
dig +short klabo.world MX               # → 10 mail.klabo.world.
dig +short 202602e._domainkey.klabo.world TXT  # → DKIM public key
```
