# Sendable

Type safety for sharing data across concurrency boundaries.

## What is Sendable?

Protocol indicating a type is safe to share across isolation domains. Compiler verifies thread-safety at compile time.

## Isolation Domains

| Domain         | Description                                  |
| -------------- | -------------------------------------------- |
| Nonisolated    | No restrictions, can't modify isolated state |
| Actor-isolated | Serialized access to actor's state           |
| Global actor   | Shared isolation (e.g., @MainActor)          |

## Data Races vs Race Conditions

| Issue          | Description                | Swift Concurrency |
| -------------- | -------------------------- | ----------------- |
| Data race      | Concurrent access, no sync | Prevented         |
| Race condition | Timing-dependent bugs      | Not prevented     |

Enable Thread Sanitizer to detect data races at runtime.

## Value Types (Structs, Enums)

```swift
// Non-public: Implicitly Sendable if all members Sendable
struct Person { var name: String }

// Public: Requires explicit conformance
public struct Person: Sendable { var name: String }

// All members must be Sendable
public struct Person: Sendable {
    var name: String
    var hometown: Location  // Must also be Sendable
}
```

Copy-on-write makes mutability safe—each mutation creates a copy.

## Reference Types (Classes)

Requirements for Sendable classes:

1. `final` (no inheritance)
2. Immutable stored properties only (`let`)
3. All properties Sendable
4. No superclass or `NSObject` only

```swift
final class User: Sendable {
    let name: String
    let id: Int
}
```

Actor isolation makes classes Sendable:

```swift
@MainActor
class ViewModel {
    var data: [Item] = []  // Safe due to actor isolation
}
// Implicitly Sendable
```

## @Sendable Closures

```swift
actor ContactsStore {
    func removeAll(_ shouldRemove: @Sendable (Contact) -> Bool) async {
        contacts.removeAll { shouldRemove($0) }
    }
}

// Captured values must be Sendable
let query = "search"
store.filter { contact in contact.name.contains(query) }  // OK: immutable

var query = "search"
store.filter { [query] contact in contact.name.contains(query) }  // OK: capture list
```

## @unchecked Sendable

**Last resort.** You guarantee thread-safety.

```swift
final class Cache: @unchecked Sendable {
    private let lock = NSLock()
    private var items: [String: Data] = [:]

    func get(_ key: String) -> Data? {
        lock.lock(); defer { lock.unlock() }
        return items[key]
    }
}
```

**Better**: Use actor instead.

## Region-Based Isolation

Compiler allows non-Sendable types in same scope:

```swift
func check() {
    let article = Article(title: "Swift")
    Task { print(article.title) }  // OK - same region, no mutation after
}
```

## The sending Keyword

Enforces ownership transfer:

```swift
func printTitle(article: sending Article) async {
    await logger.log(article: article)
}
// article no longer accessible after call
```

## Global Variables

Must be concurrency-safe:

```swift
// Solution 1: Actor isolation
@MainActor
class ImageCache { static var shared = ImageCache() }

// Solution 2: Immutable + Sendable
final class ImageCache: Sendable { static let shared = ImageCache() }

// Solution 3: nonisolated(unsafe) - last resort
struct APIProvider: Sendable {
    nonisolated(unsafe) static private(set) var shared: APIProvider!
}
```

## Decision Tree

```
Need to share type across isolation?
├─ Value type (struct/enum)?
│  └─ Public? Add explicit Sendable : Implicit
├─ Reference type (class)?
│  ├─ Can be final + immutable? → Sendable
│  ├─ Needs mutation?
│  │  ├─ Can use actor? → Actor (automatic)
│  │  ├─ Main thread only? → @MainActor
│  │  └─ Has custom lock? → @unchecked (temporary)
│  └─ Can be struct? → Refactor
└─ Function/closure? → @Sendable
```

## Best Practices

1. Prefer value types—easier to make Sendable
2. Use actors for mutable state
3. Avoid @unchecked Sendable—only for proven thread-safe code
4. Mark public types explicitly
5. Ensure all members Sendable
6. Use @MainActor for UI types
7. Capture immutably in closures
8. Test with Thread Sanitizer
