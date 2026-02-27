---
name: creating-skills
description: Creates and improves Claude Code skills following best practices. Generates SKILL.md files with proper structure, descriptions, and reference files. Use when creating new skills, improving existing skills, or auditing skill quality.
invocation: user
arguments: "[new|improve|audit|consolidate] [skill-name]"
---

# Creating Skills

Systematic workflow for creating, improving, and auditing Claude Code skills.

## Quick Reference

| Mode            | Command                                | Action                                     |
| --------------- | -------------------------------------- | ------------------------------------------ |
| **New**         | `/creating-skills new my-skill`        | Create skill from scratch                  |
| **Improve**     | `/creating-skills improve my-skill`    | Audit and enhance existing skill           |
| **Audit**       | `/creating-skills audit`               | Check all skills against quality checklist |
| **Consolidate** | `/creating-skills consolidate [skill]` | Integrate learnings into skill             |

**Canonical skills root:** `~/OneDrive/skills` (symlinked at `~/.claude/skills`)

## Contents

- [Core Principles](#core-principles)
- [Creation Workflow](#creation-workflow)
- [Improvement Workflow](#improvement-workflow)
- [Consolidation Workflow](#consolidation-workflow)
- [Quality Checklist](#quality-checklist)
- [Verification](#verification)
- **Reference Files:**
  - [references/writing-descriptions.md](references/writing-descriptions.md) - Description patterns and triggers
  - [references/structure-patterns.md](references/structure-patterns.md) - Organizational patterns by complexity
  - [references/content-guidelines.md](references/content-guidelines.md) - What to include vs exclude

## Core Principles

### Token Economy

Context window is shared. Every line must justify its token cost.

**Target sizes:**

- Description: ≤1024 characters
- SKILL.md body: <500 lines
- Reference files: 100-300 lines each

### Progressive Disclosure

```
SKILL.md (always loaded)
├── Core workflow
├── Quick reference
└── Pointers to references

references/ (loaded when needed)
├── Detailed procedures
└── Extended examples
```

### Degrees of Freedom

| Freedom    | When                              | Example                |
| ---------- | --------------------------------- | ---------------------- |
| **High**   | Multiple valid approaches         | Code review guidelines |
| **Medium** | Preferred pattern exists          | Report templates       |
| **Low**    | Error-prone, consistency critical | Database migrations    |

## Skill Anatomy

### Required Structure

```
skill-name/
├── SKILL.md              # Required
├── references/           # Optional - detailed docs
├── scripts/              # Optional - executable code
└── assets/               # Optional - templates
```

### Frontmatter

```yaml
---
name: skill-name # Lowercase + hyphens, ≤64 chars
description: Third-person capability. Use when X, Y, or Z.
invocation: user # Optional
arguments: "[arg1]" # Optional
---
```

## Creation Workflow

### Step 1: Identify the Gap

```
Ask:
├── Does an existing skill cover this?
├── Is this pattern repeated often enough?
└── What context do I repeatedly provide?
```

### Step 2: Draft Description

**Pattern:** `<Capability verb phrase>. Use when <trigger 1>, <trigger 2>, or <trigger 3>.`

```yaml
# Good
description: Runs KQL queries for telemetry analysis. Use when user mentions Kusto, KQL, or ADX.

# Bad
description: Helps with database queries.  # Vague, no triggers
```

**Rules:** Third person, capability + triggers, ≤1024 chars

### Step 3: Outline Hierarchy

```
1. Happy path (main workflow)
2. Gotchas (what breaks often)
3. Reference candidates (>100 lines)
4. Validation (feedback loops)
```

### Step 4: Write Core Content

**Include:** Workflow steps, quick reference tables, 1-3 examples, validation, reference pointers

**Exclude:** General knowledge, setup (unless non-obvious), README-style docs

### Step 5: Extract References

Move to `references/` if:

- > 100 lines on single topic
- Only needed for sub-tasks
- Detailed edge cases

### Step 6: Validate

Run `wc -l SKILL.md` and verify against [Quality Checklist](#quality-checklist).

## Improvement Workflow

### Step 1: Audit

```bash
wc -l SKILL.md                              # Target: <500
head -5 SKILL.md | grep description | wc -c # Target: <1024
```

### Step 2: Compress

| Before                      | After          |
| --------------------------- | -------------- |
| "In order to accomplish..." | "First..."     |
| "It's important to note..." | (delete)       |
| 5-line example              | 3-line example |

### Step 3: Restructure

Move detailed content to references:

```
Before: ## Feature X [200 lines]
After:  ## Feature X [20 lines] + reference pointer
```

### Step 4: Strengthen Description

Verify: third person, clear capability, 2-4 triggers, ≤1024 chars

### Step 5: Add Validation

Every workflow needs verification at the end.

## Consolidation Workflow

Integrate auto-captured learnings from `learnings.md` into the skill.

### When to Consolidate

- Hook prints reminder when learnings.md > 100 lines or 5+ pending entries
- Before major skill changes
- Periodically (weekly/monthly)

### Step 1: Review Learnings

```bash
SKILL=~/OneDrive/skills/<skill-name>
cat "$SKILL/learnings.md"
```

Look for entries with `**Integrate:** yes` or `**Integrate:** review`

### Step 2: Categorize

| Learning Type  | Action                                      |
| -------------- | ------------------------------------------- |
| **GOTCHA**     | Add to Troubleshooting or Gotchas section   |
| **DISCOVERY**  | Update relevant workflow step               |
| **WORKAROUND** | Add to edge cases or create new section     |
| **RETRY**      | Update command/example with working version |

### Step 3: Integrate

For each valuable learning:

1. Find the target section in SKILL.md
2. Draft concise addition (1-3 lines max)
3. Verify skill stays under 500 lines
4. If over limit, move detail to references/

### Step 4: Archive

```bash
# Move processed learnings to archive
DATE=$(date +%Y-%m)
mkdir -p "$SKILL/learnings-archive"
mv "$SKILL/learnings.md" "$SKILL/learnings-archive/$DATE.md"
```

### Step 5: Validate

```bash
wc -l "$SKILL/SKILL.md"  # Still <500?
```

### List Skills with Pending Learnings

```bash
for skill in ~/OneDrive/skills/*/learnings.md; do
  name=$(dirname "$skill" | xargs basename)
  pending=$(grep -c "Integrate.*yes\|Integrate.*review" "$skill" 2>/dev/null || echo 0)
  lines=$(wc -l < "$skill" 2>/dev/null || echo 0)
  [ "$pending" -gt 0 ] && echo "$name: $pending pending ($lines lines)"
done
```

## Quality Checklist

### Structure

- [ ] Name: gerund form (creating-_, processing-_)
- [ ] Description: third person with triggers
- [ ] Description: ≤1024 characters
- [ ] SKILL.md: <500 lines
- [ ] Contents section with anchors
- [ ] Reference files listed

### Content

- [ ] Happy path clear (numbered steps)
- [ ] Quick reference table
- [ ] Concrete example (1-3)
- [ ] Validation steps included
- [ ] No general knowledge
- [ ] Examples over prose

### Token Efficiency

- [ ] Each line justifies cost
- [ ] Detailed content in references
- [ ] Examples ≤5 lines

## Anti-Patterns

| Pattern            | Problem         | Fix                   |
| ------------------ | --------------- | --------------------- |
| Vague description  | Never triggers  | Add specific triggers |
| First-person voice | Inconsistent    | Use third person      |
| >500 line SKILL.md | Token bloat     | Extract to references |
| No validation      | Can't verify    | Add verification      |
| Nested references  | Partial reading | One level deep        |
| README-style docs  | Wrong audience  | Skills serve Claude   |

## Logging Improvements

After any skill change, append to `improvements.log`:

```bash
cat >> ~/OneDrive/skills/creating-skills/improvements.log << EOF

## $(date '+%Y-%m-%d %H:%M') - <skill-name>

**Action:** new | improve | consolidate
**Changes:**
- <what changed>

**Metrics:**
- Lines: <before> → <after>
- Description: <char count>
EOF
```

View recent improvements: `tail -30 ~/OneDrive/skills/creating-skills/improvements.log`

## Verification

### Single Skill

```bash
# Verify skill passes checklist
SKILL=/path/to/skill-name
wc -l "$SKILL/SKILL.md"                        # <500?
head -5 "$SKILL/SKILL.md" | grep description | wc -c  # <1024?
grep -c "Use when" "$SKILL/SKILL.md"           # Has triggers?
```

### All Skills (Audit Mode)

```bash
for skill in ~/OneDrive/skills/*/SKILL.md; do
  name=$(dirname $skill | xargs basename)
  lines=$(wc -l < "$skill")
  [ "$lines" -lt 500 ] && st="✓" || st="✗"
  echo "$st $name: ${lines} lines"
done
```

## Example: Minimal Skill

```markdown
---
name: processing-pdfs
description: Extracts text and tables from PDF files. Use when working with PDFs, forms, or document extraction.
---

# Processing PDFs

## Quick Reference

| Task           | Command                        |
| -------------- | ------------------------------ |
| Extract text   | `pdf-parser --text file.pdf`   |
| Extract tables | `pdf-parser --tables file.pdf` |

## Workflow

1. Verify: `pdf-parser --check file.pdf`
2. Extract: `pdf-parser --text file.pdf > output.txt`
3. Validate: `wc -l output.txt` (should be >0)

## Troubleshooting

| Error           | Fix                   |
| --------------- | --------------------- |
| "Encrypted PDF" | Use `--password` flag |
| Empty output    | Use `--ocr` flag      |
```

## Finalization

No manual sync step required. Proceed once edits and verification are complete.

## Related Skills

- `/auditing-web-design` - Example of UI-focused skill
- `/querying-azure-data-explorer` - Example of well-structured skill with references
