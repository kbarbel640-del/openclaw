import Foundation

public struct OpenClawChatSessionsDefaults: Codable, Sendable {
    public let model: String?
    public let contextTokens: Int?
}

public struct OpenClawChatSessionEntry: Codable, Identifiable, Sendable, Hashable {
    public var id: String { self.key }

    public let key: String
    public let kind: String?
    public let displayName: String?
    public let surface: String?
    public let subject: String?
    public let room: String?
    public let space: String?
    public let updatedAt: Double?
    public let sessionId: String?

    public let systemSent: Bool?
    public let abortedLastRun: Bool?
    public let thinkingLevel: String?
    public let verboseLevel: String?

    public let inputTokens: Int?
    public let outputTokens: Int?
    public let totalTokens: Int?

    public let model: String?
    public let contextTokens: Int?
}

public struct OpenClawChatSessionsListResponse: Codable, Sendable {
    public let ts: Double?
    public let path: String?
    public let count: Int?
    public let defaults: OpenClawChatSessionsDefaults?
    public let sessions: [OpenClawChatSessionEntry]
}

// MARK: - Session labels

public extension OpenClawChatSessionEntry {
    /// Preferred label for showing this session in UI.
    ///
    /// Rules:
    /// - Prefer explicit `displayName` when present.
    /// - If missing, disambiguate Telegram forum topic sessions for Aj's group.
    /// - Otherwise fall back to `key`.
    var preferredLabel: String {
        return Self.preferredLabel(forKey: self.key, displayName: self.displayName)
    }

    static func preferredLabel(forKey key: String, displayName: String?) -> String {
        let trimmed = (displayName ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty { return trimmed }

        if let topicId = Self.telegramTopicIdIfKnownGroup(from: key) {
            switch topicId {
            case 1: return "General"
            case 3: return "Config & Setup"
            case 5: return "Tasks"
            case 7: return "Memory"
            case 9: return "Notes"
            case 11: return "Coding Projects"
            case 199: return "Cron Jobs"
            default: return "Topic \(topicId)"
            }
        }

        return key
    }

    private static func telegramTopicIdIfKnownGroup(from sessionKey: String) -> Int? {
        // Example: agent:main:telegram:group:-1003818623107:topic:5
        let marker = "telegram:group:-1003818623107:topic:"
        guard let range = sessionKey.range(of: marker) else { return nil }
        let remainder = sessionKey[range.upperBound...]
        guard let idStr = remainder.split(separator: ":").first else { return nil }
        return Int(idStr)
    }
}
