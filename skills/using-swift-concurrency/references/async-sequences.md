# Async Sequences and Streams

Iterating over values that arrive over time.

## AsyncSequence

```swift
for await value in someAsyncSequence {
    print(value)
}
```

### Custom Implementation

```swift
struct Counter: AsyncSequence, AsyncIteratorProtocol {
    typealias Element = Int
    let limit: Int
    var current = 1

    mutating func next() async -> Int? {
        guard !Task.isCancelled, current <= limit else { return nil }
        defer { current += 1 }
        return current
    }

    func makeAsyncIterator() -> Counter { self }
}
```

### Standard Operators

```swift
for await even in Counter(limit: 5).filter({ $0 % 2 == 0 }) { }
let mapped = Counter(limit: 5).map { $0 * 2 }
let contains = await Counter(limit: 5).contains(3)
```

## AsyncStream

Create async sequences without implementing protocols.

```swift
let stream = AsyncStream<Int> { continuation in
    for i in 1...5 { continuation.yield(i) }
    continuation.finish()
}

// Throwing variant
let throwingStream = AsyncThrowingStream<Int, Error> { continuation in
    continuation.yield(1)
    continuation.finish(throwing: SomeError())
}
```

## Bridging Patterns

### Closures to Streams

```swift
func download(_ url: URL) -> AsyncThrowingStream<Status, Error> {
    AsyncThrowingStream { continuation in
        self.download(url, progressHandler: { progress in
            continuation.yield(.downloading(progress))
        }, completion: { result in
            continuation.yield(with: result.map { .finished($0) })
            continuation.finish()
        })
    }
}
```

### Delegates to Streams

```swift
final class LocationMonitor: NSObject, CLLocationManagerDelegate {
    private var continuation: AsyncThrowingStream<CLLocation, Error>.Continuation?
    let stream: AsyncThrowingStream<CLLocation, Error>

    override init() {
        var captured: AsyncThrowingStream<CLLocation, Error>.Continuation?
        stream = AsyncThrowingStream { captured = $0 }
        super.init()
        self.continuation = captured
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        locations.forEach { continuation?.yield($0) }
    }
}
```

## Stream Lifecycle

```swift
AsyncStream { continuation in
    continuation.onTermination = { @Sendable reason in
        // .finished, .finished(Error?), or .cancelled
        // Cleanup: remove observers, cancel work
    }
}
```

## Buffer Policies

| Policy                 | Behavior                           |
| ---------------------- | ---------------------------------- |
| `.unbounded` (default) | Buffers all values                 |
| `.bufferingNewest(n)`  | Keeps newest N values              |
| `.bufferingOldest(n)`  | Keeps oldest N values              |
| `.bufferingNewest(0)`  | Only values after iteration starts |

```swift
// Only care about latest value
let stream = AsyncStream(bufferingPolicy: .bufferingNewest(1)) { continuation in
    (0...100).forEach { continuation.yield($0) }
    continuation.finish()
}
// Prints only: 100
```

## Polling Pattern

```swift
func startPinging() -> AsyncStream<Bool> {
    AsyncStream {
        try? await Task.sleep(for: .seconds(5))
        return await ping()
    } onCancel: {
        print("Pinging cancelled")
    }
}
```

## Standard Library Integration

```swift
// NotificationCenter
for await _ in NotificationCenter.default.notifications(named: .someNotification) { }

// Combine publishers
for await number in publisher.values { }

// Task groups
for await image in group { }
```

## Limitations

| Limitation               | Workaround              |
| ------------------------ | ----------------------- |
| Single consumer only     | Create separate streams |
| No values after finish() | Check logic flow        |

## Decision Guide

| Use Case          | Solution                            |
| ----------------- | ----------------------------------- |
| Single value      | Regular async method                |
| Progress updates  | AsyncStream                         |
| Delegate bridging | AsyncStream                         |
| Polling           | AsyncStream with `init(unfolding:)` |
| Library protocols | Custom AsyncSequence                |

## Best Practices

1. **Always call finish()** - streams stay alive until terminated
2. **Use buffer policies wisely** - match your use case
3. **Handle cancellation** - set `onTermination` for cleanup
4. **Single consumer** - don't share streams
5. **Check Task.isCancelled** - in custom sequences
6. **Prefer streams over closures** - more composable
