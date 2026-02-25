---
name: swift-codebase-deep-audit
description: Orchestrate deep Swift/SwiftUI codebase audits and improvement work. Use when you want Codex to examine a Swift or SwiftUI repository end-to-end, produce a prioritized task list (bugs, correctness, performance, architecture, UX/accessibility, testing, build/CI), and then execute tasks in parallel using multiple Opus sub-agents.
---

# Swift Codebase Deep Audit

## Inputs to ask for (minimal)

- Repo path(s) to audit (default: the current repo the user mentions)
- Constraints: "no behavior changes" vs "ok to refactor", deadlines, target platforms (iOS/macOS/watchOS), minimum OS versions

## Related installed skills to leverage

Use these as references during the audit:

- `swiftui-ui-patterns`
- `swiftui-view-refactor`
- `swiftui-performance-audit`
- `swiftui-liquid-glass`
- `swift-concurrency-expert`
- `using-swift-concurrency`
- `migrating-to-swift-testing`

## Audit workflow (12 Opus sub-agents)

### Phase 0 — Prep

- Confirm repo path(s) and how to run/tests (xcodebuild scheme/workspace, SPM, tuist, etc.)
- Capture a quick baseline: build status, test status, obvious warnings

### Phase 1 — Parallel deep reads (spawn 12 sub-agents)

Spawn 12 sub-agents (Opus) with non-overlapping scopes and require each to return:

- Findings (with file paths + line refs when possible)
- A task list: {title, impact, effort, risk, suggested approach}
- "Quick wins" vs "bigger refactors"

Recommended scopes:

1. Architecture & boundaries (feature modules, dependency injection, routing)
2. SwiftUI state/data flow correctness (bindings, observation, invalidations)
3. SwiftUI performance (body recomputation, lists, identity, async images)
4. Concurrency correctness (MainActor, isolation, cancellation, async sequences)
5. Networking/data layer (caching, retries, error surfaces, backpressure)
6. Persistence (CoreData/Realm/files), migrations, thread-safety
7. Testing strategy (Swift Testing vs XCTest, snapshot tests, determinism)
8. Build system/CI (schemes, SPM, build times, warnings-as-errors)
9. Accessibility & localization (VoiceOver, dynamic type, strings)
10. UX polish (focus, keyboard, haptics, sheets navigation)
11. Security & privacy (PII handling, keychain, logging, ATS)
12. Observability (logging, metrics, crash breadcrumbs)

### Phase 2 — Synthesis

- Merge all sub-agent results into a single prioritized backlog.
- Group by theme and by "safe now" vs "needs design".
- Produce an execution plan with parallelizable workstreams.

### Phase 3 — Parallel execution

- Spawn background Opus sub-agents per workstream.
- Each agent must: create a small PR-like change set, run tests/build, and report diffstat + risks.
- Keep changes scoped; prefer many small commits.

## Output format (task list)

Provide a markdown backlog with:

- P0 / P1 / P2 buckets
- Each item: owner-scope, file(s), rationale, acceptance criteria, estimated effort

## Guardrails

- Don’t do sweeping refactors without an explicit goal and acceptance criteria.
- Prefer SwiftUI-native patterns and local state when appropriate.
- Concurrency changes must include cancellation + MainActor correctness.
- Always preserve behavior unless user explicitly approves behavior changes.
