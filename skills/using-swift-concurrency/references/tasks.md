# Tasks

Creating, managing, and controlling concurrent work.

## Basics

Tasks bridge sync and async contexts. Start immediately—no `resume()` needed.

```swift
func syncMethod() {
    Task { await someAsyncMethod() }
}

// Store reference for cancellation
var loadTask: Task<UIImage, Error>?
loadTask = Task { try await fetchImage() }
loadTask?.cancel()
```

## Cancellation

Tasks must manually check for cancellation:

```swift
try Task.checkCancellation()  // Throws CancellationError
guard !Task.isCancelled else { return }  // Boolean check

// Check at natural breakpoints
let task = Task {
    try Task.checkCancellation()
    let data = try await fetch()
    try Task.checkCancellation()
    return process(data)
}
```

Canceling parent notifies all children—children must still check.

## SwiftUI Integration

```swift
struct ContentView: View {
    @State private var data: Data?

    var body: some View {
        Text(data?.description ?? "Loading...")
            .task { data = try? await fetchData() }  // Auto-cancels on disappear
            .task(id: searchQuery) { await search(searchQuery) }  // Restarts on change
    }
}
```

## Task Groups

Dynamic parallel execution:

```swift
// Basic
await withTaskGroup(of: UIImage.self) { group in
    for url in urls { group.addTask { await download(url) } }
}

// Collecting results
let images = await withTaskGroup(of: UIImage.self) { group in
    for url in urls { group.addTask { await download(url) } }
    return await group.reduce(into: []) { $0.append($1) }
}

// Error handling (must iterate to propagate)
try await withThrowingTaskGroup(of: UIImage.self) { group in
    for url in urls { group.addTask { try await download(url) } }
    for try await image in group { results.append(image) }
}

// Cancel remaining
group.cancelAll()
let didAdd = group.addTaskUnlessCancelled { await work() }
```

## Discarding Task Groups

Fire-and-forget operations (more memory efficient):

```swift
await withDiscardingTaskGroup { group in
    group.addTask { await logEvent("login") }
    group.addTask { await preloadCache() }
}
```

## Structured vs Unstructured

| Type                             | Characteristics                                      |
| -------------------------------- | ---------------------------------------------------- |
| Structured (`async let`, groups) | Bound to parent, inherit context, auto-cancel        |
| Unstructured (`Task { }`)        | Independent lifecycle, manual cancel                 |
| Detached (`Task.detached`)       | No inheritance (priority, task-locals, cancellation) |

```swift
// Structured - preferred
async let data1 = fetch(1)
async let data2 = fetch(2)

// Unstructured
let task = Task { await doWork() }

// Detached - use as last resort
Task.detached(priority: .background) { await cleanup() }
```

## Task Priorities

```swift
.high / .userInitiated  // Immediate user feedback
.medium                 // Default for detached
.utility / .low         // Longer-running, non-urgent
.background             // Lowest priority

Task(priority: .background) { await prefetch() }
```

Structured tasks inherit parent priority. System auto-escalates to prevent inversion.

## Task.sleep() vs Task.yield()

| Method             | Purpose                                     |
| ------------------ | ------------------------------------------- |
| `Task.sleep(for:)` | Suspend for duration, respects cancellation |
| `Task.yield()`     | Temporarily suspend for other tasks         |

```swift
// Debounced search
func search(_ query: String) async {
    do {
        try await Task.sleep(for: .milliseconds(500))
        performSearch(query)
    } catch { /* Cancelled */ }
}
```

## async let vs TaskGroup

| Feature    | async let             | TaskGroup                |
| ---------- | --------------------- | ------------------------ |
| Task count | Fixed at compile-time | Dynamic at runtime       |
| Syntax     | Lightweight           | More verbose             |
| Use when   | 2-5 known tasks       | Loop-based parallel work |

## Timeout Pattern

```swift
func withTimeout<T>(_ duration: Duration, _ operation: @escaping () async throws -> T) async throws -> T {
    try await withThrowingTaskGroup(of: T.self) { group in
        group.addTask { try await operation() }
        group.addTask { try await Task.sleep(for: duration); throw TimeoutError() }
        guard let result = try await group.next() else { throw TimeoutError() }
        group.cancelAll()
        return result
    }
}
```

## Best Practices

1. Check cancellation regularly in long-running tasks
2. Use structured concurrency (avoid detached)
3. Leverage SwiftUI's `.task` modifier
4. Choose `async let` for fixed, TaskGroup for dynamic
5. Handle errors explicitly in throwing task groups
6. Set priority only when needed
