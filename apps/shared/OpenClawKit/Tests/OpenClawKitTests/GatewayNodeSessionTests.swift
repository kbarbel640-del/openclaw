import Foundation
import Testing
@testable import OpenClawKit
import OpenClawProtocol

private struct TimeoutError: Error, CustomStringConvertible {
    let label: String
    var description: String { "Timeout waiting for: \(self.label)" }
}

private func waitUntil(
    _ label: String,
    timeoutSeconds: Double = 3.0,
    pollMs: UInt64 = 10,
    _ condition: @escaping @Sendable () async -> Bool) async throws
{
    let deadline = Date().addingTimeInterval(timeoutSeconds)
    while Date() < deadline {
        if await condition() {
            return
        }
        try await Task.sleep(nanoseconds: pollMs * 1_000_000)
    }
    throw TimeoutError(label: label)
}

private extension NSLock {
    func withLock<T>(_ body: () -> T) -> T {
        self.lock()
        defer { self.unlock() }
        return body()
    }
}

private final class FakeGatewayWebSocketTask: WebSocketTasking, @unchecked Sendable {
    private let lock = NSLock()
    private let connectOkType: String
    private let connectOkProtocol: Int
    private var _state: URLSessionTask.State = .suspended
    private var connectRequestId: String?
    private var receivePhase = 0
    private var pendingReceiveHandler:
        (@Sendable (Result<URLSessionWebSocketTask.Message, Error>) -> Void)?

    init(
        connectOkType: String = "hello-ok",
        connectOkProtocol: Int = GATEWAY_PROTOCOL_VERSION)
    {
        self.connectOkType = connectOkType
        self.connectOkProtocol = connectOkProtocol
    }

    var state: URLSessionTask.State {
        get { self.lock.withLock { self._state } }
        set { self.lock.withLock { self._state = newValue } }
    }

    func resume() {
        self.state = .running
    }

    func cancel(with closeCode: URLSessionWebSocketTask.CloseCode, reason: Data?) {
        _ = (closeCode, reason)
        self.state = .canceling
        let handler = self.lock.withLock { () -> (@Sendable (Result<URLSessionWebSocketTask.Message, Error>) -> Void)? in
            defer { self.pendingReceiveHandler = nil }
            return self.pendingReceiveHandler
        }
        handler?(Result<URLSessionWebSocketTask.Message, Error>.failure(URLError(.cancelled)))
    }

    func send(_ message: URLSessionWebSocketTask.Message) async throws {
        let data: Data? = switch message {
        case let .data(d): d
        case let .string(s): s.data(using: .utf8)
        @unknown default: nil
        }
        guard let data else { return }
        if let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           obj["type"] as? String == "req",
           obj["method"] as? String == "connect",
           let id = obj["id"] as? String
        {
            self.lock.withLock { self.connectRequestId = id }
        }
    }

    func sendPing(pongReceiveHandler: @escaping @Sendable (Error?) -> Void) {
        pongReceiveHandler(nil)
    }

    func receive() async throws -> URLSessionWebSocketTask.Message {
        let phase = self.lock.withLock { () -> Int in
            let current = self.receivePhase
            self.receivePhase += 1
            return current
        }
        if phase == 0 {
            return .data(Self.connectChallengeData(nonce: "nonce-1"))
        }
        for _ in 0..<50 {
            let id = self.lock.withLock { self.connectRequestId }
            if let id {
                return .data(self.connectOkData(id: id))
            }
            try await Task.sleep(nanoseconds: 1_000_000)
        }
        return .data(self.connectOkData(id: "connect"))
    }

    func receive(
        completionHandler: @escaping @Sendable (Result<URLSessionWebSocketTask.Message, Error>) -> Void)
    {
        self.lock.withLock { self.pendingReceiveHandler = completionHandler }
    }

    func emitReceiveFailure() {
        let handler = self.lock.withLock { () -> (@Sendable (Result<URLSessionWebSocketTask.Message, Error>) -> Void)? in
            self._state = .canceling
            defer { self.pendingReceiveHandler = nil }
            return self.pendingReceiveHandler
        }
        handler?(Result<URLSessionWebSocketTask.Message, Error>.failure(URLError(.networkConnectionLost)))
    }

    private static func connectChallengeData(nonce: String) -> Data {
        let json = """
        {
          "type": "event",
          "event": "connect.challenge",
          "payload": { "nonce": "\(nonce)" }
        }
        """
        return Data(json.utf8)
    }

    private func connectOkData(id: String) -> Data {
        let json = """
        {
          "type": "res",
          "id": "\(id)",
          "ok": true,
          "payload": {
            "type": "\(self.connectOkType)",
            "protocol": \(self.connectOkProtocol),
            "server": { "version": "test", "connId": "test" },
            "features": { "methods": [], "events": [] },
            "snapshot": {
              "presence": [ { "ts": 1 } ],
              "health": {},
              "stateVersion": { "presence": 0, "health": 0 },
              "uptimeMs": 0
            },
            "policy": { "maxPayload": 1, "maxBufferedBytes": 1, "tickIntervalMs": 30000 }
          }
        }
        """
        return Data(json.utf8)
    }
}

private final class FakeGatewayWebSocketSession: WebSocketSessioning, @unchecked Sendable {
    private let lock = NSLock()
    private let connectOkType: String
    private let connectOkProtocol: Int
    private var tasks: [FakeGatewayWebSocketTask] = []
    private var makeCount = 0

    init(
        connectOkType: String = "hello-ok",
        connectOkProtocol: Int = GATEWAY_PROTOCOL_VERSION)
    {
        self.connectOkType = connectOkType
        self.connectOkProtocol = connectOkProtocol
    }

    func snapshotMakeCount() -> Int {
        self.lock.withLock { self.makeCount }
    }

    func latestTask() -> FakeGatewayWebSocketTask? {
        self.lock.withLock { self.tasks.last }
    }

    func makeWebSocketTask(url: URL) -> WebSocketTaskBox {
        _ = url
        return self.lock.withLock {
            self.makeCount += 1
            let task = FakeGatewayWebSocketTask(
                connectOkType: self.connectOkType,
                connectOkProtocol: self.connectOkProtocol)
            self.tasks.append(task)
            return WebSocketTaskBox(task: task)
        }
    }
}

private actor SeqGapProbe {
    private var saw = false
    func mark() { self.saw = true }
    func value() -> Bool { self.saw }
}

private func withTemporaryOpenClawStateDir<T>(
    _ body: @escaping @Sendable (URL) async throws -> T) async throws -> T
{
    let dir = FileManager.default.temporaryDirectory
        .appendingPathComponent("openclawkit-tests-\(UUID().uuidString)", isDirectory: true)
    try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    let envKey = "OPENCLAW_STATE_DIR"
    let original = ProcessInfo.processInfo.environment[envKey]
    setenv(envKey, dir.path, 1)
    defer {
        if let original {
            setenv(envKey, original, 1)
        } else {
            unsetenv(envKey)
        }
        try? FileManager.default.removeItem(at: dir)
    }
    return try await body(dir)
}

struct GatewayNodeSessionTests {
    @Test
    func invokeWithTimeoutReturnsUnderlyingResponseBeforeTimeout() async {
        let request = BridgeInvokeRequest(id: "1", command: "x", paramsJSON: nil)
        let response = await GatewayNodeSession.invokeWithTimeout(
            request: request,
            timeoutMs: 50,
            onInvoke: { req in
                #expect(req.id == "1")
                return BridgeInvokeResponse(id: req.id, ok: true, payloadJSON: "{}", error: nil)
            }
        )

        #expect(response.ok == true)
        #expect(response.error == nil)
        #expect(response.payloadJSON == "{}")
    }

    @Test
    func invokeWithTimeoutReturnsTimeoutError() async {
        let request = BridgeInvokeRequest(id: "abc", command: "x", paramsJSON: nil)
        let response = await GatewayNodeSession.invokeWithTimeout(
            request: request,
            timeoutMs: 10,
            onInvoke: { _ in
                try? await Task.sleep(nanoseconds: 200_000_000) // 200ms
                return BridgeInvokeResponse(id: "abc", ok: true, payloadJSON: "{}", error: nil)
            }
        )

        #expect(response.ok == false)
        #expect(response.error?.code == .unavailable)
        #expect(response.error?.message.contains("timed out") == true)
    }

    @Test
    func invokeWithTimeoutZeroDisablesTimeout() async {
        let request = BridgeInvokeRequest(id: "1", command: "x", paramsJSON: nil)
        let response = await GatewayNodeSession.invokeWithTimeout(
            request: request,
            timeoutMs: 0,
            onInvoke: { req in
                try? await Task.sleep(nanoseconds: 5_000_000)
                return BridgeInvokeResponse(id: req.id, ok: true, payloadJSON: nil, error: nil)
            }
        )

        #expect(response.ok == true)
        #expect(response.error == nil)
    }

    @Test
    func emitsSyntheticSeqGapAfterReconnectSnapshot() async throws {
        let session = FakeGatewayWebSocketSession()
        let gateway = GatewayNodeSession()
        let options = GatewayConnectOptions(
            role: "operator",
            scopes: ["operator.read"],
            caps: [],
            commands: [],
            permissions: [:],
            clientId: "openclaw-ios-test",
            clientMode: "ui",
            clientDisplayName: "iOS Test",
            includeDeviceIdentity: false)

        let stream = await gateway.subscribeServerEvents(bufferingNewest: 32)
        let probe = SeqGapProbe()
        let listenTask = Task {
            for await evt in stream {
                if evt.event == "seqGap" {
                    await probe.mark()
                    return
                }
            }
        }

        try await gateway.connect(
            url: URL(string: "ws://example.invalid")!,
            token: nil,
            password: nil,
            connectOptions: options,
            sessionBox: WebSocketSessionBox(session: session),
            onConnected: {},
            onDisconnected: { _ in },
            onInvoke: { req in
                BridgeInvokeResponse(id: req.id, ok: true, payloadJSON: nil, error: nil)
            })

        let firstTask = try #require(session.latestTask())
        firstTask.emitReceiveFailure()

        try await waitUntil("reconnect socket created") {
            session.snapshotMakeCount() >= 2
        }
        try await waitUntil("synthetic seqGap broadcast") {
            await probe.value()
        }

        listenTask.cancel()
        await gateway.disconnect()
    }

    @Test
    func connectFailsOnProtocolMismatch() async throws {
        let session = FakeGatewayWebSocketSession(connectOkProtocol: GATEWAY_PROTOCOL_VERSION - 1)
        let gateway = GatewayNodeSession()
        let options = GatewayConnectOptions(
            role: "operator",
            scopes: ["operator.read"],
            caps: [],
            commands: [],
            permissions: [:],
            clientId: "openclaw-ios-test",
            clientMode: "ui",
            clientDisplayName: "iOS Test",
            includeDeviceIdentity: false)

        do {
            try await gateway.connect(
                url: URL(string: "ws://example.invalid")!,
                token: nil,
                password: nil,
                connectOptions: options,
                sessionBox: WebSocketSessionBox(session: session),
                onConnected: {},
                onDisconnected: { _ in },
                onInvoke: { req in
                    BridgeInvokeResponse(id: req.id, ok: true, payloadJSON: nil, error: nil)
                })
            Issue.record("expected connect failure for protocol mismatch")
        } catch {
            let description = error.localizedDescription
            #expect(description.contains("protocol mismatch"))
            #expect(description.contains("expected=\(GATEWAY_PROTOCOL_VERSION)"))
            #expect(description.contains("actual=\(GATEWAY_PROTOCOL_VERSION - 1)"))
        }

        await gateway.disconnect()
    }

    @Test
    func connectFailsOnInvalidHelloType() async throws {
        let session = FakeGatewayWebSocketSession(connectOkType: "hello")
        let gateway = GatewayNodeSession()
        let options = GatewayConnectOptions(
            role: "operator",
            scopes: ["operator.read"],
            caps: [],
            commands: [],
            permissions: [:],
            clientId: "openclaw-ios-test",
            clientMode: "ui",
            clientDisplayName: "iOS Test",
            includeDeviceIdentity: false)

        do {
            try await gateway.connect(
                url: URL(string: "ws://example.invalid")!,
                token: nil,
                password: nil,
                connectOptions: options,
                sessionBox: WebSocketSessionBox(session: session),
                onConnected: {},
                onDisconnected: { _ in },
                onInvoke: { req in
                    BridgeInvokeResponse(id: req.id, ok: true, payloadJSON: nil, error: nil)
                })
            Issue.record("expected connect failure for invalid hello type")
        } catch {
            let description = error.localizedDescription
            #expect(description.contains("invalid type"))
            #expect(description.contains("expected=hello-ok"))
            #expect(description.contains("actual=hello"))
        }

        await gateway.disconnect()
    }

    @Test
    func protocolMismatchDoesNotClearStoredDeviceToken() async throws {
        try await withTemporaryOpenClawStateDir { _ in
            let identity = DeviceIdentityStore.loadOrCreate()
            _ = DeviceAuthStore.storeToken(
                deviceId: identity.deviceId,
                role: "operator",
                token: "device-token")

            let session = FakeGatewayWebSocketSession(connectOkProtocol: GATEWAY_PROTOCOL_VERSION - 1)
            let gateway = GatewayNodeSession()
            let options = GatewayConnectOptions(
                role: "operator",
                scopes: ["operator.admin"],
                caps: [],
                commands: [],
                permissions: [:],
                clientId: "openclaw-ios-test",
                clientMode: "ui",
                clientDisplayName: "iOS Test",
                includeDeviceIdentity: true)

            do {
                try await gateway.connect(
                    url: URL(string: "ws://example.invalid")!,
                    token: "shared-token",
                    password: nil,
                    connectOptions: options,
                    sessionBox: WebSocketSessionBox(session: session),
                    onConnected: {},
                    onDisconnected: { _ in },
                    onInvoke: { req in
                        BridgeInvokeResponse(id: req.id, ok: true, payloadJSON: nil, error: nil)
                    })
                Issue.record("expected connect failure for protocol mismatch")
            } catch {
                #expect(error.localizedDescription.contains("protocol mismatch"))
            }

            let stillStored = DeviceAuthStore.loadToken(deviceId: identity.deviceId, role: "operator")
            #expect(stillStored?.token == "device-token")
            await gateway.disconnect()
        }
    }
}
