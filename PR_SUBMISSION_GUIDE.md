# AbacusAI Auth Plugin — PR Submission Step-by-Step Guide

This guide walks you through the complete process of submitting the `abacusai-auth`
extension to the OpenClaw GitHub repository (`https://github.com/openclaw/openclaw`).

---

## Prerequisites

1. **GitHub account** — you need one to fork and submit PRs
2. **Git** installed and configured with your GitHub credentials
3. **Node.js ≥ 22** and **pnpm** installed
4. Your local clone at `D:\App_Make\openclaw` with all changes ready

---

## Step 1: Fork the Repository

Since you don't have write access to `openclaw/openclaw`, you need to fork it:

1. Go to https://github.com/openclaw/openclaw
2. Click the **Fork** button (top-right)
3. This creates `https://github.com/<your-username>/openclaw`

Then add your fork as a remote:

```powershell
cd D:\App_Make\openclaw
git remote add myfork https://github.com/<your-username>/openclaw.git
```

Verify remotes:

```powershell
git remote -v
# origin   https://github.com/openclaw/openclaw.git (fetch/push)  ← upstream
# myfork   https://github.com/<your-username>/openclaw.git (fetch/push)  ← your fork
```

---

## Step 2: Create a Feature Branch

```powershell
# Make sure you're on the latest main
git checkout main
git pull origin main

# Create a feature branch
git checkout -b feat/abacusai-auth-plugin
```

---

## Step 3: Stage Only the Required Files

**Important**: Do NOT stage the 4 excluded files (`SPECIFICATION.md`,
`DEVELOPMENT_ROADMAP.md`, `IMPLEMENTED.md`, `WORK_LOG.md`) or the PR report files.

Stage files individually:

```powershell
# New extension files
git add extensions/abacusai-auth/index.ts
git add extensions/abacusai-auth/package.json
git add extensions/abacusai-auth/openclaw.plugin.json
git add extensions/abacusai-auth/README.md

# New onboarding handler
git add src/commands/auth-choice.apply.abacusai.ts

# Modified core files
git add src/commands/auth-choice-options.ts
git add src/commands/auth-choice.apply.ts
git add src/commands/onboard-types.ts

# Lock file
git add pnpm-lock.yaml
```

Verify what's staged:

```powershell
git status
```

You should see:

```
Changes to be committed:
  new file:   extensions/abacusai-auth/index.ts
  new file:   extensions/abacusai-auth/package.json
  new file:   extensions/abacusai-auth/openclaw.plugin.json
  new file:   extensions/abacusai-auth/README.md
  new file:   src/commands/auth-choice.apply.abacusai.ts
  modified:   src/commands/auth-choice-options.ts
  modified:   src/commands/auth-choice.apply.ts
  modified:   src/commands/onboard-types.ts
  modified:   pnpm-lock.yaml

Untracked files:
  docs/DEVELOPMENT_ROADMAP.md        ← NOT staged (correct)
  docs/IMPLEMENTED.md                ← NOT staged (correct)
  docs/SPECIFICATION.md              ← NOT staged (correct)
  logs/                              ← NOT staged (correct)
  PR_SUBMISSION_REPORT.md            ← NOT staged (correct)
  PR_SUBMISSION_GUIDE.md             ← NOT staged (correct)
```

---

## Step 4: Run Validation Commands

The project requires these checks to pass before submitting:

```powershell
# Build
pnpm build

# Lint and format
pnpm check

# Run tests
pnpm test
```

All must pass. Expected output:

```
Test Files  77 passed (77)
     Tests  902 passed | 1 skipped (903)
```

---

## Step 5: Commit

Follow the project's commit message convention (verb + scope + outcome):

```powershell
git commit -m "Extensions: add AbacusAI provider plugin with embedded RouteLLM proxy"
```

---

## Step 6: Push to Your Fork

```powershell
git push myfork feat/abacusai-auth-plugin
```

---

## Step 7: Create the Pull Request

1. Go to https://github.com/<your-username>/openclaw
2. You'll see a banner: **"feat/abacusai-auth-plugin had recent pushes"** → click
   **Compare & pull request**
3. Set:
   - **Base repository**: `openclaw/openclaw`
   - **Base branch**: `main`
   - **Head repository**: `<your-username>/openclaw`
   - **Head branch**: `feat/abacusai-auth-plugin`
4. **Title**: `Extensions: add AbacusAI provider plugin with embedded RouteLLM proxy`
5. **Description**: Copy the content from `PR_SUBMISSION_REPORT.md` into the PR body
6. Click **Create pull request**

---

## Step 8: Post-Submission Checklist

After creating the PR:

- [ ] Verify all CI checks pass (GitHub Actions will run automatically)
- [ ] Respond to reviewer comments promptly
- [ ] If changes are requested, make them on the same branch and push:
  ```powershell
  # Make changes...
  git add <changed-files>
  git commit -m "Address review feedback: <description>"
  git push myfork feat/abacusai-auth-plugin
  ```
- [ ] The PR will update automatically

---

## What Reviewers Will Look For

Based on the project's PR guide (`docs/help/submitting-a-pr.md`):

1. **Clear problem/intent** — ✅ covered in Summary section
2. **Focused scope** — ✅ only AbacusAI-related changes, no unrelated refactors
3. **Behavior changes listed** — ✅ detailed table in report
4. **Test results** — ✅ 77/77 passed, 902 tests
5. **No secrets/private data** — ✅ all PII scrubbed
6. **Evidence-based claims** — ✅ build output, test output, proxy verification
7. **Code word** — ✅ "lobster-biscuit" included in PR description

---

## Potential Reviewer Questions and Answers

### Q: Why a local proxy instead of direct API calls?

AbacusAI's RouteLLM endpoint has three protocol deviations from the OpenAI
standard that break the Agent's tool-calling pipeline:

1. Rejects `strict` in tool schemas
2. Returns Anthropic-style `finish_reason` values
3. Non-standard SSE streaming (no newline delimiters between chunks)

A local proxy fixes all three transparently without modifying core OpenClaw code.

### Q: Why not use the `gateway_start` hook?

The `gateway_start` hook is defined in the type system (`src/plugins/types.ts`)
and hook runner (`src/plugins/hooks.ts`), but `runGatewayStart()` is never
actually called by the gateway startup code. The proxy instead starts
asynchronously in `register()` which fires when the gateway loads plugins.

### Q: What happens if the AbacusAI API key expires?

Two layers of detection:

1. **At startup**: `ensureProxy()` validates the key via `describeUser` before
   starting. If invalid, a clear error message guides the user to re-authenticate.
2. **At runtime**: 401/403 responses from upstream are caught and returned as
   `auth_expired` errors with actionable guidance.

### Q: Does this affect existing providers?

No. All changes are additive. The plugin is disabled by default and must be
explicitly enabled with `openclaw plugins enable abacusai-auth`.

### Q: Should `.github/labeler.yml` be updated?

Yes. The PR report includes a suggested addition. This can be included in the
same PR or as a follow-up.

---

## Optional: Add Labeler Entry

If the maintainers want it in the same PR, add to `.github/labeler.yml`:

```yaml
"extensions: abacusai-auth":
  - changed-files:
      - any-glob-to-any-file:
          - "extensions/abacusai-auth/**"
```

Stage and amend the commit:

```powershell
git add .github/labeler.yml
git commit --amend --no-edit
git push myfork feat/abacusai-auth-plugin --force-with-lease
```

---

## Optional: Add Changelog Entry

If the maintainers want it in the same PR, add to the top section of `CHANGELOG.md`:

```markdown
- Extensions: add AbacusAI provider plugin with embedded RouteLLM proxy, SSE streaming
  normalization, finish_reason mapping, 3-tier credential auto-detection, and onboarding
  integration. Supports 16+ models (Claude, Gemini, GPT, DeepSeek, Qwen, Grok, Kimi).
  (#XXXX) Thanks @<your-github-username>.
```

---

## Summary of Files to Commit

| #   | File                                            | Status   | Lines            |
| --- | ----------------------------------------------- | -------- | ---------------- |
| 1   | `extensions/abacusai-auth/index.ts`             | New      | ~800             |
| 2   | `extensions/abacusai-auth/package.json`         | New      | 15               |
| 3   | `extensions/abacusai-auth/openclaw.plugin.json` | New      | 10               |
| 4   | `extensions/abacusai-auth/README.md`            | New      | 460              |
| 5   | `src/commands/auth-choice.apply.abacusai.ts`    | New      | 15               |
| 6   | `src/commands/auth-choice-options.ts`           | Modified | +13              |
| 7   | `src/commands/auth-choice.apply.ts`             | Modified | +2               |
| 8   | `src/commands/onboard-types.ts`                 | Modified | +2               |
| 9   | `pnpm-lock.yaml`                                | Modified | +6               |
|     | **Total new code**                              |          | **~1,300 lines** |
