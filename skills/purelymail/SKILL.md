---
name: purelymail
description: Set up and test PurelyMail email for Clawdbot agents. Generate configs, test IMAP/SMTP, verify inbox connectivity.
homepage: https://purelymail.com
metadata:
  clawdhub:
    emoji: "📬"
    requires:
      bins: ["python3"]
      env: ["PURELYMAIL_API_KEY"]
---

# PurelyMail Admin API

Manage domains, users, and routing for PurelyMail via API.

## Setup

**API Key** is stored in 1Password: `moltbot skill: purelymail admin api`

To use directly, set:
```bash
export PURELYMAIL_API_KEY="pm-live-..."
```

Or the script will attempt to fetch from 1Password via op-safe tmux session.

## Admin CLI Commands

```bash
# List all domains with DNS status
uv run {baseDir}/scripts/purelymail-admin.py domains

# Add a new domain
uv run {baseDir}/scripts/purelymail-admin.py add-domain nothockney.com

# List all users (grouped by domain)
uv run {baseDir}/scripts/purelymail-admin.py users

# Create a new user/mailbox
uv run {baseDir}/scripts/purelymail-admin.py create-user hello@nothockney.com
uv run {baseDir}/scripts/purelymail-admin.py create-user noreply@nothockney.com --password "SecurePass123!"

# Delete a user
uv run {baseDir}/scripts/purelymail-admin.py delete-user old@example.com

# List routing rules
uv run {baseDir}/scripts/purelymail-admin.py routing

# Add routing rule (catchall)
uv run {baseDir}/scripts/purelymail-admin.py add-routing example.com --catchall --targets admin@example.com

# FULL PROJECT SETUP (domain + noreply + hello users)
uv run {baseDir}/scripts/purelymail-admin.py setup-project nothockney.com
uv run {baseDir}/scripts/purelymail-admin.py setup-project nothockney.com --users noreply hello support
```

## Project Incubation Workflow

When starting a new DBH Ventures project:

```bash
# 1. Set up email for the project
uv run {baseDir}/scripts/purelymail-admin.py setup-project newproject.com

# Output includes:
# - Domain added (if needed)
# - noreply@newproject.com created with password
# - hello@newproject.com created with password
# - DNS records needed
```

## DNS Records Needed

After adding a domain, configure these DNS records:

| Type | Name | Value |
|------|------|-------|
| MX | @ | mx.purelymail.com (priority 10) |
| TXT | @ | v=spf1 include:_spf.purelymail.com ~all |
| TXT | _dmarc | v=DMARC1; p=quarantine; rua=mailto:dmarc@purelymail.com |
| CNAME | purelymail._domainkey | (check dashboard for domain-specific value) |

## API Reference

Base URL: `https://purelymail.com/api/v0`
Auth: `Purelymail-Api-Token: <api_key>` header
Method: All endpoints use POST with JSON body

### Endpoints

| Endpoint | Description |
|----------|-------------|
| `listDomains` | List all domains with DNS status |
| `addDomain` | Add a domain (`{"domainName": "..."}`) |
| `listUser` | List all users |
| `createUser` | Create user (`{userName, domainName, password, ...}`) |
| `deleteUser` | Delete user (`{userName, domainName}`) |
| `listRoutingRules` | List routing rules |
| `addRoutingRule` | Add routing rule |

### Create User Schema

```json
{
  "userName": "hello",
  "domainName": "example.com",
  "password": "SecurePassword123!",
  "enablePasswordReset": true,
  "recoveryEmail": "recovery@other.com",
  "enableSearchIndexing": true,
  "sendWelcomeEmail": false
}
```

## Existing Domains

Current domains in the account:
- savestate.dev
- meshguard.app
- withagency.ai
- customcanvascurators.com
- findzion.com
- salesaide.app

## IMAP/SMTP Settings

| Setting | Value |
|---------|-------|
| IMAP Server | imap.purelymail.com |
| IMAP Port | 993 (SSL) |
| SMTP Server | smtp.purelymail.com |
| SMTP Port | 465 (SSL) or 587 (STARTTLS) |

## Tips

- Use `setup-project` for new DBH Ventures incubations
- Passwords are auto-generated if not specified (16 chars, mixed)
- Save credentials immediately - they can't be retrieved later
- DNS propagation takes 5-60 minutes after adding records
