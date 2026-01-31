---
summary: "CLI reference for `openclaw skills` (list/info/check/audit) and skill eligibility"
read_when:
  - You want to see which skills are available and ready to run
  - You want to debug missing binaries/env/config for skills
  - You want to audit skill permissions and security
title: "skills"
---

# `openclaw skills`

Inspect skills (bundled + workspace + managed overrides) and see what's eligible vs missing requirements.

Related:

- Skills system: [Skills](/tools/skills)
- Skills config: [Skills config](/tools/skills-config)
- Skill permissions: [Permissions](/cli/skills-permissions)
- ClawHub installs: [ClawHub](/tools/clawhub)

## Commands

```bash
openclaw skills list
openclaw skills list --eligible
openclaw skills info <name>
openclaw skills check
openclaw skills audit
openclaw skills audit <name>
openclaw skills init-manifest <name>
```

## Permission Auditing

The `audit` command shows permission manifests and security risk levels for skills:

```bash
# Audit all skills
openclaw skills audit

# Show only high-risk or above
openclaw skills audit --risk-level high

# Audit a specific skill in detail
openclaw skills audit github

# Output as JSON
openclaw skills audit --json
```

## Generating Manifests

The `init-manifest` command generates a permission manifest template:

```bash
# Output template to stdout
openclaw skills init-manifest my-skill

# Write to a file
openclaw skills init-manifest my-skill -o permissions.yaml
```

See [Skill Permissions](/cli/skills-permissions) for the full manifest format.
