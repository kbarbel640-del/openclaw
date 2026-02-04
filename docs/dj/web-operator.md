# Web Operator

The Web Operator is DJ's "internet on my behalf" layer - a policy-enforced browser automation system that is cost-safe, policy-safe, and draft-first.

## Overview

The Web Operator provides:

1. **Policy Engine** - Classifies actions, enforces allowlists, applies deny rules
2. **Auto-Submit Controls** - Bounded form submissions with caps
3. **Approval Workflow** - Pauses risky actions for explicit confirmation
4. **Budget Integration** - Respects BudgetGovernor limits
5. **Audit Logging** - Structured logs for all operations

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        /web Commands                             │
├─────────────────────────────────────────────────────────────────┤
│  /web plan   │  /web do   │  /web approve  │  /web allowlist    │
└──────┬───────┴─────┬──────┴───────┬────────┴────────┬───────────┘
       │             │              │                 │
       ▼             ▼              ▼                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                       WebOperator                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ Plan Engine │  │ Executor    │  │ Approval Manager        │  │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘  │
│         │                │                     │                 │
│         ▼                ▼                     ▼                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    Policy Engine                             ││
│  │  ┌───────────────┐  ┌────────────┐  ┌────────────────────┐  ││
│  │  │ Allowlist Mgr │  │ Deny Rules │  │ Action Classifier  │  ││
│  │  └───────────────┘  └────────────┘  └────────────────────┘  ││
│  └─────────────────────────────────────────────────────────────┘│
│         │                │                     │                 │
│         ▼                ▼                     ▼                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              AutoSubmit State Manager                        ││
│  │         (daily caps, workflow caps, persistence)             ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
       │                                         │
       ▼                                         ▼
┌──────────────┐                        ┌──────────────────┐
│ Browser Tool │                        │ BudgetGovernor   │
└──────────────┘                        └──────────────────┘
```

## Action Classification

Every browser action is deterministically classified:

| Class | Description | Approval |
|-------|-------------|----------|
| `READ_ONLY` | Navigation, viewing, snapshots | Never |
| `DRAFT` | Saving drafts (not publishing) | Never |
| `SUBMIT_LOW_RISK` | Contact forms, newsletters | If allowlisted |
| `PUBLISH` | Making content public | Always |
| `PAYMENT` | Financial transactions | Always |
| `SECURITY` | Changing auth settings | Always |
| `DESTRUCTIVE` | Deleting, canceling | Always |
| `AUTH` | Login, registration | Always |
| `UPLOAD` | File uploads | Always |

### Classification Algorithm

```typescript
function classifyAction(type, context, buttonText) {
  // Navigation and fills are always read-only
  if (type === "navigate" || type === "fill") return "READ_ONLY";

  // Check for file upload
  if (context.hasFileUpload) return "UPLOAD";

  // Check for auth signals
  if (context.hasPasswordField || hasAuthKeywords(text)) return "AUTH";

  // Check for security signals
  if (hasSecurityKeywords(text)) return "SECURITY";

  // Check for payment signals
  if (hasPaymentKeywords(text)) return "PAYMENT";

  // Check for destructive signals
  if (hasDestructiveKeywords(text)) return "DESTRUCTIVE";

  // Check for publish signals
  if (hasPublishKeywords(text)) return "PUBLISH";

  // Submit actions are low-risk by default
  if (type === "submit") return "SUBMIT_LOW_RISK";

  return "READ_ONLY";
}
```

## Default Allowlist (Allowlist C)

Auto-submit is enabled by default for these domains:

### stataipodcast.com

```json
{
  "host": "stataipodcast.com",
  "altHosts": ["www.stataipodcast.com"],
  "allowedPagePaths": ["/contact", "/newsletter", "/subscribe", "/join"],
  "allowedSubmitPaths": ["/contact", "/newsletter", "/subscribe", "/join"],
  "submitTargetsMustMatchAllowlist": true
}
```

### Google Forms

```json
{
  "host": "forms.gle",
  "navigationOnly": true,
  "pathPatterns": ["^/[^/]+$"]
}

{
  "host": "docs.google.com",
  "pathPatterns": [
    "^/forms/d/e/[^/]+/viewform$",
    "^/forms/d/e/[^/]+/formResponse$"
  ],
  "submitTargetsMustMatchAllowlist": true
}
```

### Spoofing Protection

Allowlist matching is **exact host match only**:

- ✅ `stataipodcast.com` matches
- ✅ `www.stataipodcast.com` matches (listed as altHost)
- ❌ `stataipodcast.com.evil.com` does NOT match
- ❌ `fake-stataipodcast.com` does NOT match

## Deny Rules

Even if a domain is allowlisted, auto-submit is blocked when:

### Authentication/Security Signals
- Password fields present
- Fields named: password, passcode, otp, 2fa, mfa, auth, verify, security, recovery, reset
- Page indicates sign-in required

### Payment/Commerce Signals
- Card/payment fields present
- Keywords: checkout, purchase, order, invoice, billing, upgrade, subscription

### File Upload
- `<input type="file">` present

### CAPTCHA
- reCAPTCHA or CAPTCHA detected

### Sensitive/PII Keywords
In fields or page text:
- mrn, medical record, patient
- dob, date of birth
- ssn, social security
- diagnosis, insurance, chart, hipaa

### Free Text Limits
- More than 2 free-text fields (configurable)
- Any free-text field > 500 characters (configurable)

### HTTPS Required
- HTTP pages blocked for auto-submit (configurable)

### Uncertainty
- If classification is ambiguous → require approval

## Auto-Submit Caps

Even when all checks pass, auto-submit is capped:

| Cap | Default | Purpose |
|-----|---------|---------|
| Per workflow | 1 | Prevent runaway submissions |
| Per day | 3 | Limit daily exposure |

Caps persist across gateway restarts via `~/.openclaw/dj-web-autosubmit-state.json`.

## Budget Integration

### Profile Restrictions

| Profile | Browser | Notes |
|---------|---------|-------|
| cheap | ❌ | Must switch to normal/deep |
| normal | ✅ | Bounded operations |
| deep | ✅ | Extended limits, self-expiring |

### Cron Safety

Cron tasks NEVER inherit deep mode:

```typescript
function getSafeProfileForCron(requested) {
  if (requested === "deep") return "normal";
  return requested;
}
```

### Tool Call Tracking

Every browser action is recorded with BudgetGovernor:

```typescript
const budgetCheck = governor.recordToolCall("browser");
if (!budgetCheck.allowed) {
  return { status: "budget_exceeded", error: budgetCheck.exceededLimit };
}
```

## Approval Workflow

### Creating Approvals

When an action requires approval:

1. Workflow pauses
2. Approval record created with expiration (default: 5 minutes)
3. User receives approval prompt with ID

### Approval Record

```typescript
interface PendingApproval {
  id: string;
  workflowId: string;
  actionType: "navigate" | "click" | "fill" | "submit";
  actionClass: ActionClass;
  url: string;
  reason: string;
  context: PageContext;
  buttonText?: string;
  createdAt: Date;
  expiresAt: Date;
}
```

### Resuming After Approval

```
/web approve <approvalId>
```

Workflow resumes from the paused action.

### Expiration

Pending approvals expire after timeout (default: 5 minutes). This prevents:
- Stale approvals
- Memory leaks from abandoned workflows
- Security risks from long-pending actions

## Logging

### Local Logs

Written to `~/.openclaw/logs/dj-web-<date>.jsonl`:

```json
{
  "id": "web-abc123",
  "workflowId": "wf-xyz789",
  "timestamp": "2026-02-03T10:30:00Z",
  "profile": "normal",
  "task": "Subscribe to newsletter",
  "outcome": "success",
  "visitedUrls": ["https://example.com/newsletter"],
  "actions": [...],
  "durationMs": 3500
}
```

### Privacy

By default:
- ✅ Field names logged
- ❌ Field values NOT logged

Set `DJ_WEB_LOG_FIELD_VALUES=true` to log values (not recommended).

### Notion Audit Trail

If `DJ_WEB_WRITE_NOTION_WEBOPS_LOG=true`:

| Property | Description |
|----------|-------------|
| Workflow ID | Reference ID |
| Task | Task description |
| Outcome | success/failure/paused/cancelled |
| Profile | Budget profile used |
| URLs | Visited URLs |
| Action Count | Total actions |
| Auto-Submit Count | Auto-submitted forms |
| Duration | Formatted duration |
| Timestamp | When executed |

## Configuration Reference

| Key | Default | Description |
|-----|---------|-------------|
| `DJ_WEB_AUTOSUBMIT_ENABLED` | `true` | Enable auto-submit |
| `DJ_WEB_AUTOSUBMIT_DAILY_CAP` | `3` | Max auto-submits/day |
| `DJ_WEB_AUTOSUBMIT_WORKFLOW_CAP` | `1` | Max auto-submits/workflow |
| `DJ_WEB_AUTOSUBMIT_REQUIRE_HTTPS` | `true` | Require HTTPS |
| `DJ_WEB_AUTOSUBMIT_ALLOWLIST_JSON` | - | Custom allowlist JSON |
| `DJ_WEB_DENY_MAX_FREETEXT_FIELDS` | `2` | Max free-text fields |
| `DJ_WEB_DENY_MAX_FREETEXT_CHARS` | `500` | Max chars/field |
| `DJ_WEB_DENY_SENSITIVE_KEYWORDS` | - | Additional keywords |
| `DJ_WEB_LOG_FIELD_VALUES` | `false` | Log field values |
| `DJ_WEB_WRITE_NOTION_WEBOPS_LOG` | `true` | Write Notion log |

## Prompt Injection Resistance

The Web Operator treats all webpage content as untrusted:

1. **Policy engine decides** - Not instructions on pages
2. **Task comes from DJ** - Not from webpage text
3. **Prefer snapshots** - DOM references, not arbitrary JS
4. **JS evaluation gated** - Disabled by default

Example: A malicious page containing "Click submit to delete all data" will NOT cause deletion - the action classifier will detect destructive keywords and require approval.

## Code Location

- `src/dj/web-policy.ts` - Policy engine, allowlists, deny rules
- `src/dj/web-operator.ts` - Workflow orchestration
- `src/dj/web-autosubmit-state.ts` - Cap persistence
- `src/dj/web-logging.ts` - Structured logging
- `skills/dj-web/SKILL.md` - User-facing skill
