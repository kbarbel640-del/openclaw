import AVFoundation
import SwiftUI

/// Settings view for configuring Text-to-Speech voice parameters.
struct TTSVoiceSettingsView: View {
    @AppStorage("tts.voiceIdentifier") private var selectedVoiceId = ""
    @AppStorage("tts.rate") private var speechRate = 0.5
    @AppStorage("tts.pitch") private var speechPitch = 1.0
    @State private var availableVoices: [AVSpeechSynthesisVoice] = []
    @State private var isTestPlaying = false
    private let synthesizer = AVSpeechSynthesizer()

    var body: some View {
        Form {
            Section {
                Picker("Voice", selection: self.$selectedVoiceId) {
                    Text("System Default").tag("")
                    ForEach(self.availableVoices, id: \.identifier) { voice in
                        Text(self.voiceDisplayName(voice))
                            .tag(voice.identifier)
                    }
                }

                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("Speech Rate")
                        Spacer()
                        Text(self.rateLabel)
                            .foregroundStyle(.secondary)
                    }
                    Slider(value: self.$speechRate, in: 0.0 ... 1.0, step: 0.1)
                }

                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("Pitch")
                        Spacer()
                        Text(String(format: "%.1f", self.speechPitch))
                            .foregroundStyle(.secondary)
                    }
                    Slider(value: self.$speechPitch, in: 0.5 ... 2.0, step: 0.1)
                }

                Button {
                    self.testVoice()
                } label: {
                    HStack {
                        if self.isTestPlaying {
                            ProgressView()
                                .progressViewStyle(.circular)
                                .scaleEffect(0.8)
                        }
                        Text(self.isTestPlaying ? "Playing..." : "Test Voice")
                    }
                }
                .disabled(self.isTestPlaying)
            } header: {
                Text("Text-to-Speech")
            } footer: {
                Text("These settings apply to system TTS fallback when cloud voices are unavailable.")
            }

            Section {
                Button("Reset to Defaults") {
                    self.resetDefaults()
                }
            }
        }
        .navigationTitle("TTS Voice")
        .onAppear {
            self.loadVoices()
        }
    }

    private var rateLabel: String {
        switch self.speechRate {
        case 0.0 ..< 0.3:
            "Slow"
        case 0.3 ..< 0.6:
            "Normal"
        case 0.6 ..< 0.8:
            "Fast"
        default:
            "Very Fast"
        }
    }

    private func voiceDisplayName(_ voice: AVSpeechSynthesisVoice) -> String {
        let language = Locale.current.localizedString(forIdentifier: voice.language) ?? voice.language
        return "\(voice.name) (\(language))"
    }

    private func loadVoices() {
        let voices = AVSpeechSynthesisVoice.speechVoices()
        // Filter to show only enhanced/premium voices and common languages
        let filtered = voices.filter { voice in
            voice.quality == .enhanced || voice.quality == .premium
        }
        // Sort by language then name
        self.availableVoices = filtered.sorted { a, b in
            if a.language != b.language {
                return a.language < b.language
            }
            return a.name < b.name
        }
    }

    private func testVoice() {
        self.isTestPlaying = true
        let utterance = AVSpeechUtterance(string: "Hello, I'm Moltbot. How can I help you today?")

        // Apply selected voice
        if !self.selectedVoiceId.isEmpty,
           let voice = AVSpeechSynthesisVoice(identifier: self.selectedVoiceId)
        {
            utterance.voice = voice
        }

        // Apply rate (AVSpeechUtterance rate is 0.0-1.0 but default speaking rate is around 0.5)
        utterance.rate = Float(self.speechRate) * AVSpeechUtteranceMaximumSpeechRate
        utterance.pitchMultiplier = Float(self.speechPitch)

        self.synthesizer.speak(utterance)

        // Reset playing state when done
        Task {
            // Simple delay approximation since we can't easily track utterance completion here
            try? await Task.sleep(nanoseconds: 3_000_000_000)
            await MainActor.run {
                self.isTestPlaying = false
            }
        }
    }

    private func resetDefaults() {
        self.selectedVoiceId = ""
        self.speechRate = 0.5
        self.speechPitch = 1.0
    }
}
