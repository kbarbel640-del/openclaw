---
name: using-swift-concurrency
description: Expert guidance on Swift Concurrency patterns, async/await, actors, and Sendable conformance. Use when developers mention Swift Concurrency, data races, @MainActor, actor isolation, Swift 6 migration, or refactoring closures to async/await.
---

# Using Swift Concurrency

## Contents

- [Quick Reference](#quick-reference)
- [Agent Contract](#agent-contract)
- [Project Settings](#project-settings)
- [Decision Tree](#decision-tree)
- [Error Triage](#error-triage)
- [Core Patterns](#core-patterns)
- [Swift 6 Migration](#swift-6-migration)
- [Reference Files](#reference-files)
- [Best Practices](#best-practices)
- [Verification](#verification)

## Quick Reference

| Concept       | When to Use                         |
| ------------- | ----------------------------------- |
| `async/await` | Single async operations             |
| `async let`   | Fixed parallel operations           |
| `Task { }`    | Fire-and-forget, sync→async bridge  |
| `TaskGroup`   | Dynamic parallel operations         |
| `actor`       | Protect shared mutable state        |
| `@MainActor`  | UI updates only                     |
| `Sendable`    | Types crossing isolation boundaries |

| Common Error                              | First Step                                   |
| ----------------------------------------- | -------------------------------------------- |
| "non-Sendable type risks data races"      | Identify isolation boundary crossing         |
| "cannot be used from nonisolated context" | Check if `@MainActor` is correct             |
| "unavailable from async contexts"         | Use isolation + Instruments, not Thread APIs |

## Agent Contract

1. Check Swift language mode (5.x vs 6) and toolchain before giving version-sensitive advice.
2. Identify isolation boundary (`@MainActor`, custom actor, nonisolated) before proposing fixes.
3. Never use `@MainActor` as blanket fix—justify why main-actor isolation is correct.
4. Prefer structured concurrency over unstructured. Use `Task.detached` only with clear reason.
5. For `@preconcurrency`, `@unchecked Sendable`, `nonisolated(unsafe)`: require safety invariant + follow-up ticket.
6. Migration: optimize for minimal blast radius (small, reviewable changes).

## Project Settings

Concurrency behavior depends on build settings. Determine before advising:

- Default actor isolation (is the module default `@MainActor` or `nonisolated`?)
- Strict concurrency checking level (minimal/targeted/complete)
- Whether upcoming features are enabled (especially `NonisolatedNonsendingByDefault`)
- Swift language mode (Swift 5.x vs Swift 6) and SwiftPM tools version

### Manual checks (no scripts)

- SwiftPM:
  - Check `Package.swift` for `.defaultIsolation(MainActor.self)`.
  - Check `Package.swift` for `.enableUpcomingFeature("NonisolatedNonsendingByDefault")`.
  - Check for strict concurrency flags: `.enableExperimentalFeature("StrictConcurrency=targeted")` (or similar).
  - Check tools version at the top: `// swift-tools-version: ...`
- Xcode projects:
  - Search `project.pbxproj` for:
    - `SWIFT_DEFAULT_ACTOR_ISOLATION`
    - `SWIFT_STRICT_CONCURRENCY`
    - `SWIFT_UPCOMING_FEATURE_` (and/or `SWIFT_ENABLE_EXPERIMENTAL_FEATURES`)

If any of these are unknown, ask the developer to confirm them before giving migration-sensitive guidance.

## Decision Tree

1. **Starting fresh with async code?**
   - Read `references/async-await-basics.md` for foundational patterns
   - For parallel operations → `references/tasks.md` (async let, task groups)

2. **Protecting shared mutable state?**
   - Need to protect class-based state → `references/actors.md` (actors, @MainActor)
   - Need thread-safe value passing → `references/sendable.md` (Sendable conformance)

3. **Managing async operations?**
   - Structured async work → `references/tasks.md` (Task, child tasks, cancellation)
   - Streaming data → `references/async-sequences.md` (AsyncSequence, AsyncStream)

4. **Working with legacy frameworks?**
   - Core Data integration → `references/core-data.md`
   - General migration → `references/migration.md`

5. **Performance or debugging issues?**
   - Slow async code → `references/performance.md` (profiling, suspension points)
   - Testing concerns → `references/testing.md` (XCTest, Swift Testing)

6. **Understanding threading behavior?**
   - Read `references/threading.md` for thread/task relationship and isolation

7. **Memory issues with tasks?**
   - Read `references/memory-management.md` for retain cycle prevention

## Error Triage

- "Sending value of non-Sendable type ... risks causing data races"
  - First: identify where the value crosses an isolation boundary
  - Then: use `references/sendable.md` and `references/threading.md` (especially Swift 6.2 behavior changes)
- "Main actor-isolated ... cannot be used from a nonisolated context"
  - First: decide if it truly belongs on `@MainActor`
  - Then: use `references/actors.md` (global actors, `nonisolated`, isolated parameters) and `references/threading.md` (default isolation)
- "Class property 'current' is unavailable from asynchronous contexts" (Thread APIs)
  - Use `references/threading.md` to avoid thread-centric debugging and rely on isolation + Instruments
- XCTest async errors like "wait(...) is unavailable from asynchronous contexts"
  - Use `references/testing.md` (`await fulfillment(of:)` and Swift Testing patterns)
- "non-Sendable type captured in closure" in tests
  - Use `references/testing.md` (Sendable mocks, actor-based test helpers)
- Actor isolation errors in Swift Testing
  - Use `references/testing.md` (match test isolation to code under test)
- Core Data concurrency warnings/errors
  - Use `references/core-data.md` (DAO/`NSManagedObjectID`, default isolation conflicts)

## Core Patterns

**async/await** - Single async operations

```swift
func fetchUser() async throws -> User { try await networkClient.get("/user") }
```

**async let** - Fixed parallel operations

```swift
async let user = fetchUser()
async let posts = fetchPosts()
let profile = try await (user, posts)
```

**Task** - Fire-and-forget, sync→async bridge

```swift
Task { await updateUI() }
```

**Task Group** - Dynamic parallel operations

```swift
await withTaskGroup(of: Result.self) { group in
    for item in items { group.addTask { await process(item) } }
}
```

**Actor** - Protecting shared mutable state

```swift
actor DataCache {
    private var cache: [String: Data] = [:]
    func get(_ key: String) -> Data? { cache[key] }
}
```

**@MainActor** - UI updates on main thread

```swift
@MainActor class ViewModel: ObservableObject { @Published var data = "" }
```

### Common Scenarios

**Network + UI update:**

```swift
Task {
    let data = try await fetchData()
    await MainActor.run { self.updateUI(with: data) }
}
```

**Parallel requests:**

```swift
async let users = fetchUsers()
async let posts = fetchPosts()
let (u, p) = try await (users, posts)
```

**Process array in parallel:**

```swift
await withTaskGroup(of: Item.self) { group in
    for item in items { group.addTask { await process(item) } }
    for await result in group { results.append(result) }
}
```

## Swift 6 Migration

Key changes:

- **Strict concurrency checking** enabled by default
- **Complete data-race safety** at compile time
- **Sendable requirements** enforced on boundaries
- **Isolation checking** for all async boundaries

For detailed migration steps, see `references/migration.md`.

## Reference Files

Load these files as needed for specific topics:

- **`async-await-basics.md`** - async/await syntax, execution order, async let, URLSession patterns
- **`tasks.md`** - Task lifecycle, cancellation, priorities, task groups, structured vs unstructured
- **`threading.md`** - Thread/task relationship, suspension points, isolation domains, nonisolated
- **`memory-management.md`** - Retain cycles in tasks, memory safety patterns
- **`actors.md`** - Actor isolation, @MainActor, global actors, reentrancy, custom executors, Mutex
- **`sendable.md`** - Sendable conformance, value/reference types, @unchecked, region isolation
- **`async-sequences.md`** - AsyncSequence, AsyncStream, when to use vs regular async methods
- **`core-data.md`** - NSManagedObject sendability, custom executors, isolation conflicts
- **`performance.md`** - Profiling with Instruments, reducing suspension points, execution strategies
- **`testing.md`** - Swift Testing integration, actor isolation in tests, MainActor handling, ObjC test migration, Sendable mocks
- **`migration.md`** - Swift 6 migration strategy, closure-to-async conversion, @preconcurrency, FRP migration

## Concurrency Hazard Map

Common mistakes and their consequences:

| Hazard                           | Symptom                     | Root Cause                      | Fix                                |
| -------------------------------- | --------------------------- | ------------------------------- | ---------------------------------- |
| **@MainActor everywhere**        | Deadlocks, slow UI          | Over-isolation                  | Only UI code needs @MainActor      |
| **Detached task for everything** | Leaks, no cancellation      | Avoiding structured concurrency | Use `async let` or `TaskGroup`     |
| **Capturing self strongly**      | Memory leaks                | Task retains object             | Use `[weak self]` in Task closures |
| **Blocking in async**            | Deadlock, thread starvation | Using semaphores/locks          | Use actors for synchronization     |
| **Assuming thread**              | Data races                  | Thread ≠ Actor                  | Check isolation, not thread        |
| **Non-sendable capture**         | Runtime crash               | Crossing isolation boundary     | Make type Sendable or copy data    |
| **Implicit @MainActor**          | Unexpected main thread      | Module default isolation        | Check module settings              |

**Detection checklist:**

```swift
// Look for these red flags in code review:
Task.detached { }          // Why not structured?
DispatchQueue.main.async   // Why not @MainActor?
Thread.current             // Checking thread = wrong model
lock.lock()                // Blocking in async context?
semaphore.wait()           // Will deadlock in async
self.property = value      // In Task without [weak self]?
```

## Test Harness Patterns

### Testing Async Code

```swift
// Swift Testing (preferred)
@Test func testAsyncOperation() async throws {
    let result = await service.fetchData()
    #expect(result.count > 0)
}

// With timeout
@Test(.timeLimit(.seconds(5)))
func testSlowOperation() async throws {
    let result = await service.slowFetch()
    #expect(result != nil)
}
```

### Testing Actor-Isolated Code

```swift
// Test actor directly
@Test func testActorState() async {
    let counter = Counter()
    await counter.increment()
    let value = await counter.value
    #expect(value == 1)
}

// Test @MainActor code
@Test @MainActor func testViewModel() async {
    let vm = ViewModel()
    await vm.loadData()
    #expect(vm.items.count > 0)
}
```

### Testing Concurrent Operations

```swift
@Test func testConcurrentAccess() async {
    let actor = SafeCache()

    // Concurrent writes
    await withTaskGroup(of: Void.self) { group in
        for i in 0..<100 {
            group.addTask {
                await actor.set(key: "k\(i)", value: i)
            }
        }
    }

    // Verify no data loss
    let count = await actor.count
    #expect(count == 100)
}
```

### Testing Cancellation

```swift
@Test func testCancellation() async throws {
    let task = Task {
        try await longRunningOperation()
    }

    // Cancel after short delay
    try await Task.sleep(for: .milliseconds(100))
    task.cancel()

    // Verify cancellation was handled
    let result = await task.result
    #expect(throws: CancellationError.self) { try result.get() }
}
```

## Best Practices

1. **Structured concurrency** - Task groups over unstructured tasks
2. **Minimize suspension points** - Keep actor-isolated sections small
3. **@MainActor sparingly** - Only for truly UI-related code
4. **Sendable types** - Enable safe concurrent access
5. **Handle cancellation** - Check `Task.isCancelled` in long operations
6. **No blocking** - Never use semaphores/locks in async contexts
7. **Test async code** - Use proper async test methods

## Verification

- Confirm build settings before interpreting diagnostics
- After refactors:
  - Run tests (`references/testing.md`)
  - Profile if needed (`references/performance.md`)
  - Verify lifetime behavior (`references/memory-management.md`)

## Glossary

See `references/glossary.md` for quick definitions of core concurrency terms used across this skill.

## Tracking Migration with Azure DevOps

Track Swift 6 migration progress using work items:

```bash
# Set defaults
az devops configure --defaults organization=https://yammer.visualstudio.com project=engineering

# Create Epic for migration tracking
az boards work-item create --type Epic \
  --title "Swift 6 Concurrency Migration" \
  --description "<p>Track Swift 6 migration across modules</p>"

# Create tasks for each module
az boards work-item create --type Task \
  --title "Migrate NetworkService to Swift 6 concurrency" \
  --fields "System.AreaPath=Project\\iOS" "Microsoft.VSTS.Common.Priority=2"

# Query migration tasks
az boards query --wiql "SELECT [System.Id], [System.Title], [System.State]
  FROM WorkItems
  WHERE [System.Title] CONTAINS 'Swift 6'
  AND [System.WorkItemType] = 'Task'"

# Update work item when module migration complete
az boards work-item update --id 12345 --state "Done"

# Track @preconcurrency/@unchecked Sendable follow-ups
az boards work-item create --type Bug \
  --title "Remove @preconcurrency from UserService (Swift 6 tech debt)" \
  --fields "System.Tags=swift6-debt;concurrency"
```

## Related Skills

- `/migrating-to-swift-testing` - Testing async code
- `/reviewing-ado-prs` - Concurrency review patterns
- `/reproducing-bugs` - Bug reproduction workflow
- `/using-azure-cli` - `az boards` for migration tracking
- `/ensuring-ci-green` - CI monitoring after concurrency changes
