# File Organization Guide

## Root Directory Structure

The project root (`/`) maintains a clean structure with only essential files:

### Always in Root
- `README.md` - Project overview and main documentation
- `CHANGELOG.md` - Version history and release notes
- `AGENTS.md` - Guidelines and instructions for coding agents
- `CLAUDE.md` - Claude-specific agent instructions

### Organized in Docs/

All investigation, analysis, and summary files are organized in the `docs/` directory:

```
docs/
├── investigations/    # Time-bound technical investigations
├── analyses/         # Architecture and system analyses
├── summaries/        # Fix documentation and reports
└── guides/           # User and developer guides
```

## Understanding Each Directory

### 📂 `docs/investigations/`

**Purpose**: Technical investigations using TDD methodology with specific findings and resolutions.

**When to use**: Debugging complex issues, root cause analysis, documenting failure scenarios.

**Naming**: `{topic}-{type}-YYYY-MM-DD.md`
- `topic`: What was investigated
- `type`: `detailed` (full TDD) or `summary` (executive overview)
- `date`: Completion date

**Examples**:
- `deep-research-publish-fix-2025-01-03.md`
- `linux-sdk-auth-detailed-2025-12-30.md`
- `telegram-bot-fix-2025-12-30.md`

### 📂 `docs/analyses/`

**Purpose**: In-depth technical analysis of architecture, design decisions, and system evaluations.

**When to use**: Evaluating architectural changes, assessing technical debt, planning migrations.

**Naming**: `{topic}-{focus}-YYYY-MM-DD.md`
- `topic`: What was analyzed
- `focus`: Specific aspect (stability, performance, security)
- `date`: Completion date

**Examples**:
- `dockerization-stability-2025-12-31.md`

### 📂 `docs/summaries/`

**Purpose**: Fix documentation, reliability reports, and implementation summaries.

**When to use**: Documenting completed fixes, recording incident resolutions, creating post-mortems.

**Naming**: `{system}-fix-summary-YYYY-MM-DD.md` or `{system}-reliability-fix-YYYY-MM-DD.md`

**Examples**:
- `reliability-fixes-2025-12-31.md`
- `telegram-reliability-fix-2025-12-31.md`

### 📂 `docs/guides/`

**Purpose**: User guides, developer documentation, and operational procedures.

**When to use**: Creating user-facing documentation, operational runbooks, development guides.

**Naming**: Use clear, descriptive names that indicate the guide's purpose.

## Moving Files

When adding new investigation, analysis, or summary files:

1. **Choose the right directory** based on the file's purpose
2. **Name with date** for chronological sorting
3. **Update the directory's README.md** if needed
4. **Cross-link related files** (e.g., link summary to detailed investigation)

## Root Directory Maintenance

Keep the root clean:
- ✅ Keep: README.md, CHANGELOG.md, AGENTS.md, CLAUDE.md
- ✅ Remove: Investigation files, analysis reports, fix summaries
- ✅ Organize: Move to appropriate docs/ subdirectory

## Benefits

- **Discoverability**: All investigations in one place
- **Chronological**: Dates in filenames for easy timeline tracking
- **Clean root**: Only essential files remain
- **Consistent**: Follows existing project conventions
- **Maintainable**: Clear structure for future additions