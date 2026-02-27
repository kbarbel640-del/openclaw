# Migration to Swift 6

Migrating existing codebases to Swift 6's strict concurrency model.

## Project Settings

| Setting                  | Location                                 | Purpose                                   |
| ------------------------ | ---------------------------------------- | ----------------------------------------- |
| Swift language mode      | `SWIFT_VERSION` / `swift-tools-version:` | Swift 6 turns warnings into errors        |
| Strict concurrency       | `SWIFT_STRICT_CONCURRENCY`               | Controls Sendable + isolation enforcement |
| Default actor isolation  | `SWIFT_DEFAULT_ACTOR_ISOLATION`          | Changes default isolation of declarations |
| Approachable Concurrency | Build settings                           | Bundles multiple upcoming features        |

## Migration Habits

1. **Iterate incrementally** - 30 min/day, small PRs
2. **Sendable by default** - new types should be Sendable
3. **Swift 6 for new code** - packages, files
4. **Don't refactor** - focus solely on concurrency
5. **Minimal changes** - one class/module at a time
6. **Don't blindly @MainActor** - consider actual isolation needs

## Step-by-Step Process

1. **Find isolated code** - packages with minimal dependencies
2. **Update dependencies** - latest versions in separate PR
3. **Add async alternatives** - wrap closure-based APIs
4. **Set default isolation** - `@MainActor` for app projects (Swift 6.2+)
5. **Enable strict checking** - Minimal → Targeted → Complete
6. **Add Sendable** - to types crossing isolation
7. **Enable upcoming features** - one at a time
8. **Switch to Swift 6** - language mode

## Strict Concurrency Levels

| Level    | What it checks                                        |
| -------- | ----------------------------------------------------- |
| Minimal  | Only explicit concurrency (`@Sendable`, `@MainActor`) |
| Targeted | All code adopting concurrency + Sendable              |
| Complete | Entire codebase (matches Swift 6)                     |

## Adding Async Alternatives

```swift
// Deprecated closure API
@available(*, deprecated, renamed: "fetchImage(urlRequest:)")
func fetchImage(urlRequest: URLRequest,
                completion: @escaping @Sendable (Result<UIImage, Error>) -> Void)

// New async wrapper
func fetchImage(urlRequest: URLRequest) async throws -> UIImage {
    try await withCheckedThrowingContinuation { continuation in
        fetchImage(urlRequest: urlRequest) { result in
            continuation.resume(with: result)
        }
    }
}
```

**Tip**: Use Xcode's **Refactor → Add Async Wrapper**.

## Migration Tooling (Swift 6.2+)

### Xcode

1. Build Settings → Find upcoming feature
2. Set to **Migrate**
3. Build → Apply fix-its

### Package

```bash
swift package migrate --to-feature ExistentialAny
swift package migrate --target MyTarget --to-feature InferIsolatedConformances
```

## @preconcurrency

Suppresses Sendable warnings from modules you don't control:

```swift
// TODO: Remove when SomeLibrary adds Sendable support
@preconcurrency import SomeThirdPartyLibrary
```

**Use sparingly** - only when compiler suggests it.

## Combine/RxSwift Migration

### Debouncing

```swift
// Combine
$searchQuery.debounce(for: .milliseconds(500), scheduler: DispatchQueue.main)

// Swift Concurrency
func search(_ query: String) {
    currentSearchTask?.cancel()
    currentSearchTask = Task {
        try await Task.sleep(for: .milliseconds(500))
        performSearch(query)
    }
}
```

### Actor Isolation with Combine

```swift
// Problem: sink doesn't respect actor isolation
@MainActor class Observer {
    init() {
        NotificationCenter.default.publisher(for: .someNotification)
            .sink { [weak self] _ in
                self?.handle() // May crash if posted from background
            }
    }
}

// Solution: Use Swift Concurrency
Task { [weak self] in
    for await _ in NotificationCenter.default.notifications(named: .someNotification) {
        await self?.handle() // Compile-time safe
    }
}
```

## Concurrency-Safe Notifications (iOS 26+)

```swift
// Old way
NotificationCenter.default.addObserver(forName: .didBecomeActive, object: nil, queue: .main) { _ in
    handleDidBecomeActive() // Concurrency warning
}

// New way (MainActorMessage)
token = NotificationCenter.default.addObserver(of: UIApplication.self, for: .didBecomeActive) { message in
    handleDidBecomeActive() // Guaranteed main actor
}
```

## Common Challenges

| Challenge              | Solution                                         |
| ---------------------- | ------------------------------------------------ |
| Too much work          | 30-min daily sessions, one module at a time      |
| Team not ready         | Enable Swift 6 for new files only                |
| Dependencies not ready | `@preconcurrency`, contribute fixes              |
| Going in circles       | Take breaks, disable strict checking temporarily |

## Summary

1. Start small - isolated code with minimal dependencies
2. Be incremental - Minimal → Targeted → Complete
3. Use tooling - Xcode refactoring, `swift package migrate`
4. Create checkpoints - small, focused PRs
5. Think differently - isolation domains, not threads
