# Threading

How Swift Concurrency manages threads.

## Tasks vs Threads

Tasks are units of async work, not tied to specific threads. Swift schedules tasks on a cooperative pool (one thread per CPU core).

**Key insight**: No 1:1 relationship between tasks and threads.

## Cooperative Thread Pool

| Property        | Description                                 |
| --------------- | ------------------------------------------- |
| Limited threads | Matches CPU cores                           |
| Task scheduling | Tasks share threads                         |
| At await        | Task suspends, thread freed                 |
| On resume       | Any available thread (not necessarily same) |

### Benefits over GCD

- No thread explosion
- Less context switching
- Efficient task scheduling
- No priority inversion

## Threading Mindset → Isolation Mindset

```swift
// Old: Thinking about threads
DispatchQueue.main.async { updateUI() }
DispatchQueue.global().async { heavyWork() }

// New: Thinking about isolation
@MainActor func updateUI() { }
func heavyWork() async { }
```

**Don't ask**: "What thread should this run on?"
**Ask**: "What isolation domain should own this work?"

## Suspension Points

`await` marks possible suspension—not guaranteed:

```swift
let data = await fetchData()  // May suspend, may not
```

### Actor Reentrancy

```swift
actor BankAccount {
    func deposit(_ amount: Int) async {
        balance += amount
        await logTransaction()  // Actor unlocked here
        balance += 10  // Balance may have changed!
    }
}

// Solution: Complete work before suspending
func deposit(_ amount: Int) async {
    balance += amount
    balance += 10
    await logTransaction()
}
```

## Swift 6.2 Changes

### Nonisolated Async Functions (SE-461)

**Old**: Always switch to background.
**New**: Inherit caller's isolation by default.

```swift
// Enable new behavior
.enableUpcomingFeature("NonisolatedNonsendingByDefault")

// Force background execution
@concurrent func alwaysBackground() async { }

// Inherit caller isolation (prevent value sending)
nonisolated(nonsending) func stayOnCaller() async { }
```

### Default Isolation Domain (SE-466)

```swift
// Package.swift
.target(name: "MyTarget", swiftSettings: [
    .defaultIsolation(MainActor.self)
])
```

Most app code runs on main thread—setting @MainActor default reduces warnings.

## Thread.current in Swift 6

`Thread.current` unavailable in async contexts (Swift 6 language mode).

**Workaround**:

```swift
extension Thread {
    public static var currentThread: Thread { Thread.current }
}
```

**Better**: Reason in terms of isolation domains, use Instruments/debugger when needed.

## Common Misconceptions

| Misconception           | Reality                        |
| ----------------------- | ------------------------------ |
| Each Task = new thread  | Tasks share limited pool       |
| await blocks thread     | Suspends task, frees thread    |
| Same task = same thread | Can resume on different thread |
| Task order guaranteed   | Based on system scheduling     |

## Decision Tree

```
Need to control execution?
├─ UI updates? → @MainActor
├─ Specific state? → Custom actor
├─ Background work? → Regular async
└─ Force background? → @concurrent (Swift 6.2+)

Seeing Sendable warnings?
├─ Can make Sendable? → Add conformance
├─ Same isolation OK? → nonisolated(nonsending)
└─ Need different isolation? → Make Sendable
```

## Best Practices

1. Stop thinking about threads—think isolation domains
2. Trust the system to optimize thread usage
3. Use @MainActor for UI
4. Complete state changes before suspending
5. Use priorities as hints, not guarantees
6. Make types Sendable for cross-thread safety
7. Enable Swift 6.2 features for easier migration
8. Set default isolation for app projects
