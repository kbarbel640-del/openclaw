import AVFoundation
import OSLog
import SwiftUI

struct TalkModeSettings: View {
    let isActive: Bool

    @State private var isEnrolling = false
    @State private var enrollTimeRemaining: Int = 0
    @State private var micLevel: Double = 0
    @State private var enrollmentError: String?
    @State private var enrollmentSuccess = false
    @State private var isEnrolled = false
    @State private var isEnabled = false
    @State private var threshold: Double = 0.75

    private let isPreview = ProcessInfo.processInfo.isPreview

    private var enabledBinding: Binding<Bool> {
        Binding(
            get: { self.isEnabled },
            set: { newValue in
                self.isEnabled = newValue
                UserDefaults.standard.set(newValue, forKey: SpeakerVerifier.enabledKey)
                if newValue {
                    Task { try? await SpeakerVerifier.shared.loadModelsIfNeeded() }
                }
            })
    }

    var body: some View {
        ScrollView(.vertical) {
            VStack(alignment: .leading, spacing: 14) {
                GroupBox("Speaker Verification") {
                    VStack(alignment: .leading, spacing: 12) {
                        Toggle("Verify speaker identity", isOn: self.enabledBinding)
                            .toggleStyle(.checkbox)

                        Divider()

                        self.statusRow
                        self.enrollRow

                        if self.isEnrolled {
                            self.clearRow
                        }

                        if self.isEnabled, self.isEnrolled {
                            Divider()
                            self.thresholdRow
                        }
                    }
                    .padding(.vertical, 4)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 24)
            .padding(.vertical, 18)
        }
        .groupBoxStyle(PlainSettingsGroupBoxStyle())
        .onAppear {
            guard !self.isPreview else { return }
            self.syncFromVerifier()
        }
        .onChange(of: self.isActive) { _, active in
            guard !self.isPreview else { return }
            if active {
                self.syncFromVerifier()
            } else {
                self.stopEnrolling()
            }
        }
        .onDisappear {
            guard !self.isPreview else { return }
            self.stopEnrolling()
        }
    }

    private var statusRow: some View {
        HStack(spacing: 10) {
            Text("Status")
                .frame(width: 100, alignment: .leading)

            if self.isEnrolled {
                Label("Enrolled", systemImage: "checkmark.circle.fill")
                    .foregroundStyle(.green)
                    .font(.callout)
            } else {
                Text("Not enrolled")
                    .foregroundStyle(.secondary)
                    .font(.callout)
            }
        }
    }

    private var enrollRow: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                Button("Enroll my voice") {
                    self.startEnrolling()
                }
                .buttonStyle(.borderedProminent)
                .disabled(self.isEnrolling)

                if self.isEnrolling {
                    Text("Recording… \(self.enrollTimeRemaining)s remaining")
                        .font(.callout)
                        .foregroundStyle(.secondary)
                }
            }

            if self.isEnrolling {
                MicLevelBar(level: self.micLevel)
                    .frame(width: 220, height: 8)
            }

            if self.enrollmentSuccess {
                Text("Enrollment complete")
                    .font(.footnote)
                    .foregroundStyle(.green)
            }

            if let err = self.enrollmentError {
                Text(err)
                    .font(.footnote)
                    .foregroundStyle(.red)
            }
        }
    }

    private var clearRow: some View {
        Button("Clear enrollment") {
            Task {
                await SpeakerVerifier.shared.clearEnrollment()
                await self.syncFromVerifier()
                self.enrollmentSuccess = false
            }
        }
        .buttonStyle(.bordered)
        .foregroundStyle(.red)
    }

    private var thresholdRow: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 10) {
                Text("Sensitivity")
                    .frame(width: 100, alignment: .leading)

                Slider(value: self.$threshold, in: 0.2...0.95, step: 0.01)
                    .frame(width: 200)
                    .onChange(of: self.threshold) { _, newValue in
                        UserDefaults.standard.set(newValue, forKey: SpeakerVerifier.thresholdKey)
                    }

                Text(String(format: "%.0f%%", self.threshold * 100))
                    .font(.callout.monospacedDigit())
                    .foregroundStyle(.secondary)
                    .frame(width: 36, alignment: .trailing)
            }

            Text("Higher = stricter matching")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
    }

    @MainActor
    private func syncFromVerifier() {
        Task { @MainActor in
            self.isEnrolled = await SpeakerVerifier.shared.isEnrolled
            self.isEnabled = await SpeakerVerifier.shared.isEnabled
            self.threshold = Double(await SpeakerVerifier.shared.threshold)
        }
    }

    private func startEnrolling() {
        guard !self.isEnrolling else { return }
        self.isEnrolling = true
        self.enrollTimeRemaining = 10
        self.enrollmentError = nil
        self.enrollmentSuccess = false
        self.micLevel = 0

        Task { @MainActor in
            do {
                let (samples, sampleRate) = try await self.captureEnrollmentAudio()
                guard self.isEnrolling else { return }
                try await SpeakerVerifier.shared.enroll(samples: samples, sampleRate: Float(sampleRate))
                self.isEnrolled = await SpeakerVerifier.shared.isEnrolled
                self.enrollmentSuccess = true
            } catch {
                self.enrollmentError = error.localizedDescription
            }
            self.isEnrolling = false
            self.micLevel = 0
        }
    }

    private func stopEnrolling() {
        isEnrolling = false
        micLevel = 0
    }

    @MainActor
    private func captureEnrollmentAudio() async throws -> ([Float], Double) {
        // EnrollmentCapture is a plain class (not @MainActor-isolated).
        // AVAudioEngine + tap closure live entirely outside MainActor context,
        // so Swift 6 does NOT insert _swift_task_checkIsolatedSwift in the tap.
        let session = EnrollmentCapture()

        let countdownTask = Task { @MainActor in
            for remaining in stride(from: 9, through: 1, by: -1) {
                try? await Task.sleep(nanoseconds: 1_000_000_000)
                guard self.isEnrolling else { break }
                self.enrollTimeRemaining = remaining
            }
        }
        defer { countdownTask.cancel() }

        let levelTask = Task { @MainActor in
            while !Task.isCancelled {
                self.micLevel = session.latestLevel
                try? await Task.sleep(nanoseconds: 50_000_000)
            }
        }
        defer { levelTask.cancel() }

        return try await session.capture(durationSeconds: 10)
    }
}

// MARK: - EnrollmentCapture

/// Captures 10 s of enrollment audio off the main actor so that the AVAudioEngine
/// tap callback is never @MainActor-isolated (avoids _swift_task_checkIsolatedSwift crash).
private final class EnrollmentCapture: @unchecked Sendable {
    private let engine = AVAudioEngine()
    private let lock = NSLock()
    private var samples = [Float]()
    private var done = false

    /// Latest RMS level (0–1). Written from audio thread, read from MainActor poll — intentional race.
    private(set) var latestLevel: Double = 0

    func capture(durationSeconds: Int) async throws -> ([Float], Double) {
        let input = engine.inputNode
        let format = input.outputFormat(forBus: 0)
        guard format.channelCount > 0, format.sampleRate > 0 else {
            throw NSError(
                domain: "TalkModeSettings",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey: "No audio input available."])
        }
        let sampleRate = format.sampleRate
        let totalFrames = Int(sampleRate) * durationSeconds
        samples.reserveCapacity(totalFrames)

        return try await withCheckedThrowingContinuation { continuation in
            input.removeTap(onBus: 0)
            // self is EnrollmentCapture (plain class) — NOT @MainActor.
            // Swift 6 will NOT insert an actor-isolation check here.
            input.installTap(onBus: 0, bufferSize: 4096, format: format) { [weak self] buffer, _ in
                guard let self, let channel = buffer.floatChannelData?[0] else { return }
                let count = Int(buffer.frameLength)
                let frameCount = min(count, 512)
                var sumSq: Float = 0
                for i in 0..<frameCount { sumSq += channel[i] * channel[i] }
                let rms = sqrt(sumSq / Float(max(frameCount, 1)))

                self.lock.lock()
                defer { self.lock.unlock() }
                guard !self.done else { return }
                for i in 0..<count { self.samples.append(channel[i]) }
                self.latestLevel = min(1.0, Double(rms) * 20)
                if self.samples.count >= totalFrames {
                    self.done = true
                    input.removeTap(onBus: 0)
                    self.engine.stop()
                    continuation.resume(returning: (Array(self.samples.prefix(totalFrames)), sampleRate))
                }
            }

            engine.prepare()
            do {
                try engine.start()
            } catch {
                input.removeTap(onBus: 0)
                continuation.resume(throwing: error)
            }
        }
    }
}

#if DEBUG
struct TalkModeSettings_Previews: PreviewProvider {
    static var previews: some View {
        TalkModeSettings(isActive: true)
            .frame(width: SettingsTab.windowWidth, height: SettingsTab.windowHeight)
    }
}
#endif
