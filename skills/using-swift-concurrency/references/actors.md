# Actors

Data isolation and thread-safe state management.

## Basics

Actors protect mutable state—only one task accesses at a time.

```swift
actor Counter {
    var value = 0
    func increment() { value += 1 }
}

let counter = Counter()
await counter.increment()  // Must await from outside
print(await counter.value)  // Reading also requires await
```

## Actors vs Classes

| Feature        | Actor                | Class                     |
| -------------- | -------------------- | ------------------------- |
| Reference type | Yes                  | Yes                       |
| Inheritance    | No (except NSObject) | Yes                       |
| Thread safety  | Automatic            | Manual                    |
| Sendable       | Implicit             | Must be final + immutable |

## Global Actors

Shared isolation domain across types:

```swift
@MainActor
final class ViewModel {
    var items: [Item] = []  // Always on main thread
}

@MainActor
func updateUI() { }  // Always on main thread

// Custom global actor
@globalActor
actor ImageProcessing {
    static let shared = ImageProcessing()
    private init() {}
}

@ImageProcessing
func applyFilter(_ image: UIImage) -> UIImage { }
```

## @MainActor

```swift
// Replacing DispatchQueue.main
await MainActor.run { updateUI() }

// Better: Use attribute
@MainActor func updateUI() { }

// Use sparingly - assumes main thread, crashes if not
MainActor.assumeIsolated { someMainActorMethod() }
```

## Isolated vs Nonisolated

```swift
actor BankAccount {
    let accountHolder: String  // Immutable
    var balance: Double  // Mutable, isolated

    // Isolated by default
    func deposit(_ amount: Double) { balance += amount }

    // Opt out for immutable data
    nonisolated var details: String { "Account: \(accountHolder)" }
}

print(account.details)  // No await needed
```

### Isolated Parameters

Reduce suspension points:

```swift
func charge(amount: Double, from account: isolated BankAccount) async throws -> Double {
    try account.withdraw(amount: amount)  // No await needed
    return account.balance
}

// Batch operations with isolated closure
try await database.transaction { db in
    db.insert(item1)
    db.insert(item2)
}
```

## Actor Reentrancy

State can change between suspension points:

```swift
actor BankAccount {
    var balance: Double

    func deposit(amount: Double) async {
        balance += amount
        await logTransaction()  // Actor unlocked here
        balance += 10  // Balance may have changed!
    }
}

// Solution: Complete work before suspending
func deposit(amount: Double) async {
    balance += amount
    balance += 10  // Apply bonus first
    await logTransaction()  // Suspend after state changes
}
```

## #isolation Macro

Inherit caller's isolation:

```swift
extension Collection where Element: Sendable {
    func sequentialMap<Result: Sendable>(
        isolation: isolated (any Actor)? = #isolation,
        transform: (Element) async -> Result
    ) async -> [Result] {
        var results: [Result] = []
        for element in self {
            results.append(await transform(element))
        }
        return results
    }
}
```

## Mutex (iOS 18+)

Synchronous locking without async overhead:

```swift
import Synchronization

final class Counter: Sendable {
    private let count = Mutex<Int>(0)

    var currentCount: Int { count.withLock { $0 } }
    func increment() { count.withLock { $0 += 1 } }
}
```

| Feature         | Mutex | Actor            |
| --------------- | ----- | ---------------- |
| Synchronous     | Yes   | No               |
| Async support   | No    | Yes              |
| Thread blocking | Yes   | No               |
| Fine-grained    | Yes   | No (whole actor) |

Use Mutex for sync code, Actor for async.

## Isolated Deinit (Swift 6.2+)

```swift
actor FileDownloader {
    var task: Task<Void, Error>?
    isolated deinit { task?.cancel() }
}
```

## Decision Tree

```
Need thread-safe mutable state?
├─ Async context? → Actor or @MainActor
├─ Synchronous? → Mutex
├─ UI-related? → @MainActor
└─ Global/shared? → Global Actor
```

## Best Practices

1. Prefer actors over manual locks for async code
2. Use @MainActor for UI (view models, UI updates)
3. Minimize work in actors—keep critical sections short
4. Watch for reentrancy—don't assume state unchanged after await
5. Use nonisolated sparingly—only for truly immutable data
6. Avoid assumeIsolated—prefer explicit isolation
7. Complete actor work before suspending
8. Use isolated parameters to reduce suspension points
