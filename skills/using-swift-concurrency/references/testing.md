# Testing Concurrent Code

Best practices for testing async/await code with Swift Testing (recommended) and XCTest.

## Contents

- [Swift Testing Basics](#swift-testing-basics)
- [Actor Isolation in Tests](#actor-isolation-in-tests)
- [MainActor in Test Contexts](#mainactor-in-test-contexts)
- [Awaiting Callbacks](#awaiting-callbacks)
- [Setup and Teardown](#setup-and-teardown)
- [Converting ObjC Tests to Async](#converting-objc-tests-to-async)
- [Sendable in Tests](#sendable-in-tests)
- [Handling Flaky Tests](#handling-flaky-tests)
- [XCTest Patterns](#xctest-patterns-legacy)
- [Troubleshooting](#troubleshooting)

## Swift Testing Basics

```swift
@Test
@MainActor
func emptyQuery() async {
    let searcher = ArticleSearcher()
    await searcher.search("")
    #expect(searcher.results == ArticleSearcher.allArticles)
}
```

| XCTest               | Swift Testing      |
| -------------------- | ------------------ |
| `XCTestCase`         | `@Test` macro      |
| `XCTAssert`          | `#expect`          |
| Classes required     | Structs preferred  |
| `test` prefix        | Not required       |
| `wait(for:)`         | `confirmation { }` |
| Implicit main thread | Explicit isolation |

**Key difference**: Swift Testing runs tests on arbitrary threads by default, not the main thread. Add `@MainActor` when testing UI or MainActor-isolated code.

## Actor Isolation in Tests

### Testing Actor-Isolated Code

```swift
actor DataStore {
    private var items: [Item] = []
    func add(_ item: Item) { items.append(item) }
    func count() -> Int { items.count }
}

@Test
func actorAddItem() async {
    let store = DataStore()
    await store.add(Item(id: 1))
    let count = await store.count()
    #expect(count == 1)
}
```

### Testing @MainActor Classes

```swift
@MainActor
class ViewModel: ObservableObject {
    @Published var isLoading = false
    func load() async { isLoading = true }
}

@Test
@MainActor  // Required—matches ViewModel isolation
func viewModelLoading() async {
    let vm = ViewModel()
    await vm.load()
    #expect(vm.isLoading == true)
}
```

### Cross-Isolation Testing

```swift
@Test
func crossIsolationTest() async {
    let vm = await MainActor.run { ViewModel() }
    await vm.load()
    let isLoading = await MainActor.run { vm.isLoading }
    #expect(isLoading == true)
}
```

## MainActor in Test Contexts

### When to Use @MainActor on Tests

| Scenario                        | Use @MainActor? |
| ------------------------------- | --------------- |
| Testing @MainActor class        | Yes             |
| Testing actor (not MainActor)   | No              |
| Testing nonisolated async code  | No              |
| Accessing @Published properties | Yes             |
| Testing UI components           | Yes             |

### MainActor.run vs @MainActor

```swift
// Option 1: Entire test on MainActor
@Test @MainActor
func testFullIsolation() async {
    let vm = ViewModel()  // Direct access
    vm.update()
}

// Option 2: Selective MainActor access
@Test
func testSelectiveIsolation() async {
    let result = await MainActor.run {
        let vm = ViewModel()
        vm.update()
        return vm.value
    }
    #expect(result == expected)
}
```

### MainActor.assumeIsolated (Swift 5.10+)

For synchronous code that must run on MainActor but can't be marked async:

```swift
@Test @MainActor
func testWithAssumedIsolation() {
    MainActor.assumeIsolated {
        // Synchronous MainActor code
        viewController.updateUI()
    }
}
```

## Awaiting Callbacks

### Using Confirmations

```swift
@Test @MainActor
func searchTriggersObservation() async {
    let searcher = ArticleSearcher()
    await confirmation { confirm in
        _ = withObservationTracking { searcher.results } onChange: { confirm() }
        await searcher.search("swift")
    }
}
```

### Using Continuations

```swift
@Test @MainActor
func callbackCompletes() async {
    let service = LegacyService()
    await withCheckedContinuation { continuation in
        service.fetchData { _ in continuation.resume() }
    }
}
```

## Setup and Teardown

### Async init/deinit Pattern

```swift
@MainActor
final class DatabaseTests {
    let database: Database

    init() async throws {
        database = Database()
        await database.prepare()
    }

    @Test func insertsData() async throws {
        try await database.insert(item)
    }
}
```

### Test Scoping Traits

```swift
@MainActor
struct DatabaseTrait: SuiteTrait, TestTrait, TestScoping {
    func provideScope(for test: Test, testCase: Test.Case?,
                      performing function: () async throws -> Void) async throws {
        let db = Database()
        try await Environment.$database.withValue(db) {
            await db.prepare()
            try await function()
            await db.cleanup()
        }
    }
}

@Suite(DatabaseTrait())
final class DatabaseTests { }
```

## Converting ObjC Tests to Async

### XCTestExpectation to Confirmation

```objc
// Before: Objective-C with expectations
- (void)testFetchData {
    XCTestExpectation *exp = [self expectationWithDescription:@"fetch"];
    [self.service fetchDataWithCompletion:^(NSData *data, NSError *error) {
        XCTAssertNotNil(data);
        [exp fulfill];
    }];
    [self waitForExpectationsWithTimeout:5 handler:nil];
}
```

```swift
// After: Swift Testing with async
@Test
func fetchData() async throws {
    let data = try await service.fetchData()
    #expect(data != nil)
}
```

### Bridging Completion Handlers

```swift
// Create async wrapper for ObjC completion handler API
extension LegacyObjCService {
    func fetchData() async throws -> Data {
        try await withCheckedThrowingContinuation { continuation in
            fetchData { data, error in
                if let error { continuation.resume(throwing: error) }
                else if let data { continuation.resume(returning: data) }
                else { continuation.resume(throwing: UnexpectedNilError()) }
            }
        }
    }
}

@Test
func legacyServiceWorks() async throws {
    let service = LegacyObjCService()
    let data = try await service.fetchData()
    #expect(!data.isEmpty)
}
```

### OCMock to Protocol-Based Mocking

```swift
// Replace OCMock with protocol + async
protocol DataFetching: Sendable {
    func fetch() async throws -> Data
}

struct MockFetcher: DataFetching {
    let result: Result<Data, Error>
    func fetch() async throws -> Data { try result.get() }
}

@Test
func handlesError() async {
    let mock = MockFetcher(result: .failure(TestError()))
    let handler = DataHandler(fetcher: mock)
    await #expect(throws: TestError.self) { try await handler.process() }
}
```

## Sendable in Tests

### Mock Types Must Be Sendable

```swift
// Error: Mock captured in async context must be Sendable
final class MockService { var callCount = 0 }  // Not Sendable

// Fix 1: Use actor
actor MockService {
    var callCount = 0
    func increment() { callCount += 1 }
}

// Fix 2: Use struct with let
struct MockService: Sendable {
    let response: Data
    func fetch() async -> Data { response }
}

// Fix 3: Use @unchecked Sendable (test-only, document why safe)
final class MockService: @unchecked Sendable {
    var callCount = 0  // Only accessed from test, never concurrent
}
```

### Capturing in Confirmations

```swift
@Test
func captureInConfirmation() async {
    let results = LockIsolated<[String]>([])  // Thread-safe wrapper

    await confirmation(expectedCount: 3) { confirm in
        for item in ["a", "b", "c"] {
            Task {
                results.withValue { $0.append(item) }
                confirm()
            }
        }
    }
    #expect(results.value.count == 3)
}
```

## Handling Flaky Tests

### Main Serial Executor

```swift
import ConcurrencyExtras

@Test @MainActor
func isLoadingState() async throws {
    try await withMainSerialExecutor {
        let fetcher = ImageFetcher { _ in
            await Task.yield()
            return Data()
        }
        let task = Task { try await fetcher.fetch(url) }
        await Task.yield()
        #expect(fetcher.isLoading == true)
        try await task.value
        #expect(fetcher.isLoading == false)
    }
}
```

### Serialized Suites

```swift
@Suite(.serialized)
final class StatefulTests {
    @Test func first() async { }
    @Test func second() async { }  // Waits for first
}
```

## XCTest Patterns (Legacy)

```swift
final class Tests: XCTestCase {
    @MainActor
    func testSearch() async {
        let searcher = ArticleSearcher()
        await searcher.search("")
        XCTAssertEqual(searcher.results, ArticleSearcher.allArticles)
    }
}

// Use await fulfillment, NOT wait
await fulfillment(of: [expectation], timeout: 10)

// Async setup/teardown
override func setUp() async throws { }
override func tearDown() async throws { }
```

## Troubleshooting

| Problem                  | Cause                      | Solution                     |
| ------------------------ | -------------------------- | ---------------------------- |
| Test hangs               | Expectation never fulfills | Add timeout, verify tracking |
| Flaky test               | Race condition             | Use main serial executor     |
| Deadlock                 | `wait(for:)` in async      | Use `await fulfillment(of:)` |
| Actor isolation error    | Wrong test isolation       | Add `@MainActor` to test     |
| "non-Sendable capture"   | Mock not Sendable          | Use actor or Sendable struct |
| MainActor code crashes   | Test not on MainActor      | Add `@MainActor` annotation  |
| ObjC callback not called | Continuation not resumed   | Check all code paths resume  |

## Best Practices

1. **Match isolation** - Test isolation should match code under test
2. **Swift Testing for new code** - Better async support than XCTest
3. **Sendable mocks** - Use actors or Sendable structs
4. **Confirmations over continuations** - Cleaner, timeout handling
5. **Serialize when needed** - Use `.serialized` trait for stateful tests
6. **Test cancellation** - Verify tasks handle cancellation correctly
7. **Avoid sleep** - Use continuations, confirmations, or Task.yield
8. **Wrap ObjC APIs** - Create async extensions for legacy code
