# Memory Management

Preventing retain cycles in Swift Concurrency.

## Core Concepts

Tasks capture like closures. Swift doesn't automatically prevent retain cycles:

```swift
Task {
    self.doWork()  // Strong capture of self
}
```

## Retain Cycles

When task captures `self` strongly and `self` owns the task:

```swift
@MainActor
final class ImageLoader {
    var task: Task<Void, Never>?

    func startPolling() {
        task = Task {
            while true {
                self.pollImages()  // Retain cycle!
                try? await Task.sleep(for: .seconds(1))
            }
        }
    }
}

var loader: ImageLoader? = .init()
loader?.startPolling()
loader = nil  // Never deallocated
```

## Breaking Retain Cycles

### Use weak self

```swift
func startPolling() {
    task = Task { [weak self] in
        while let self = self {
            self.pollImages()
            try? await Task.sleep(for: .seconds(5))
        }
    }
}
```

### One-Way Retention (Sometimes OK)

Task retains `self`, but `self` doesn't retain task:

```swift
func saveData() {
    Task {
        await database.save(self.data)  // OK - completes quickly
    }
}
```

Object stays alive until task completes—acceptable for short tasks.

## Async Sequences

Infinite sequences need special care:

```swift
// Problem: Never ends
task = Task {
    for await _ in NotificationCenter.default.notifications(named: .someNotification) {
        isActive = true  // Strong capture
    }
}

// Solution: weak self + guard
task = Task { [weak self] in
    for await _ in NotificationCenter.default.notifications(named: .someNotification) {
        guard let self = self else { return }
        self.isActive = true
    }
}
```

## Isolated Deinit (Swift 6.2+)

```swift
@MainActor
final class ViewModel {
    private var task: Task<Void, Never>?
    isolated deinit { task?.cancel() }
}
```

**Note**: Won't break retain cycles—deinit never called if cycle exists.

## Common Patterns

| Pattern                   | When to Use                             |
| ------------------------- | --------------------------------------- |
| Strong capture            | Short-lived tasks that complete quickly |
| `[weak self]` + while let | Long-running/polling tasks              |
| `[weak self]` + guard     | Async sequence iteration                |
| Manual cancellation       | Need explicit control                   |

### Polling Service

```swift
final class PollingService {
    private var task: Task<Void, Never>?

    func start() {
        task = Task { [weak self] in
            while let self = self {
                await self.poll()
                try? await Task.sleep(for: .seconds(5))
            }
        }
    }

    func stop() { task?.cancel() }
}
```

### Notification Observer

```swift
@MainActor
final class Observer {
    private var task: Task<Void, Never>?

    func startObserving() {
        task = Task { [weak self] in
            for await notification in NotificationCenter.default.notifications(named: .some) {
                guard let self = self else { return }
                self.handle(notification)
            }
        }
    }

    isolated deinit { task?.cancel() }
}
```

## Detection

### Add deinit logging

```swift
deinit { print("✅ \(type(of: self)) deallocated") }
```

### Memory Graph Debugger

Debug → Debug Memory Graph → Look for cycles

### Unit Test Pattern

```swift
func testDeallocates() async {
    var vm: ViewModel? = ViewModel()
    weak var weak = vm
    vm?.startWork()
    vm = nil
    try? await Task.sleep(for: .milliseconds(100))
    XCTAssertNil(weak, "Should deallocate")
}
```

## Decision Tree

```
Task captures self?
├─ Completes quickly? → Strong OK
├─ Long-running/infinite?
│  ├─ Polling loop → [weak self] + while let
│  └─ Async sequence → [weak self] + guard
└─ Self owns task?
   └─ High risk → Always use weak
```

## Common Mistakes

```swift
// Forgetting weak self in loops
Task { while true { self.poll() } }  // Cycle

// Strong capture in async sequences
Task { for await item in stream { self.process(item) } }  // May never release

// Assuming deinit breaks cycles
deinit { task?.cancel() }  // Never called if cycle exists
```

## Best Practices

1. Default to weak self for long-running tasks
2. Use guard let self in async sequences
3. Cancel tasks explicitly when possible
4. Add deinit logging during development
5. Test object deallocation in unit tests
6. Use Memory Graph to verify
7. Prefer cancellation over weak self when possible
