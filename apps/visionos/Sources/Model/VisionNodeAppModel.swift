import OpenClawKit
import Foundation
import Observation

@MainActor
@Observable
final class VisionNodeAppModel {
    private static let fallbackFailureThreshold = 3
    private static let fallbackLatencyThresholdSeconds = 2.8
    private static let recoverSuccessThreshold = 2

    var voiceState: VoiceInteractionState = .idle
    var fallbackPolicy: VoiceFallbackPolicy = .autoPTT
    var activeLanguage: VisionLanguage = .zhHans

    var statusPillText: String = "Idle"
    var statusDetailText: String = "Waiting for control panel activation"
    var isPushToTalkActive: Bool = false

    var isCanvasWindowOpen: Bool = false
    var isChatWindowOpen: Bool = false
    var isUsageWindowOpen: Bool = false

    var lastGestureIntent: GestureIntent?
    var lastVoiceCommandText: String = ""
    var lastSkillCommand: String?
    var lastTransitionReason: String = ""
    var transitionHistory: [VoiceInteractionState] = [.idle]

    private var consecutiveFailures = 0
    private var consecutiveHealthySignals = 0

    var talkPTTCommands: [String] {
        [
            OpenClawTalkCommand.pttStart.rawValue,
            OpenClawTalkCommand.pttStop.rawValue,
            OpenClawTalkCommand.pttCancel.rawValue,
            OpenClawTalkCommand.pttOnce.rawValue,
        ]
    }

    func activateControlPanel() {
        self.transition(to: .continuousListening, reason: "Control panel activated")
        self.statusPillText = "Listening"
        self.statusDetailText = "Continuous duplex voice is active"
    }

    func beginAssistantSpeech() {
        self.transition(to: .assistantSpeaking, reason: "Assistant is speaking")
        self.statusPillText = "Speaking"
        self.statusDetailText = "Assistant response in progress"
    }

    func onUserSpeechDetected() {
        switch self.voiceState {
        case .assistantSpeaking:
            self.transition(to: .bargeIn, reason: "User interrupted assistant output")
            self.statusPillText = "Barge-in"
            self.statusDetailText = "User took over the conversation"
            self.transition(to: .continuousListening, reason: "Barge-in complete")
            self.statusPillText = "Listening"
            self.statusDetailText = "Continuous duplex voice is active"
        case .continuousListening, .recovering:
            self.statusPillText = "Listening"
            self.statusDetailText = "Capturing user speech"
        default:
            break
        }
    }

    func registerRecognitionSignal(latencySeconds: Double, hasError: Bool, permissionAvailable: Bool) {
        if hasError || !permissionAvailable || latencySeconds > Self.fallbackLatencyThresholdSeconds {
            self.consecutiveFailures += 1
            self.consecutiveHealthySignals = 0

            let shouldFallback = self.fallbackPolicy == .autoPTT &&
                (self.consecutiveFailures >= Self.fallbackFailureThreshold ||
                    !permissionAvailable ||
                    latencySeconds > Self.fallbackLatencyThresholdSeconds)

            if shouldFallback {
                self.transition(to: .fallbackPTT, reason: "Voice quality degraded. Falling back to PTT")
                self.statusPillText = "PTT Fallback"
                self.statusDetailText = "Automatic fallback enabled for stability"
                self.isPushToTalkActive = false
            }
            return
        }

        self.consecutiveFailures = 0
        self.consecutiveHealthySignals += 1

        if self.voiceState == .fallbackPTT,
           self.consecutiveHealthySignals >= Self.recoverSuccessThreshold
        {
            self.transition(to: .recovering, reason: "Voice health restored")
            self.statusPillText = "Recovering"
            self.statusDetailText = "Checking duplex stability"
            self.transition(to: .continuousListening, reason: "Recovered from fallback")
            self.statusPillText = "Listening"
            self.statusDetailText = "Continuous duplex voice is active"
        }
    }

    func handleGestureIntent(_ intent: GestureIntent) {
        self.lastGestureIntent = intent

        switch intent {
        case let .pinchOnce(action):
            self.applySurfaceAction(action)
        case .pinchHoldStart:
            self.isPushToTalkActive = true
            self.statusPillText = "PTT"
            self.statusDetailText = "Hold to talk"
            self.transition(to: .fallbackPTT, reason: "Manual push-to-talk started")
        case .pinchHoldEnd:
            guard self.isPushToTalkActive else { return }
            self.isPushToTalkActive = false
            self.statusPillText = "PTT Sent"
            self.statusDetailText = "Voice segment submitted"
            self.transition(to: .recovering, reason: "PTT segment completed")
        case .pinchHoldCancel, .holdDownwardFlickCancel:
            self.isPushToTalkActive = false
            self.statusPillText = "PTT Cancelled"
            self.statusDetailText = "No transcript was sent"
            self.transition(to: .recovering, reason: "PTT segment cancelled")
        case .pinchDrag:
            self.statusPillText = "Moved"
            self.statusDetailText = "Control panel repositioned"
        case .twoHandResize:
            self.statusPillText = "Resized"
            self.statusDetailText = "Surface size updated"
        }
    }

    func handleVoiceCommand(_ transcript: String) {
        let normalized = transcript.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !normalized.isEmpty else { return }

        self.lastVoiceCommandText = normalized
        let lowercased = normalized.lowercased()

        if Self.containsAny(lowercased, in: ["open chat", "show chat"]) ||
            Self.containsAny(normalized, in: ["打开聊天", "打开对话", "チャットを開く"])
        {
            self.applySurfaceAction(.openChat)
            return
        }

        if Self.containsAny(lowercased, in: ["open canvas", "show canvas"]) ||
            Self.containsAny(normalized, in: ["打开画布", "打开工作台", "キャンバスを開く"])
        {
            self.applySurfaceAction(.openCanvas)
            return
        }

        if Self.containsAny(lowercased, in: ["show usage", "open usage"]) ||
            Self.containsAny(normalized, in: ["显示用量", "打开用量", "使用量を表示"])
        {
            self.applySurfaceAction(.openUsage)
            return
        }

        if Self.containsAny(lowercased, in: ["describe scene", "what is this"]) ||
            Self.containsAny(normalized, in: ["看一下这是什么", "描述场景", "何が見える"])
        {
            self.lastSkillCommand = "/vision_scene_describe"
            self.statusPillText = "Vision Skill"
            self.statusDetailText = "Queued /vision_scene_describe"
            return
        }

        if Self.containsAny(lowercased, in: ["translate this", "translate text"]) ||
            Self.containsAny(normalized, in: ["翻译这段", "帮我翻译", "翻訳して"])
        {
            self.lastSkillCommand = "/vision_translate"
            self.statusPillText = "Vision Skill"
            self.statusDetailText = "Queued /vision_translate"
            return
        }

        if Self.containsAny(lowercased, in: ["remember this", "save memory"]) ||
            Self.containsAny(normalized, in: ["记住这个", "写入记忆", "これを覚えて"])
        {
            self.lastSkillCommand = "/vision_record_memory"
            self.statusPillText = "Memory"
            self.statusDetailText = "Queued /vision_record_memory"
            return
        }

        if Self.containsAny(lowercased, in: ["switch language", "change language"]) ||
            Self.containsAny(normalized, in: ["切换语言", "语言切换", "言語を切り替え"])
        {
            self.applySurfaceAction(.toggleTranslateMode)
            return
        }

        self.statusPillText = "Command"
        self.statusDetailText = "No matching shortcut. Sent as regular chat text"
    }

    func markRecoveryReady() {
        self.consecutiveFailures = 0
        self.consecutiveHealthySignals = Self.recoverSuccessThreshold
        self.registerRecognitionSignal(latencySeconds: 0.3, hasError: false, permissionAvailable: true)
    }

    private func applySurfaceAction(_ action: GestureSurfaceAction) {
        switch action {
        case .openChat:
            self.isChatWindowOpen = true
            self.statusPillText = "Chat"
            self.statusDetailText = "Chat surface opened"
        case .openCanvas:
            self.isCanvasWindowOpen = true
            self.statusPillText = "Canvas"
            self.statusDetailText = "Canvas surface opened"
        case .openUsage:
            self.isUsageWindowOpen = true
            self.statusPillText = "Usage"
            self.statusDetailText = "Usage surface opened"
        case .toggleTranslateMode:
            self.activeLanguage = self.activeLanguage.next
            self.statusPillText = "Language"
            self.statusDetailText = "Active language: \(self.activeLanguage.rawValue)"
        }
    }

    private func transition(to state: VoiceInteractionState, reason: String) {
        self.voiceState = state
        self.lastTransitionReason = reason
        self.transitionHistory.append(state)
        if self.transitionHistory.count > 24 {
            self.transitionHistory.removeFirst(self.transitionHistory.count - 24)
        }
    }

    private static func containsAny(_ haystack: String, in needles: [String]) -> Bool {
        needles.contains { haystack.localizedCaseInsensitiveContains($0) }
    }
}

enum VoiceInteractionState: String, CaseIterable, Sendable {
    case idle
    case continuousListening = "continuous_listening"
    case assistantSpeaking = "assistant_speaking"
    case bargeIn = "barge_in"
    case fallbackPTT = "fallback_ptt"
    case recovering
}

enum GestureIntent: Equatable, Sendable {
    case pinchOnce(GestureSurfaceAction)
    case pinchHoldStart
    case pinchHoldEnd
    case pinchHoldCancel
    case pinchDrag
    case twoHandResize
    case holdDownwardFlickCancel
}

enum VoiceFallbackPolicy: String, CaseIterable, Sendable {
    case autoPTT = "autoPTT"
}

enum GestureSurfaceAction: String, CaseIterable, Sendable {
    case openChat
    case openCanvas
    case openUsage
    case toggleTranslateMode
}

enum VisionLanguage: String, CaseIterable, Sendable, Identifiable {
    case zhHans = "zh-Hans"
    case en
    case ja

    var id: String { self.rawValue }

    var displayName: String {
        switch self {
        case .zhHans: "中文"
        case .en: "English"
        case .ja: "日本語"
        }
    }

    var next: VisionLanguage {
        switch self {
        case .zhHans: .en
        case .en: .ja
        case .ja: .zhHans
        }
    }
}

enum VisionWindowID {
    static let controlPanel = "control-panel"
    static let canvas = "canvas"
    static let chat = "chat"
    static let usage = "usage"
}
