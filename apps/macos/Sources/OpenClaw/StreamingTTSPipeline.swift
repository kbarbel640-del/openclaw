import Foundation
import OSLog

// MARK: - Text Segmenter

/// Segments streaming text into sentences for TTS.
/// Rules:
/// - Primary: split on 。！？!?
/// - Fallback: 40+ chars without punctuation
/// - Minimum: 12 chars per segment
final class TextSegmenter: @unchecked Sendable {
    private let lock = NSLock()
    private var buffer = ""
    private var segments: [String] = []
    private var isFinished = false
    
    private let logger = Logger(subsystem: "ai.openclaw", category: "text.segmenter")
    
    /// Sentence-ending punctuation (including Chinese comma for earlier breaks)
    private static let sentenceEnders = CharacterSet(charactersIn: "。！？!?，,")
    /// Minimum characters per segment (lowered for faster first playback)
    private static let minChars = 6
    /// Maximum characters before forced break (lowered for faster streaming)
    private static let maxChars = 25
    
    /// Feed new text delta into the segmenter
    func feed(_ delta: String) {
        lock.lock()
        defer { lock.unlock() }
        
        buffer.append(delta)
        flushReadySegments()
    }
    
    /// Signal end of input, flush any remaining text
    func finish() {
        lock.lock()
        defer { lock.unlock() }
        
        let remaining = buffer.trimmingCharacters(in: .whitespacesAndNewlines)
        if !remaining.isEmpty {
            logger.info("Segmenter flush remaining: \(remaining.prefix(30), privacy: .public)...")
            segments.append(remaining)
        }
        buffer = ""
        isFinished = true
    }
    
    /// Get next segment if available
    func nextSegment() -> String? {
        lock.lock()
        defer { lock.unlock() }
        
        if segments.isEmpty {
            return nil
        }
        return segments.removeFirst()
    }
    
    /// Check if segmenter has finished and all segments consumed
    func isDone() -> Bool {
        lock.lock()
        defer { lock.unlock() }
        return isFinished && segments.isEmpty
    }
    
    /// Check if there are pending segments
    func hasPendingSegments() -> Bool {
        lock.lock()
        defer { lock.unlock() }
        return !segments.isEmpty
    }
    
    private func flushReadySegments() {
        while let segment = extractNextSegment() {
            logger.info("Segmenter output: \(segment.prefix(30), privacy: .public)...")
            segments.append(segment)
        }
    }
    
    private func extractNextSegment() -> String? {
        guard !buffer.isEmpty else { return nil }
        
        // Find sentence-ending punctuation
        if let range = buffer.rangeOfCharacter(from: Self.sentenceEnders) {
            let endIndex = buffer.index(after: range.lowerBound)
            let segment = String(buffer[..<endIndex])
            
            // Check minimum length
            if segment.count >= Self.minChars {
                buffer.removeSubrange(..<endIndex)
                return segment.trimmingCharacters(in: .whitespacesAndNewlines)
            }
            // Too short, wait for more text
            return nil
        }
        
        // No punctuation found, check if buffer exceeds max
        if buffer.count >= Self.maxChars {
            // Find a good break point (space, comma, etc.)
            let searchRange = buffer.startIndex..<buffer.index(buffer.startIndex, offsetBy: Self.maxChars)
            
            // Try to break at natural boundaries (Chinese comma)
            if let commaRange = buffer.range(of: "，", options: .backwards, range: searchRange) {
                let segment = String(buffer[..<buffer.index(after: commaRange.lowerBound)])
                if segment.count >= Self.minChars {
                    buffer.removeSubrange(..<buffer.index(after: commaRange.lowerBound))
                    return segment.trimmingCharacters(in: .whitespacesAndNewlines)
                }
            }
            
            // Try space
            if let spaceIdx = buffer[searchRange].lastIndex(of: " ") {
                let segment = String(buffer[...spaceIdx])
                if segment.count >= Self.minChars {
                    buffer.removeSubrange(...spaceIdx)
                    return segment.trimmingCharacters(in: .whitespacesAndNewlines)
                }
            }
            
            // Force break at max chars
            let endIdx = buffer.index(buffer.startIndex, offsetBy: Self.maxChars)
            let segment = String(buffer[..<endIdx])
            buffer.removeSubrange(..<endIdx)
            return segment.trimmingCharacters(in: .whitespacesAndNewlines)
        }
        
        return nil
    }
}

// MARK: - Streaming TTS Manager

/// Manages streaming TTS with concurrent synthesis and sequential playback.
actor StreamingTTSManager {
    
    private let logger = Logger(subsystem: "ai.openclaw", category: "streaming.tts")
    
    private let segmenter = TextSegmenter()
    private let apiKey: String
    private let model: String
    private let voiceId: String
    private let maxConcurrent: Int
    
    /// Audio chunks ready for playback (in order)
    private var audioQueue: [Data] = []
    
    /// Segment index being processed
    private var nextSegmentId = 0
    
    /// Completed segment IDs mapped to audio data
    private var completedSegments: [Int: Data] = [:]
    
    /// Next segment ID to output
    private var nextOutputId = 0
    
    /// Active synthesis tasks
    private var activeTasks: [Int: Task<Void, Never>] = [:]
    
    /// Whether input is finished
    private var inputFinished = false
    
    /// Whether cancelled
    private var isCancelled = false
    
    init(apiKey: String, model: String, voiceId: String, maxConcurrent: Int = 2) {
        self.apiKey = apiKey
        self.model = model
        self.voiceId = voiceId
        self.maxConcurrent = maxConcurrent
    }
    
    /// Feed text delta from LLM
    func feed(_ delta: String) {
        guard !isCancelled else { return }
        segmenter.feed(delta)
        scheduleSegments()
    }
    
    /// Signal end of LLM output
    func finish() {
        guard !isCancelled else { return }
        segmenter.finish()
        inputFinished = true
        scheduleSegments()
    }
    
    /// Cancel all pending work
    func cancel() {
        isCancelled = true
        for (_, task) in activeTasks {
            task.cancel()
        }
        activeTasks.removeAll()
        audioQueue.removeAll()
        completedSegments.removeAll()
    }
    
    /// Get audio stream for playback
    func audioStream() -> AsyncThrowingStream<Data, Error> {
        AsyncThrowingStream { continuation in
            Task {
                await self.runPlaybackLoop(continuation: continuation)
            }
        }
    }
    
    private func runPlaybackLoop(continuation: AsyncThrowingStream<Data, Error>.Continuation) async {
        while !isCancelled {
            // Try to output next segment in order
            if let audioData = completedSegments[nextOutputId] {
                completedSegments.removeValue(forKey: nextOutputId)
                logger.info("Yielding audio segment \(self.nextOutputId): \(audioData.count) bytes")
                continuation.yield(audioData)
                nextOutputId += 1
                continue
            }
            
            // Check if we're done
            if inputFinished && segmenter.isDone() && activeTasks.isEmpty && completedSegments.isEmpty {
                logger.info("Streaming TTS complete")
                continuation.finish()
                return
            }
            
            // Schedule more work if possible
            scheduleSegments()
            
            // Wait a bit before checking again
            try? await Task.sleep(nanoseconds: 50_000_000) // 50ms
        }
        
        continuation.finish()
    }
    
    private func scheduleSegments() {
        guard !isCancelled else { return }
        
        // Start synthesis for pending segments up to maxConcurrent
        while activeTasks.count < maxConcurrent {
            guard let text = segmenter.nextSegment() else {
                break
            }
            
            let segmentId = nextSegmentId
            nextSegmentId += 1
            
            logger.info("Starting synthesis for segment \(segmentId): \(text.prefix(30), privacy: .public)...")
            
            let task = Task {
                await self.synthesizeSegment(id: segmentId, text: text)
            }
            activeTasks[segmentId] = task
        }
    }
    
    private func synthesizeSegment(id: Int, text: String) async {
        defer {
            activeTasks.removeValue(forKey: id)
            scheduleSegments() // Try to schedule more after completion
        }
        
        guard !isCancelled else { return }
        
        do {
            let client = MiniMaxTTSClient(apiKey: apiKey, model: model, voiceId: voiceId)
            var audioData = Data()
            
            let stream = await client.streamSynthesize(text: text)
            for try await chunk in stream {
                audioData.append(chunk)
            }
            await client.disconnect()
            
            guard !isCancelled else { return }
            
            if audioData.isEmpty {
                logger.warning("Segment \(id) produced no audio")
            } else {
                logger.info("Segment \(id) complete: \(audioData.count) bytes")
                completedSegments[id] = audioData
            }
            
        } catch {
            logger.error("Segment \(id) failed: \(error.localizedDescription, privacy: .public)")
            // Skip failed segment, don't block playback
        }
    }
}
