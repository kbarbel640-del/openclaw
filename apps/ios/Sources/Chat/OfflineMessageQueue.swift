import Foundation
import OSLog

/// Queues chat messages when the gateway is disconnected and delivers them on reconnect.
@MainActor
@Observable
final class OfflineMessageQueue {
    struct PendingMessage: Codable, Identifiable, Sendable {
        let id: UUID
        let text: String
        let sessionKey: String
        let thinking: String
        let createdAt: Date
        var retryCount: Int
    }

    private let logger = Logger(subsystem: "com.clawdbot", category: "offline-queue")
    private let fileURL: URL
    private let maxRetries = 3

    private(set) var pending: [PendingMessage] = []

    init() {
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        self.fileURL = docs.appendingPathComponent("offline-queue.json")
        self.load()
    }

    var count: Int { pending.count }
    var isEmpty: Bool { pending.isEmpty }

    /// Add a message to the queue when gateway is disconnected.
    func enqueue(text: String, sessionKey: String, thinking: String = "off") {
        let msg = PendingMessage(
            id: UUID(),
            text: text,
            sessionKey: sessionKey,
            thinking: thinking,
            createdAt: Date(),
            retryCount: 0
        )
        pending.append(msg)
        save()
        logger.info("Queued message for session \(sessionKey, privacy: .public): \(text.prefix(50), privacy: .public)...")
    }

    /// Remove a message after successful delivery.
    func dequeue(_ id: UUID) {
        pending.removeAll { $0.id == id }
        save()
        logger.info("Dequeued message \(id.uuidString, privacy: .public)")
    }

    /// Mark a message as failed. Removes it if max retries exceeded.
    func markFailed(_ id: UUID) {
        guard let idx = pending.firstIndex(where: { $0.id == id }) else { return }
        pending[idx].retryCount += 1
        if pending[idx].retryCount >= maxRetries {
            logger.warning("Message \(id.uuidString, privacy: .public) exceeded max retries, removing")
            pending.remove(at: idx)
        }
        save()
    }

    /// Clear all pending messages.
    func clear() {
        pending.removeAll()
        save()
        logger.info("Cleared all pending messages")
    }

    private func load() {
        guard FileManager.default.fileExists(atPath: fileURL.path) else { return }
        do {
            let data = try Data(contentsOf: fileURL)
            let decoded = try JSONDecoder().decode([PendingMessage].self, from: data)
            pending = decoded
            logger.info("Loaded \(decoded.count) pending messages from disk")
        } catch {
            logger.error("Failed to load offline queue: \(error.localizedDescription)")
        }
    }

    private func save() {
        do {
            let data = try JSONEncoder().encode(pending)
            // SECURITY: Use atomic write with data protection to encrypt at rest
            try data.write(to: fileURL, options: [.atomic, .completeFileProtection])

            // Ensure file protection is set (belt and suspenders)
            try FileManager.default.setAttributes(
                [.protectionKey: FileProtectionType.complete],
                ofItemAtPath: fileURL.path
            )
        } catch {
            logger.error("Failed to save offline queue: \(error.localizedDescription)")
        }
    }
}
