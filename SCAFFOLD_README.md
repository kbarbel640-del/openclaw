# OpenClaw Development Scripts - Scaffolding Guide

## 📦 Scaffolded Scripts

This repository has been scaffolded with essential development scripts from [`jleechanorg/claude-commands`](https://github.com/jleechanorg/claude-commands).

### Root Level Scripts

- **`create_worktree.sh`** (4.9K) - Create git worktrees for parallel branch work
- **`integrate.sh`** (28K) - Intelligent branch integration and merge conflict resolution
- **`schedule_branch_work.sh`** (6.9K) - Schedule and manage branch-based development tasks

### Scripts Directory (`scripts/`)

#### Linting & Quality
- **`run_lint.sh`** - ✨ **Adapted for OpenClaw TypeScript/Node.js stack**
  - Runs oxlint, oxfmt, TypeScript type-checking, SwiftLint, and documentation linting
  - Usage: `./scripts/run_lint.sh` or `./scripts/run_lint.sh fix`
  - NPM shortcut: `pnpm scaffold:lint` or `pnpm scaffold:lint:fix`

#### Testing & Coverage
- **`run_tests_with_coverage.sh`** - ✨ **Adapted for OpenClaw vitest testing**
  - Runs vitest tests with coverage reporting
  - Modes: `all`, `unit`, `e2e`, `fast`, `coverage`, `docker`
  - Usage: `./scripts/run_tests_with_coverage.sh [mode]`
  - NPM shortcuts:
    - `pnpm scaffold:test` - All tests with coverage
    - `pnpm scaffold:test:unit` - Unit tests only
    - `pnpm scaffold:test:e2e` - E2E tests only
    - `pnpm scaffold:test:coverage` - Coverage-focused run

#### Code Metrics
- **`loc.sh`** - Lines of code analysis
- **`loc_simple.sh`** - Simple LOC counter
- **`codebase_loc.sh`** - Comprehensive codebase statistics
- **`coverage.sh`** - Coverage report generation and analysis

#### Development Utilities
- **`push.sh`** - Smart git push with validation
- **`resolve_conflicts.sh`** - Automated merge conflict resolution
- **`create_snapshot.sh`** - Create project snapshots for backup/restore
- **`setup_email.sh`** - Configure git email settings
- **`sync_branch.sh`** - Sync branch with upstream
- **`setup-github-runner.sh`** - Set up GitHub Actions self-hosted runner

## 🎯 OpenClaw-Specific Adaptations

The scaffolded scripts have been intelligently adapted for OpenClaw's technology stack:

### Technology Stack Detected
- **Runtime**: Node.js (≥22)
- **Language**: TypeScript
- **Package Manager**: pnpm
- **Test Framework**: vitest
- **Linting**: oxlint (type-aware)
- **Formatting**: oxfmt
- **Additional**: SwiftLint (iOS/macOS), markdownlint (docs)

### Key Adaptations

#### `run_lint.sh`
**Original**: Python-focused (ruff, isort, mypy, bandit)
**Adapted for OpenClaw**:
- ✅ oxlint with type-awareness (`pnpm lint`)
- ✅ oxfmt formatting (`pnpm format`)
- ✅ TypeScript compilation check (`pnpm tsgo`)
- ✅ SwiftLint for iOS/macOS code (`pnpm lint:swift`)
- ✅ Markdown/docs linting (`pnpm lint:docs`)

#### `run_tests_with_coverage.sh`
**Original**: pytest with coverage.py
**Adapted for OpenClaw**:
- ✅ vitest test runner
- ✅ Multiple test modes (unit, e2e, fast, docker)
- ✅ Coverage reporting with vitest
- ✅ Integration with existing test scripts
- ✅ Coverage threshold checking

## 🚀 Quick Start

### Running Linting

```bash
# Check all linting rules
./scripts/run_lint.sh

# Auto-fix issues
./scripts/run_lint.sh fix

# Or use npm shortcuts
pnpm scaffold:lint
pnpm scaffold:lint:fix
```

### Running Tests with Coverage

```bash
# All tests with coverage
./scripts/run_tests_with_coverage.sh

# Unit tests only
./scripts/run_tests_with_coverage.sh unit

# E2E tests only
./scripts/run_tests_with_coverage.sh e2e

# Fast mode
./scripts/run_tests_with_coverage.sh fast

# Docker-based tests
./scripts/run_tests_with_coverage.sh docker

# Or use npm shortcuts
pnpm scaffold:test              # all
pnpm scaffold:test:unit         # unit only
pnpm scaffold:test:e2e          # e2e only
pnpm scaffold:test:coverage     # coverage focus
```

### Code Metrics

```bash
# Lines of code analysis
./scripts/loc.sh

# Simple LOC count
./scripts/loc_simple.sh

# Comprehensive codebase stats
./scripts/codebase_loc.sh

# Or use npm shortcut
pnpm scaffold:loc
```

### Git Workflows

```bash
# Create a worktree for parallel development
./create_worktree.sh feature/new-feature

# Integrate changes from another branch
./integrate.sh main

# Schedule branch work
./schedule_branch_work.sh "Implement feature X"

# Smart push with validation
./scripts/push.sh

# Sync with upstream
./scripts/sync_branch.sh main
```

## 📋 NPM Script Shortcuts

All scaffolded scripts are available via npm/pnpm shortcuts:

```json
{
  "scripts": {
    "scaffold:lint": "./scripts/run_lint.sh",
    "scaffold:lint:fix": "./scripts/run_lint.sh fix",
    "scaffold:test": "./scripts/run_tests_with_coverage.sh",
    "scaffold:test:unit": "./scripts/run_tests_with_coverage.sh unit",
    "scaffold:test:e2e": "./scripts/run_tests_with_coverage.sh e2e",
    "scaffold:test:coverage": "./scripts/run_tests_with_coverage.sh coverage",
    "scaffold:loc": "./scripts/loc.sh",
    "scaffold:coverage": "./scripts/coverage.sh"
  }
}
```

## 🔧 Configuration

### Environment Variables

- `COVERAGE_THRESHOLD` - Set minimum coverage percentage (default: 80%)
- `CLAUDE_COMMANDS_PATH` - Path to claude-commands repository (for updates)

### Coverage Thresholds

To customize coverage requirements:

```bash
# Run with custom threshold
COVERAGE_THRESHOLD=90 ./scripts/run_tests_with_coverage.sh coverage
```

## 🔄 Updating Scripts

To update scripts from the claude-commands repository:

```bash
# Set path to your local claude-commands clone
export CLAUDE_COMMANDS_PATH="$HOME/projects/claude-commands"

# Re-run scaffold command
/scaffold
```

## 🛠️ CI/CD Integration

### GitHub Actions Example

```yaml
name: CI
on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm scaffold:lint

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm scaffold:test:coverage
      - uses: codecov/codecov-action@v3
        with:
          directory: ./coverage
```

## 📚 Additional Resources

- [claude-commands repository](https://github.com/jleechanorg/claude-commands)
- [OpenClaw Documentation](https://docs.openclaw.ai)
- [vitest Documentation](https://vitest.dev/)
- [oxlint Documentation](https://oxc-project.github.io/docs/guide/usage/linter.html)

## 🤝 Contributing

When adding new scripts:

1. Place them in the `scripts/` directory
2. Make them executable: `chmod +x scripts/your-script.sh`
3. Add npm shortcuts to `package.json`
4. Document them in this README
5. Follow the existing script patterns and error handling

## 📝 Notes

- All scripts use consistent color-coded output (green=success, red=error, yellow=warning, blue=info)
- Scripts use `set -euo pipefail` for robust error handling
- Adapted scripts maintain compatibility with existing OpenClaw npm scripts
- Original Python-focused scripts remain available for reference but should not be used

---

**Scaffolded on**: 2026-02-14
**Source**: [jleechanorg/claude-commands](https://github.com/jleechanorg/claude-commands)
**Adapted for**: OpenClaw TypeScript/Node.js stack
