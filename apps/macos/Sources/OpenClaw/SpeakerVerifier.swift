import Accelerate
import AVFoundation
import FluidAudio
import OSLog

/// Thread-safe actor for speaker enrollment and real-time verification.
actor SpeakerVerifier {
    static let shared = SpeakerVerifier()

    static let enabledKey = "openclaw.speakerVerification.enabled"
    static let thresholdKey = "openclaw.speakerVerification.threshold"
    private static let embeddingKey = "openclaw.speakerVerification.embedding"

    private let logger = Logger(subsystem: "ai.openclaw", category: "speaker.verifier")
    private var diarizer: DiarizerManager?
    private var enrolledEmbedding: [Float]?
    private var isLoadingModels = false

    var isEnrolled: Bool { enrolledEmbedding != nil }

    var isEnabled: Bool {
        UserDefaults.standard.bool(forKey: Self.enabledKey)
    }

    var threshold: Float {
        let v = UserDefaults.standard.double(forKey: Self.thresholdKey)
        return v > 0 ? Float(min(0.95, max(0.2, v))) : 0.35
    }

    var isModelReady: Bool { diarizer != nil }

    private init() {
        if let data = UserDefaults.standard.data(forKey: Self.embeddingKey),
           let embedding = try? JSONDecoder().decode([Float].self, from: data)
        {
            enrolledEmbedding = embedding
        }
    }

    // MARK: - Model loading

    func loadModelsIfNeeded() async throws {
        guard diarizer == nil, !isLoadingModels else { return }
        isLoadingModels = true
        defer { isLoadingModels = false }
        logger.info("speaker-verifier: loading FluidAudio diarizer models")
        let models = try await DiarizerModels.downloadIfNeeded()
        let mgr = DiarizerManager()
        mgr.initialize(models: models)
        diarizer = mgr
        logger.info("speaker-verifier: models ready")
    }

    // MARK: - Enrollment

    /// Enroll from Float32 mono audio at any sample rate. Recommended: 8–15 seconds.
    func enroll(samples: [Float], sampleRate: Float) async throws {
        if diarizer == nil {
            try await loadModelsIfNeeded()
        }
        guard let mgr = diarizer else {
            throw SpeakerVerifierError.modelsNotLoaded
        }

        let mono16k = resampleToMono16k(samples: samples, sourceSampleRate: sampleRate)
        logger.info("speaker-verifier: enroll input samples=\(samples.count, privacy: .public) sr=\(sampleRate, privacy: .public) → 16k samples=\(mono16k.count, privacy: .public)")
        guard mono16k.count > 8000 else {
            throw SpeakerVerifierError.noSpeechDetected
        }

        let result = try mgr.performCompleteDiarization(mono16k, sampleRate: 16000)
        logger.info("speaker-verifier: enroll segments=\(result.segments.count, privacy: .public)")
        for (i, seg) in result.segments.enumerated() {
            logger.info("speaker-verifier: enroll seg[\(i, privacy: .public)] \(seg.startTimeSeconds, privacy: .public)–\(seg.endTimeSeconds, privacy: .public)s embDim=\(seg.embedding.count, privacy: .public)")
        }
        guard let dominant = dominantSegment(in: result.segments) else {
            throw SpeakerVerifierError.noSpeechDetected
        }

        let embedding = dominant.embedding
        var norm: Float = 0
        vDSP_svesq(embedding, 1, &norm, vDSP_Length(embedding.count))
        enrolledEmbedding = embedding

        if let data = try? JSONEncoder().encode(embedding) {
            UserDefaults.standard.set(data, forKey: Self.embeddingKey)
        }
        logger.info("speaker-verifier: enrolled dim=\(embedding.count, privacy: .public) norm=\(sqrt(norm), privacy: .public) seg=\(dominant.startTimeSeconds, privacy: .public)–\(dominant.endTimeSeconds, privacy: .public)s")
    }

    // MARK: - Verification

    /// Returns true if audio matches the enrolled user, or if disabled / not enrolled.
    func verify(samples: [Float], sampleRate: Float) async -> Bool {
        guard isEnabled else { return true }
        guard let enrolled = enrolledEmbedding else { return true }
        guard let mgr = diarizer else {
            logger.warning("speaker-verifier: models not ready, passing through")
            return true
        }

        let mono16k = resampleToMono16k(samples: samples, sourceSampleRate: sampleRate)
        logger.info("speaker-verifier: verify input samples=\(samples.count, privacy: .public) sr=\(sampleRate, privacy: .public) → 16k samples=\(mono16k.count, privacy: .public) enrolled_dim=\(enrolled.count, privacy: .public)")
        guard mono16k.count > 1600 else { return true }

        do {
            let result = try mgr.performCompleteDiarization(mono16k, sampleRate: 16000)
            logger.info("speaker-verifier: verify segments=\(result.segments.count, privacy: .public)")
            guard let dominant = dominantSegment(in: result.segments) else {
                logger.info("speaker-verifier: no speech detected, passing through")
                return true
            }
            let segDuration = dominant.endTimeSeconds - dominant.startTimeSeconds
            logger.info("speaker-verifier: verify dominant seg=\(dominant.startTimeSeconds, privacy: .public)–\(dominant.endTimeSeconds, privacy: .public)s (\(segDuration, privacy: .public)s) embDim=\(dominant.embedding.count, privacy: .public)")
            // WeSpeaker needs ≥2 s of speech for reliable embeddings.
            // Short utterances pass through rather than block the user.
            guard segDuration >= 2.0 else {
                logger.info("speaker-verifier: speech too short (\(segDuration, privacy: .public)s < 2s), passing through")
                return true
            }
            let sim = cosineSimilarity(dominant.embedding, enrolled)
            let pass = sim >= threshold
            logger.info(
                "speaker-verifier: similarity=\(sim, privacy: .public) threshold=\(threshold, privacy: .public) pass=\(pass, privacy: .public)")
            return pass
        } catch {
            logger.error("speaker-verifier: diarization failed: \(error.localizedDescription, privacy: .public)")
            return true
        }
    }

    // MARK: - Enrollment management

    func clearEnrollment() {
        enrolledEmbedding = nil
        UserDefaults.standard.removeObject(forKey: Self.embeddingKey)
        logger.info("speaker-verifier: enrollment cleared")
    }

    // MARK: - Private helpers

    private func dominantSegment(in segments: [TimedSpeakerSegment]) -> TimedSpeakerSegment? {
        segments.max(by: { ($0.endTimeSeconds - $0.startTimeSeconds) < ($1.endTimeSeconds - $1.startTimeSeconds) })
    }

    private func cosineSimilarity(_ a: [Float], _ b: [Float]) -> Float {
        guard a.count == b.count, !a.isEmpty else { return 0 }
        var dot: Float = 0
        var normA: Float = 0
        var normB: Float = 0
        vDSP_dotpr(a, 1, b, 1, &dot, vDSP_Length(a.count))
        vDSP_svesq(a, 1, &normA, vDSP_Length(a.count))
        vDSP_svesq(b, 1, &normB, vDSP_Length(b.count))
        let denom = sqrt(normA) * sqrt(normB)
        return denom > 0 ? dot / denom : 0
    }

    private func resampleToMono16k(samples: [Float], sourceSampleRate: Float) -> [Float] {
        let targetRate: Double = 16000
        let srcRate = Double(sourceSampleRate)
        guard srcRate != targetRate, srcRate > 0 else { return samples }

        let srcFormat = AVAudioFormat(commonFormat: .pcmFormatFloat32,
                                      sampleRate: srcRate, channels: 1, interleaved: false)!
        let dstFormat = AVAudioFormat(commonFormat: .pcmFormatFloat32,
                                      sampleRate: targetRate, channels: 1, interleaved: false)!
        guard let converter = AVAudioConverter(from: srcFormat, to: dstFormat) else { return samples }

        let srcFrames = AVAudioFrameCount(samples.count)
        let dstFrames = AVAudioFrameCount(Double(samples.count) * targetRate / srcRate + 1)
        guard let srcBuf = AVAudioPCMBuffer(pcmFormat: srcFormat, frameCapacity: srcFrames),
              let dstBuf = AVAudioPCMBuffer(pcmFormat: dstFormat, frameCapacity: dstFrames),
              let srcPtr = srcBuf.floatChannelData?[0] else { return samples }

        srcBuf.frameLength = srcFrames
        srcPtr.initialize(from: samples, count: samples.count)

        var inputConsumed = false
        var convertError: NSError?
        converter.convert(to: dstBuf, error: &convertError) { _, outStatus in
            if inputConsumed {
                outStatus.pointee = .endOfStream
                return nil
            }
            inputConsumed = true
            outStatus.pointee = .haveData
            return srcBuf
        }

        guard convertError == nil, let dstPtr = dstBuf.floatChannelData?[0] else { return samples }
        return Array(UnsafeBufferPointer(start: dstPtr, count: Int(dstBuf.frameLength)))
    }
}

// MARK: - Errors

enum SpeakerVerifierError: Error, LocalizedError {
    case modelsNotLoaded
    case noSpeechDetected

    var errorDescription: String? {
        switch self {
        case .modelsNotLoaded:
            return "Speaker verifier models are not loaded."
        case .noSpeechDetected:
            return "No speech was detected in the enrollment audio."
        }
    }
}
