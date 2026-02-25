# Core Data and Swift Concurrency

Thread-safe patterns for Core Data.

## Core Rules

| Rule                                | Reason                           |
| ----------------------------------- | -------------------------------- |
| NSManagedObject can't cross threads | Not Sendable                     |
| Use context's thread only           | Thread confinement               |
| NSManagedObjectID is Sendable       | Safe to pass around              |
| Don't use @unchecked Sendable       | Hides problems, doesn't fix them |

## Data Access Objects (DAO)

Thread-safe value types representing managed objects:

```swift
// Managed object (NOT Sendable)
@objc(Article)
public class Article: NSManagedObject {
    @NSManaged public var title: String?
}

// DAO (Sendable)
struct ArticleDAO: Sendable, Identifiable {
    let id: NSManagedObjectID
    let title: String

    init?(managedObject: Article) {
        guard let title = managedObject.title else { return nil }
        self.id = managedObject.objectID
        self.title = title
    }
}
```

## Simple CoreDataStore Pattern

```swift
nonisolated struct CoreDataStore {
    static let shared = CoreDataStore()
    let persistentContainer: NSPersistentContainer

    private init() {
        persistentContainer = NSPersistentContainer(name: "MyApp")
        persistentContainer.viewContext.automaticallyMergesChangesFromParent = true
        Task { [persistentContainer] in
            try? await persistentContainer.loadPersistentStores()
        }
    }

    // Main thread operations
    @MainActor
    func perform(_ block: (NSManagedObjectContext) throws -> Void) rethrows {
        try block(persistentContainer.viewContext)
    }

    // Background operations
    @concurrent
    func performInBackground<T>(_ block: @escaping (NSManagedObjectContext) throws -> T) async rethrows -> T {
        let context = persistentContainer.newBackgroundContext()
        return try await context.perform { try block(context) }
    }
}
```

### Usage

```swift
// Main thread
@MainActor
func loadArticles() throws -> [Article] {
    try CoreDataStore.shared.perform { context in
        try context.fetch(Article.fetchRequest())
    }
}

// Background
func deleteAll() async throws {
    try await CoreDataStore.shared.performInBackground { context in
        let articles = try context.fetch(Article.fetchRequest())
        articles.forEach { context.delete($0) }
        try context.save()
    }
}
```

## Passing Data Between Contexts

Always use NSManagedObjectID:

```swift
// Pass ID only
let articleID = article.objectID

// Fetch in target context
@MainActor
func display(id: NSManagedObjectID) {
    guard let article = viewContext.object(with: id) as? Article else { return }
    // Use article
}

func process(id: NSManagedObjectID) async throws {
    try await CoreDataStore.shared.performInBackground { context in
        guard let article = context.object(with: id) as? Article else { return }
        // Process article
        try context.save()
    }
}
```

## Default @MainActor Isolation Conflict

When using default `@MainActor` isolation, auto-generated managed objects conflict:

```swift
// Auto-generated (can't modify) - conflicts with @MainActor
class Article: NSManagedObject { }
```

**Solution**: Use manual code generation and mark as nonisolated:

```swift
nonisolated class Article: NSManagedObject {
    @NSManaged public var title: String?
}
```

## Debugging

Enable Core Data concurrency debugging:

```bash
-com.apple.CoreData.ConcurrencyDebug 1
```

Crashes immediately on thread violations.

## Decision Tree

```
Core Data access?
├─ UI/View context? → @MainActor + viewContext
├─ Background operation? → perform { } on background context
├─ Pass between contexts? → Use NSManagedObjectID only
└─ Need Sendable type? → Use DAO pattern
```

## Common Mistakes

```swift
// Passing managed objects
func process(article: Article) async { }  // NOT Sendable

// Wrong thread
func background() async {
    viewContext.fetch(request)  // NOT on main thread
}

// Using @unchecked Sendable
extension Article: @unchecked Sendable { }  // Doesn't make it safe

// Not using perform
backgroundContext.save()  // NOT on context's thread
```

## Best Practices

1. Pass NSManagedObjectID only—never managed objects
2. Use perform { }—don't access context directly
3. @MainActor for view context operations
4. @concurrent for background operations
5. Manual code generation for control
6. Enable concurrency debugging
7. Enable automaticallyMergesChangesFromParent
8. Test with Thread Sanitizer
