import Foundation
import Observation
import OSLog

struct MeetingSummary: Identifiable, Codable {
    let id: UUID
    let title: String
    let startedAt: Date
    let endedAt: Date?
    let segmentCount: Int
    let fileName: String

    var duration: TimeInterval? {
        guard let endedAt else { return nil }
        return endedAt.timeIntervalSince(self.startedAt)
    }

    var formattedDuration: String {
        guard let duration else { return "–" }
        let total = Int(duration)
        let hours = total / 3600
        let minutes = (total % 3600) / 60
        if hours > 0 {
            return "\(hours)h \(minutes)m"
        }
        return "\(minutes)m"
    }

    var formattedDate: String {
        Self.dateFormatter.string(from: self.startedAt)
    }

    private static let dateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateStyle = .medium
        f.timeStyle = .short
        return f
    }()
}

struct StoredMeeting: Codable {
    let id: UUID
    let title: String
    let startedAt: Date
    let endedAt: Date?
    let calendarEventId: String?
    let attendees: [String]
    let transcript: [StoredSegment]

    struct StoredSegment: Codable {
        let speaker: Speaker
        let text: String
        let timestamp: Date
    }
}

@MainActor
@Observable
final class MeetingStore {
    static let shared = MeetingStore()
    private let logger = Logger(subsystem: "ai.openclaw", category: "meeting.store")
    private(set) var summaries: [MeetingSummary] = []

    private var meetingsDir: URL {
        OpenClawPaths.stateDirURL.appendingPathComponent("meetings", isDirectory: true)
    }

    init() {
        self.ensureDirectory()
    }

    private func ensureDirectory() {
        let fm = FileManager.default
        if !fm.fileExists(atPath: self.meetingsDir.path) {
            do {
                try fm.createDirectory(at: self.meetingsDir, withIntermediateDirectories: true)
            } catch {
                self.logger.error("failed to create meetings dir: \(error.localizedDescription, privacy: .public)")
            }
        }
    }

    func save(session: MeetingSession) {
        self.ensureDirectory()
        let stored = StoredMeeting(
            id: session.id,
            title: session.title,
            startedAt: session.startedAt,
            endedAt: session.endedAt,
            calendarEventId: session.calendarEventId,
            attendees: session.attendees,
            transcript: session.segments.filter(\.isFinal).map {
                StoredMeeting.StoredSegment(speaker: $0.speaker, text: $0.text, timestamp: $0.timestamp)
            })

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]

        do {
            let data = try encoder.encode(stored)
            let fileName = self.fileName(for: session)
            let fileURL = self.meetingsDir.appendingPathComponent(fileName)
            try data.write(to: fileURL, options: .atomic)
            self.logger.info("saved meeting \(session.id) to \(fileName, privacy: .public)")
            self.loadAll()
        } catch {
            self.logger.error("failed to save meeting: \(error.localizedDescription, privacy: .public)")
        }
    }

    func loadAll() {
        self.ensureDirectory()
        let fm = FileManager.default
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        do {
            let files = try fm.contentsOfDirectory(at: self.meetingsDir, includingPropertiesForKeys: [.contentModificationDateKey])
                .filter { $0.pathExtension == "json" }
                .sorted { $0.lastPathComponent > $1.lastPathComponent }

            var loaded: [MeetingSummary] = []
            for file in files {
                do {
                    let data = try Data(contentsOf: file)
                    let stored = try decoder.decode(StoredMeeting.self, from: data)
                    loaded.append(MeetingSummary(
                        id: stored.id,
                        title: stored.title,
                        startedAt: stored.startedAt,
                        endedAt: stored.endedAt,
                        segmentCount: stored.transcript.count,
                        fileName: file.lastPathComponent))
                } catch {
                    self.logger.warning("skipping malformed meeting file \(file.lastPathComponent, privacy: .public)")
                }
            }
            self.summaries = loaded
        } catch {
            self.logger.error("failed to list meetings dir: \(error.localizedDescription, privacy: .public)")
            self.summaries = []
        }
    }

    func load(id: UUID) -> StoredMeeting? {
        guard let summary = self.summaries.first(where: { $0.id == id }) else { return nil }
        let fileURL = self.meetingsDir.appendingPathComponent(summary.fileName)
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        do {
            let data = try Data(contentsOf: fileURL)
            return try decoder.decode(StoredMeeting.self, from: data)
        } catch {
            self.logger.error("failed to load meeting \(id): \(error.localizedDescription, privacy: .public)")
            return nil
        }
    }

    func delete(id: UUID) {
        guard let summary = self.summaries.first(where: { $0.id == id }) else { return }
        let fileURL = self.meetingsDir.appendingPathComponent(summary.fileName)
        do {
            try FileManager.default.removeItem(at: fileURL)
            self.logger.info("deleted meeting \(id)")
            self.loadAll()
        } catch {
            self.logger.error("failed to delete meeting \(id): \(error.localizedDescription, privacy: .public)")
        }
    }

    private func fileName(for session: MeetingSession) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd_HH-mm"
        let dateStr = formatter.string(from: session.startedAt)
        let slug = Self.slugify(session.title)
        return "\(dateStr)_\(slug).json"
    }

    private static func slugify(_ title: String) -> String {
        let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-"))
        let slug = title
            .lowercased()
            .replacingOccurrences(of: " ", with: "-")
            .unicodeScalars
            .filter { allowed.contains($0) }
            .map { Character($0) }
        let result = String(slug)
        if result.isEmpty { return "meeting" }
        return String(result.prefix(50))
    }
}
