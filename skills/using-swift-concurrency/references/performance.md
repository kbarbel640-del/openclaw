# Performance

Optimizing Swift Concurrency code.

## Core Principles

1. **Measure first** - can't improve without baseline
2. **Start simple** - Synchronous → Asynchronous → Parallel
3. **Profile regularly** - catch issues early

## Common Issues

| Issue                | Symptom              | Fix                                             |
| -------------------- | -------------------- | ----------------------------------------------- |
| UI hangs             | Interface freezes    | Move work off main actor                        |
| Poor parallelization | Sequential execution | Use task groups                                 |
| Actor contention     | Tasks waiting        | Reduce actor scope or remove unnecessary actors |

## Using Xcode Instruments

Profile with CMD + I → "Swift Concurrency" template.

**Key metrics:**

- Tasks: Total, running vs suspended
- Actors: Queue size, execution time
- Main Thread: Hangs, blocked time

**Task states:** Creating → Running → Suspended → Ending

## Identifying Issues

### Main Thread Blocked

```swift
// Bad: All work on main thread
@MainActor func generate() {
    Task {
        for _ in 0..<100 { heavyWork() }  // Blocks UI
    }
}

// Good: Move to background
@MainActor func generate() {
    Task {
        for _ in 0..<100 {
            let result = await backgroundGenerate()
            items.append(result)
        }
    }
}
```

### Actor Contention

```swift
// Bad: Actor serializes all work
actor Generator { func generate() -> Image { /* heavy */ } }
for _ in 0..<100 { await generator.generate() }  // Queue size always 1

// Good: Remove unnecessary actor
struct Generator {
    @concurrent static func generate() async -> Image { /* heavy */ }
}
```

## Reducing Suspensions

### 1. Use Synchronous Methods

```swift
// Bad: Unnecessary async
private func scale(_ image: CGImage) async { }

// Good: Synchronous helper
private func scale(_ image: CGImage) { }
```

### 2. Prevent Reentrancy

```swift
// Bad: Reenters actor
func deposit(_ amount: Int) async {
    balance += amount
    await logTransaction()  // Leaves actor
    balance += bonus  // State may have changed
}

// Good: Complete work before leaving
func deposit(_ amount: Int) async {
    balance += amount
    balance += bonus
    await logTransaction()
}
```

### 3. Inherit Isolation

```swift
// Bad: Switches isolation
@MainActor func update() async {
    await process()  // Switches away
}

// Good: Stay on caller's isolation
nonisolated(nonsending) func process() async { }
```

### 4. Non-Suspending APIs

```swift
// Suspending
try await Task.checkCancellation()

// Non-suspending
if Task.isCancelled { return }
```

### 5. Embrace Parallelism

```swift
// Sequential
for url in urls { images.append(await download(url)) }

// Parallel
await withTaskGroup(of: Image.self) { group in
    for url in urls { group.addTask { await download(url) } }
    for await image in group { images.append(image) }
}
```

## Decision Checklist

Use async/parallel if:

- [ ] Blocks main actor visibly (>16ms)
- [ ] Scales with data (N items → N cost)
- [ ] Involves I/O (network, disk)
- [ ] Benefits from combining operations
- [ ] Called frequently

**2+ checks** → async/parallel justified.

## Parallelism Tradeoffs

| Benefit                 | Cost                    |
| ----------------------- | ----------------------- |
| Faster completion       | Memory pressure         |
| Better utilization      | CPU scheduling overhead |
| Improved responsiveness | Battery drain           |

Don't over-parallelize trivial work.

## UX Considerations

Smooth feels faster than raw speed:

```swift
// 80ms on main thread but stutters
@MainActor func process() { heavyWork() }

// 100ms total but smooth UI
@MainActor func process() async { await backgroundWork() }
```

## Optimization Patterns

### Move Heavy Work to Background

```swift
@MainActor func generate() async {
    for _ in 0..<100 {
        let item = await backgroundGenerate()
        items.append(item)
    }
}

@concurrent func backgroundGenerate() async -> Item { /* heavy */ }
```

### Reduce Actor Hops

```swift
// Before: Multiple hops
async let a = fetch1(); async let b = fetch2(); async let c = fetch3()

// After: Batch with one hop
combine(await a, await b, await c)
```

## Red Flags in Instruments

- Main thread blocked >16ms
- Actor queue size always 1
- High suspension count
- Tasks created but not running
- Excessive task creation (1000+)

## Best Practices

1. Profile before optimizing
2. Start synchronous, add async only when needed
3. Use Instruments regularly
4. Name tasks for easier debugging
5. Reduce unnecessary awaits
6. Avoid premature parallelism
7. Consider UX over raw speed
8. Batch actor work
9. Test on real devices
