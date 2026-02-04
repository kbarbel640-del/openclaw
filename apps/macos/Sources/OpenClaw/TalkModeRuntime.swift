import AVFoundation
import OpenClawChatUI
import OpenClawKit
import Foundation
import OSLog
import Speech

actor TalkModeRuntime {
    static let shared = TalkModeRuntime()

    private let logger = Logger(subsystem: "ai.openclaw", category: "talk.runtime")
    private let ttsLogger = Logger(subsystem: "ai.openclaw", category: "talk.tts")
    private static let defaultModelIdFallback = "eleven_v3"

    private final class RMSMeter: @unchecked Sendable {
        private let lock = NSLock()
        private var latestRMS: Double = 0

        func set(_ rms: Double) {
            self.lock.lock()
            self.latestRMS = rms
            self.lock.unlock()
        }

        func get() -> Double {
            self.lock.lock()
            let value = self.latestRMS
            self.lock.unlock()
            return value
        }
    }

    private var recognizer: SFSpeechRecognizer?
    private var audioEngine: AVAudioEngine?
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private var recognitionGeneration: Int = 0
    private var rmsTask: Task<Void, Never>?
    private let rmsMeter = RMSMeter()

    private var captureTask: Task<Void, Never>?
    private var silenceTask: Task<Void, Never>?
    private var phase: TalkModePhase = .idle
    private var isEnabled = false
    private var isPaused = false
    private var lifecycleGeneration: Int = 0

    private var lastHeard: Date?
    private var noiseFloorRMS: Double = 1e-4
    private var lastTranscript: String = ""
    private var lastSpeechEnergyAt: Date?

    private var defaultVoiceId: String?
    private var currentVoiceId: String?
    private var defaultModelId: String?
    private var currentModelId: String?
    private var voiceOverrideActive = false
    private var modelOverrideActive = false
    private var defaultOutputFormat: String?
    private var interruptOnSpeech: Bool = true
    private var lastInterruptedAtSeconds: Double?
    private var voiceAliases: [String: String] = [:]
    private var lastSpokenText: String?
    private var apiKey: String?
    private var fallbackVoiceId: String?
    private var lastPlaybackWasPCM: Bool = false
    
    // MiniMax TTS client for cloud TTS
    private var miniMaxClient: MiniMaxTTSClient?
    private var useMiniMax: Bool = true  // 默认启用 MiniMax TTS
    private var miniMaxApiKey: String?
    private var miniMaxVoiceId: String = "male-qn-qingse"
    private var miniMaxModel: String = "speech-2.6-hd"

    private let silenceWindow: TimeInterval = 0.7
    private let minSpeechRMS: Double = 1e-3
    private let speechBoostFactor: Double = 6.0

    // MARK: - Lifecycle

    func setEnabled(_ enabled: Bool) async {
        guard enabled != self.isEnabled else { return }
        self.isEnabled = enabled
        self.lifecycleGeneration &+= 1
        if enabled {
            await self.start()
        } else {
            await self.stop()
        }
    }

    func setPaused(_ paused: Bool) async {
        guard paused != self.isPaused else { return }
        self.isPaused = paused
        await MainActor.run { TalkModeController.shared.updateLevel(0) }

        guard self.isEnabled else { return }

        if paused {
            self.lastTranscript = ""
            self.lastHeard = nil
            self.lastSpeechEnergyAt = nil
            await self.stopRecognition()
            return
        }

        if self.phase == .idle || self.phase == .listening {
            await self.startRecognition()
            self.phase = .listening
            await MainActor.run { TalkModeController.shared.updatePhase(.listening) }
            self.startSilenceMonitor()
        }
    }

    private func isCurrent(_ generation: Int) -> Bool {
        generation == self.lifecycleGeneration && self.isEnabled
    }

    private func start() async {
        let gen = self.lifecycleGeneration
        guard voiceWakeSupported else { return }
        guard PermissionManager.voiceWakePermissionsGranted() else {
            self.logger.debug("talk runtime not starting: permissions missing")
            return
        }
        await self.reloadConfig()
        guard self.isCurrent(gen) else { return }
        if self.isPaused {
            self.phase = .idle
            await MainActor.run {
                TalkModeController.shared.updateLevel(0)
                TalkModeController.shared.updatePhase(.idle)
            }
            return
        }
        await self.startRecognition()
        guard self.isCurrent(gen) else { return }
        self.phase = .listening
        await MainActor.run { TalkModeController.shared.updatePhase(.listening) }
        self.startSilenceMonitor()
    }

    private func stop() async {
        self.captureTask?.cancel()
        self.captureTask = nil
        self.silenceTask?.cancel()
        self.silenceTask = nil

        // Stop audio before changing phase (stopSpeaking is gated on .speaking).
        await self.stopSpeaking(reason: .manual)

        self.lastTranscript = ""
        self.lastHeard = nil
        self.lastSpeechEnergyAt = nil
        self.phase = .idle
        await self.stopRecognition()
        await MainActor.run {
            TalkModeController.shared.updateLevel(0)
            TalkModeController.shared.updatePhase(.idle)
        }
    }

    // MARK: - Speech recognition

    private struct RecognitionUpdate {
        let transcript: String?
        let hasConfidence: Bool
        let isFinal: Bool
        let errorDescription: String?
        let generation: Int
    }

    private func startRecognition() async {
        await self.stopRecognition()
        self.recognitionGeneration &+= 1
        let generation = self.recognitionGeneration

        let locale = await MainActor.run { AppStateStore.shared.voiceWakeLocaleID }
        self.recognizer = SFSpeechRecognizer(locale: Locale(identifier: locale))
        guard let recognizer, recognizer.isAvailable else {
            self.logger.error("talk recognizer unavailable")
            return
        }

        self.recognitionRequest = SFSpeechAudioBufferRecognitionRequest()
        self.recognitionRequest?.shouldReportPartialResults = true
        guard let request = self.recognitionRequest else { return }

        if self.audioEngine == nil {
            self.audioEngine = AVAudioEngine()
        }
        guard let audioEngine = self.audioEngine else { return }

        let input = audioEngine.inputNode
        let format = input.outputFormat(forBus: 0)
        input.removeTap(onBus: 0)
        let meter = self.rmsMeter
        input.installTap(onBus: 0, bufferSize: 2048, format: format) { [weak request, meter] buffer, _ in
            request?.append(buffer)
            if let rms = Self.rmsLevel(buffer: buffer) {
                meter.set(rms)
            }
        }

        audioEngine.prepare()
        do {
            try audioEngine.start()
        } catch {
            self.logger.error("talk audio engine start failed: \(error.localizedDescription, privacy: .public)")
            return
        }

        self.startRMSTicker(meter: meter)

        self.recognitionTask = recognizer.recognitionTask(with: request) { [weak self, generation] result, error in
            guard let self else { return }
            let segments = result?.bestTranscription.segments ?? []
            let transcript = result?.bestTranscription.formattedString
            // 降低置信度阈值（0.6 -> 0.3），因为 TTS 播放时背景噪音会降低识别置信度
            let update = RecognitionUpdate(
                transcript: transcript,
                hasConfidence: segments.contains { $0.confidence > 0.3 },
                isFinal: result?.isFinal ?? false,
                errorDescription: error?.localizedDescription,
                generation: generation)
            Task { await self.handleRecognition(update) }
        }
    }

    private func stopRecognition() async {
        self.recognitionGeneration &+= 1
        self.recognitionTask?.cancel()
        self.recognitionTask = nil
        self.recognitionRequest?.endAudio()
        self.recognitionRequest = nil
        self.audioEngine?.inputNode.removeTap(onBus: 0)
        self.audioEngine?.stop()
        self.audioEngine = nil
        self.recognizer = nil
        self.rmsTask?.cancel()
        self.rmsTask = nil
    }

    private func startRMSTicker(meter: RMSMeter) {
        self.rmsTask?.cancel()
        self.rmsTask = Task { [weak self, meter] in
            while let self {
                try? await Task.sleep(nanoseconds: 50_000_000)
                if Task.isCancelled { return }
                await self.noteAudioLevel(rms: meter.get())
            }
        }
    }

    private func handleRecognition(_ update: RecognitionUpdate) async {
        guard update.generation == self.recognitionGeneration else { return }
        guard !self.isPaused else { return }
        if let errorDescription = update.errorDescription {
            self.logger.debug("talk recognition error: \(errorDescription, privacy: .public)")
        }
        guard let transcript = update.transcript else { return }

        let trimmed = transcript.trimmingCharacters(in: .whitespacesAndNewlines)
        if self.phase == .speaking, self.interruptOnSpeech {
            self.logger.warning("🔊 收到转录(speaking): '\(trimmed.prefix(30), privacy: .public)' phase=\(String(describing: self.phase), privacy: .public)")
            if await self.shouldInterrupt(transcript: trimmed, hasConfidence: update.hasConfidence) {
                self.logger.warning("🔊 执行打断!")
                await self.stopSpeaking(reason: .speech)
                self.lastTranscript = ""
                self.lastHeard = nil
                await self.startListening()
            }
            return
        } else if self.phase == .speaking {
            self.logger.warning("🔊 收到转录但interruptOnSpeech=false")
        }

        guard self.phase == .listening else { return }

        if !trimmed.isEmpty {
            self.lastTranscript = trimmed
            self.lastHeard = Date()
        }

        if update.isFinal {
            self.lastTranscript = trimmed
        }
    }

    // MARK: - Silence handling

    private func startSilenceMonitor() {
        self.silenceTask?.cancel()
        self.silenceTask = Task { [weak self] in
            await self?.silenceLoop()
        }
    }

    private func silenceLoop() async {
        while self.isEnabled {
            try? await Task.sleep(nanoseconds: 200_000_000)
            await self.checkSilence()
        }
    }

    private func checkSilence() async {
        guard !self.isPaused else { return }
        guard self.phase == .listening else { return }
        let transcript = self.lastTranscript.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !transcript.isEmpty else { return }
        guard let lastHeard else { return }
        let elapsed = Date().timeIntervalSince(lastHeard)
        guard elapsed >= self.silenceWindow else { return }
        await self.finalizeTranscript(transcript)
    }

    private func startListening() async {
        self.phase = .listening
        self.lastTranscript = ""
        self.lastHeard = nil
        await MainActor.run {
            TalkModeController.shared.updatePhase(.listening)
            TalkModeController.shared.updateLevel(0)
        }
    }

    private func finalizeTranscript(_ text: String) async {
        self.lastTranscript = ""
        self.lastHeard = nil
        self.phase = .thinking
        await MainActor.run { TalkModeController.shared.updatePhase(.thinking) }
        await self.stopRecognition()
        await self.sendAndSpeak(text)
    }

    // MARK: - Gateway + TTS

    private func sendAndSpeak(_ transcript: String) async {
        let gen = self.lifecycleGeneration
        await self.reloadConfig()
        guard self.isCurrent(gen) else { return }
        
        let useMiniMaxTTS = self.useMiniMax && (self.miniMaxApiKey?.isEmpty == false)
        if useMiniMaxTTS {
            // 等待 final 后分段播放（稳定方案，不依赖 delta 事件）
            await self.sendAndSpeakWithSegments(transcript: transcript, generation: gen)
        } else {
            await self.sendAndSpeakNonStreaming(transcript: transcript, generation: gen)
        }
    }
    
    /// 等待完整回复后分段播放（避免 Gateway dropIfSlow 丢弃 delta）
    /// 使用单一 WebSocket 连接复用
    private func sendAndSpeakWithSegments(transcript: String, generation gen: Int) async {
        // ========== 延迟诊断：T0 - STT完成，进入方法 ==========
        let t0 = Date()
        self.logger.warning("⏱️ T0 STT完成，进入分段TTS")
        
        let prompt = self.buildPrompt(transcript: transcript)
        let activeSessionKey = await MainActor.run { WebChatManager.shared.activeSessionKey }
        let sessionKey: String
        if let key = activeSessionKey {
            sessionKey = key
        } else {
            sessionKey = await GatewayConnection.shared.mainSessionKey()
        }
        let runId = UUID().uuidString
        
        // 检查 MiniMax API key
        guard let apiKey = self.miniMaxApiKey, !apiKey.isEmpty else {
            self.ttsLogger.error("MiniMax API key not configured")
            return
        }
        
        self.logger.warning("⏱️ T1 准备发送请求 +\(Int(Date().timeIntervalSince(t0) * 1000), privacy: .public)ms")
        
        do {
            // 先订阅
            let gatewayStream = await GatewayConnection.shared.subscribe()
            
            // 发送请求
            let response = try await GatewayConnection.shared.chatSend(
                sessionKey: sessionKey,
                message: prompt,
                thinking: "low",
                idempotencyKey: runId,
                attachments: [])
            
            self.logger.warning("⏱️ T2 chatSend完成 +\(Int(Date().timeIntervalSince(t0) * 1000), privacy: .public)ms")
            
            guard self.isCurrent(gen) else { return }
            
            let expectedRunId = response.runId
            let deadline = Date().addingTimeInterval(60)
            
            // 等待 final 事件，然后从 history 获取完整文本（final message 可能为空）
            for await push in gatewayStream {
                guard Date() < deadline else { break }
                guard self.isCurrent(gen) else { break }
                guard case let .event(evt) = push, evt.event == "chat" else { continue }
                
                guard let payload = evt.payload,
                      let payloadData = try? JSONEncoder().encode(payload),
                      let chatPayload = try? JSONDecoder().decode(OpenClawChatEventPayload.self, from: payloadData),
                      chatPayload.runId == expectedRunId
                else { continue }
                
                let state = chatPayload.state ?? ""
                
                if state == "final" || state == "done" || state == "error" || state == "aborted" {
                    break
                }
            }
            
            self.logger.warning("⏱️ T3 收到final +\(Int(Date().timeIntervalSince(t0) * 1000), privacy: .public)ms")
            
            guard self.isCurrent(gen) else { return }
            
            // 直接从 history 获取完整文本（更可靠）
            let startedAt = Date().timeIntervalSince1970 - 60
            guard let fullText = await self.latestAssistantText(sessionKey: sessionKey, since: startedAt),
                  !fullText.isEmpty else {
                self.logger.warning("No text from history")
                return
            }
            
            self.logger.warning("⏱️ T3b 获取history +\(Int(Date().timeIntervalSince(t0) * 1000), privacy: .public)ms 长度=\(fullText.count, privacy: .public)")
            
            guard !fullText.isEmpty else { return }
            
            // 不分段，直接播放整个文本（避免 MiniMax 连接复用问题导致的停顿）
            self.logger.warning("⏱️ T4 开始TTS播放 +\(Int(Date().timeIntervalSince(t0) * 1000), privacy: .public)ms 字数=\(fullText.count, privacy: .public)")
            
            do {
                try await self.playSegmentIndependent(text: fullText, generation: gen, isFirst: true)
                self.logger.warning("⏱️ TTS播放完成")
            } catch {
                self.ttsLogger.error("TTS failed: \(error.localizedDescription, privacy: .public)")
            }
            
            self.logger.warning("⏱️ 总耗时 \(Int(Date().timeIntervalSince(t0) * 1000), privacy: .public)ms")
            
        } catch {
            self.logger.error("sendAndSpeakWithSegments failed: \(error.localizedDescription, privacy: .public)")
        }
        
        guard self.isCurrent(gen) else { return }
        await self.resumeListeningIfNeeded()
    }
    
    /// 每个段落使用独立的 MiniMax 连接播放（因为 MiniMax API 不支持单连接多任务）
    private func playSegmentIndependent(text: String, generation: Int, isFirst: Bool) async throws {
        guard self.isCurrent(generation) else {
            self.logger.warning("⏱️ playSegmentIndependent: generation不匹配，跳过")
            return
        }
        
        guard let apiKey = self.miniMaxApiKey, !apiKey.isEmpty else {
            self.ttsLogger.error("MiniMax API key not configured")
            return
        }
        
        // 只在第一个段落时设置 phase
        if isFirst {
            if self.interruptOnSpeech {
                guard await self.prepareForPlayback(generation: generation) else {
                    self.logger.warning("⏱️ playSegmentIndependent: prepareForPlayback失败")
                    return
                }
            }
            await MainActor.run { TalkModeController.shared.updatePhase(.speaking) }
            self.phase = .speaking
            self.lastPlaybackWasPCM = false
        }
        
        // 创建独立的 client
        let client = MiniMaxTTSClient(
            apiKey: apiKey,
            model: self.miniMaxModel,
            voiceId: self.miniMaxVoiceId
        )
        
        do {
            try await client.connect()
            self.logger.warning("⏱️ 段落独立连接成功")
        } catch {
            self.ttsLogger.error("MiniMax connect failed: \(error.localizedDescription, privacy: .public)")
            throw error
        }
        
        defer {
            Task { await client.disconnect() }
        }
        
        // 合成音频
        let stream = await client.streamSynthesize(text: text, speed: 1.0, volume: 1.0, pitch: 0)
        
        // 计算收到的音频数据量
        var chunkCount = 0
        var totalBytes = 0
        let monitoredStream = AsyncThrowingStream<Data, Error> { continuation in
            Task {
                do {
                    for try await chunk in stream {
                        chunkCount += 1
                        totalBytes += chunk.count
                        continuation.yield(chunk)
                    }
                    self.logger.warning("⏱️ 段落TTS流完成: \(chunkCount, privacy: .public)块 \(totalBytes, privacy: .public)字节")
                    continuation.finish()
                } catch {
                    self.logger.error("⏱️ 段落TTS流错误: \(error.localizedDescription, privacy: .public)")
                    continuation.finish(throwing: error)
                }
            }
        }
        
        let result = await self.playMP3(stream: monitoredStream)
        self.logger.warning("⏱️ 段落playMP3结果: finished=\(result.finished, privacy: .public)")
        
        if !result.finished, let interruptedAt = result.interruptedAt, self.phase == .speaking {
            if self.interruptOnSpeech {
                self.lastInterruptedAtSeconds = interruptedAt
            }
        }
    }
    
    /// Non-streaming TTS: Wait for full response then play
    private func sendAndSpeakNonStreaming(transcript: String, generation gen: Int) async {
        let prompt = self.buildPrompt(transcript: transcript)
        let activeSessionKey = await MainActor.run { WebChatManager.shared.activeSessionKey }
        let sessionKey: String = if let activeSessionKey {
            activeSessionKey
        } else {
            await GatewayConnection.shared.mainSessionKey()
        }
        let runId = UUID().uuidString
        let startedAt = Date().timeIntervalSince1970
        self.logger.info(
            "talk send start runId=\(runId, privacy: .public) " +
                "session=\(sessionKey, privacy: .public) " +
                "chars=\(prompt.count, privacy: .public)")

        do {
            let response = try await GatewayConnection.shared.chatSend(
                sessionKey: sessionKey,
                message: prompt,
                thinking: "low",
                idempotencyKey: runId,
                attachments: [])
            guard self.isCurrent(gen) else { return }
            self.logger.info(
                "talk chat.send ok runId=\(response.runId, privacy: .public) " +
                    "session=\(sessionKey, privacy: .public)")

            guard let assistantText = await self.waitForAssistantText(
                sessionKey: sessionKey,
                since: startedAt,
                timeoutSeconds: 45)
            else {
                self.logger.warning("talk assistant text missing after timeout")
                await self.startListening()
                await self.startRecognition()
                return
            }
            guard self.isCurrent(gen) else { return }

            self.logger.info("talk assistant text len=\(assistantText.count, privacy: .public)")
            await self.playAssistant(text: assistantText)
            guard self.isCurrent(gen) else { return }
            await self.resumeListeningIfNeeded()
            return
        } catch {
            self.logger.error("talk chat.send failed: \(error.localizedDescription, privacy: .public)")
            await self.resumeListeningIfNeeded()
            return
        }
    }
    
    /// Helper struct to decode chat delta message
    private struct ChatDeltaMessage: Codable {
        let content: [ChatDeltaContent]?
    }
    
    private struct ChatDeltaContent: Codable {
        let text: String?
    }

    private func resumeListeningIfNeeded() async {
        if self.isPaused {
            self.lastTranscript = ""
            self.lastHeard = nil
            self.lastSpeechEnergyAt = nil
            await MainActor.run {
                TalkModeController.shared.updateLevel(0)
            }
            return
        }
        await self.startListening()
        await self.startRecognition()
    }

    private func buildPrompt(transcript: String) -> String {
        let interrupted = self.lastInterruptedAtSeconds
        self.lastInterruptedAtSeconds = nil
        return TalkPromptBuilder.build(transcript: transcript, interruptedAtSeconds: interrupted)
    }

    private func waitForAssistantText(
        sessionKey: String,
        since: Double,
        timeoutSeconds: Int) async -> String?
    {
        let deadline = Date().addingTimeInterval(TimeInterval(timeoutSeconds))
        while Date() < deadline {
            if let text = await self.latestAssistantText(sessionKey: sessionKey, since: since) {
                return text
            }
            try? await Task.sleep(nanoseconds: 300_000_000)
        }
        return nil
    }

    private func latestAssistantText(sessionKey: String, since: Double? = nil) async -> String? {
        do {
            let history = try await GatewayConnection.shared.chatHistory(sessionKey: sessionKey)
            let messages = history.messages ?? []
            let decoded: [OpenClawChatMessage] = messages.compactMap { item in
                guard let data = try? JSONEncoder().encode(item) else { return nil }
                return try? JSONDecoder().decode(OpenClawChatMessage.self, from: data)
            }
            let assistant = decoded.last { message in
                guard message.role == "assistant" else { return false }
                guard let since else { return true }
                guard let timestamp = message.timestamp else { return false }
                return TalkHistoryTimestamp.isAfter(timestamp, sinceSeconds: since)
            }
            guard let assistant else { return nil }
            let text = assistant.content.compactMap(\.text).joined(separator: "\n")
            // 过滤掉 [[tts:...]] 和 [[audio:...]] 等特殊标记，避免 TTS 朗读路径
            let filtered = self.filterSpecialMarkers(text)
            let trimmed = filtered.trimmingCharacters(in: CharacterSet.whitespacesAndNewlines)
            return trimmed.isEmpty ? nil : trimmed
        } catch {
            self.logger.error("talk history fetch failed: \(error.localizedDescription, privacy: .public)")
            return nil
        }
    }
    
    /// 过滤掉 [[tts:...]] [[audio:...]] 等特殊标记
    private func filterSpecialMarkers(_ text: String) -> String {
        // 匹配 [[tts:...]] [[audio:...]] [[voice:...]] 等标记（包括空值如 [[tts:once]]）
        // 使用 .*? 非贪婪匹配，支持嵌套括号
        let pattern = #"\[\[(tts|audio|voice)(:[^\]]*?)?\]\]"#
        guard let regex = try? NSRegularExpression(pattern: pattern, options: []) else {
            return text
        }
        let range = NSRange(text.startIndex..., in: text)
        return regex.stringByReplacingMatches(in: text, options: [], range: range, withTemplate: "")
    }

    private func playAssistant(text: String) async {
        guard let input = await self.preparePlaybackInput(text: text) else { return }
        
        // Use MiniMax TTS if enabled and API key is available
        let useMiniMaxTTS = self.useMiniMax && (self.miniMaxApiKey?.isEmpty == false)
        self.ttsLogger.info("playAssistant: useMiniMax=\(useMiniMaxTTS), hasApiKey=\(self.miniMaxApiKey?.isEmpty == false)")
        
        // MiniMax TTS: single attempt only (no retry) to avoid repeating the same sentence
        // Retry was causing duplicate playback when stream ended with !finished and we threw
        if useMiniMaxTTS {
            do {
                self.ttsLogger.info("MiniMax TTS start")
                try await self.playMiniMax(input: input)
                return  // Success, exit
            } catch {
                self.ttsLogger.error("MiniMax TTS failed: \(error.localizedDescription, privacy: .public); falling back")
            }
        }
        
        // Fallback to ElevenLabs or system voice
        do {
            if let apiKey = input.apiKey, !apiKey.isEmpty, let voiceId = input.voiceId {
                try await self.playElevenLabs(input: input, apiKey: apiKey, voiceId: voiceId)
            } else {
                try await self.playSystemVoice(input: input)
            }
        } catch {
            self.ttsLogger
                .error(
                    "talk TTS failed: \(error.localizedDescription, privacy: .public); " +
                        "falling back to system voice")
            do {
                try await self.playSystemVoice(input: input)
            } catch {
                self.ttsLogger.error("talk system voice failed: \(error.localizedDescription, privacy: .public)")
            }
        }

        if self.phase == .speaking {
            self.phase = .thinking
            await MainActor.run { TalkModeController.shared.updatePhase(.thinking) }
        }
    }

    private struct TalkPlaybackInput {
        let generation: Int
        let cleanedText: String
        let directive: TalkDirective?
        let apiKey: String?
        let voiceId: String?
        let language: String?
        let synthTimeoutSeconds: Double
    }

    private func preparePlaybackInput(text: String) async -> TalkPlaybackInput? {
        let gen = self.lifecycleGeneration
        let parse = TalkDirectiveParser.parse(text)
        let directive = parse.directive
        let cleaned = parse.stripped.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleaned.isEmpty else { return nil }
        guard self.isCurrent(gen) else { return nil }

        if !parse.unknownKeys.isEmpty {
            self.logger
                .warning(
                    "talk directive ignored keys: " +
                        "\(parse.unknownKeys.joined(separator: ","), privacy: .public)")
        }

        let requestedVoice = directive?.voiceId?.trimmingCharacters(in: .whitespacesAndNewlines)
        let resolvedVoice = self.resolveVoiceAlias(requestedVoice)
        if let requestedVoice, !requestedVoice.isEmpty, resolvedVoice == nil {
            self.logger.warning("talk unknown voice alias \(requestedVoice, privacy: .public)")
        }
        if let voice = resolvedVoice {
            if directive?.once == true {
                self.logger.info("talk voice override (once) voiceId=\(voice, privacy: .public)")
            } else {
                self.currentVoiceId = voice
                self.voiceOverrideActive = true
                self.logger.info("talk voice override voiceId=\(voice, privacy: .public)")
            }
        }

        if let model = directive?.modelId {
            if directive?.once == true {
                self.logger.info("talk model override (once) modelId=\(model, privacy: .public)")
            } else {
                self.currentModelId = model
                self.modelOverrideActive = true
            }
        }

        let apiKey = self.apiKey?.trimmingCharacters(in: .whitespacesAndNewlines)
        let preferredVoice =
            resolvedVoice ??
            self.currentVoiceId ??
            self.defaultVoiceId

        let language = ElevenLabsTTSClient.validatedLanguage(directive?.language)

        let voiceId: String? = if let apiKey, !apiKey.isEmpty {
            await self.resolveVoiceId(preferred: preferredVoice, apiKey: apiKey)
        } else {
            nil
        }

        if apiKey?.isEmpty != false {
            self.ttsLogger.warning("talk missing ELEVENLABS_API_KEY; falling back to system voice")
        } else if voiceId == nil {
            self.ttsLogger.warning("talk missing voiceId; falling back to system voice")
        } else if let voiceId {
            self.ttsLogger
                .info(
                    "talk TTS request voiceId=\(voiceId, privacy: .public) " +
                        "chars=\(cleaned.count, privacy: .public)")
        }
        self.lastSpokenText = cleaned

        let synthTimeoutSeconds = max(20.0, min(90.0, Double(cleaned.count) * 0.12))

        guard self.isCurrent(gen) else { return nil }

        return TalkPlaybackInput(
            generation: gen,
            cleanedText: cleaned,
            directive: directive,
            apiKey: apiKey,
            voiceId: voiceId,
            language: language,
            synthTimeoutSeconds: synthTimeoutSeconds)
    }

    private func playElevenLabs(input: TalkPlaybackInput, apiKey: String, voiceId: String) async throws {
        let desiredOutputFormat = input.directive?.outputFormat ?? self.defaultOutputFormat ?? "pcm_44100"
        let outputFormat = ElevenLabsTTSClient.validatedOutputFormat(desiredOutputFormat)
        if outputFormat == nil, !desiredOutputFormat.isEmpty {
            self.logger
                .warning(
                    "talk output_format unsupported for local playback: " +
                        "\(desiredOutputFormat, privacy: .public)")
        }

        let modelId = input.directive?.modelId ?? self.currentModelId ?? self.defaultModelId
        func makeRequest(outputFormat: String?) -> ElevenLabsTTSRequest {
            ElevenLabsTTSRequest(
                text: input.cleanedText,
                modelId: modelId,
                outputFormat: outputFormat,
                speed: TalkTTSValidation.resolveSpeed(
                    speed: input.directive?.speed,
                    rateWPM: input.directive?.rateWPM),
                stability: TalkTTSValidation.validatedStability(
                    input.directive?.stability,
                    modelId: modelId),
                similarity: TalkTTSValidation.validatedUnit(input.directive?.similarity),
                style: TalkTTSValidation.validatedUnit(input.directive?.style),
                speakerBoost: input.directive?.speakerBoost,
                seed: TalkTTSValidation.validatedSeed(input.directive?.seed),
                normalize: ElevenLabsTTSClient.validatedNormalize(input.directive?.normalize),
                language: input.language,
                latencyTier: TalkTTSValidation.validatedLatencyTier(input.directive?.latencyTier))
        }

        let request = makeRequest(outputFormat: outputFormat)
        self.ttsLogger.info("talk TTS synth timeout=\(input.synthTimeoutSeconds, privacy: .public)s")
        let client = ElevenLabsTTSClient(apiKey: apiKey)
        let stream = client.streamSynthesize(voiceId: voiceId, request: request)
        guard self.isCurrent(input.generation) else { return }

        if self.interruptOnSpeech {
            guard await self.prepareForPlayback(generation: input.generation) else { return }
        }

        await MainActor.run { TalkModeController.shared.updatePhase(.speaking) }
        self.phase = .speaking

        let result = await self.playRemoteStream(
            client: client,
            voiceId: voiceId,
            outputFormat: outputFormat,
            makeRequest: makeRequest,
            stream: stream)
        self.ttsLogger
            .info(
                "talk audio result finished=\(result.finished, privacy: .public) " +
                    "interruptedAt=\(String(describing: result.interruptedAt), privacy: .public)")
        if !result.finished, result.interruptedAt == nil {
            throw NSError(domain: "StreamingAudioPlayer", code: 1, userInfo: [
                NSLocalizedDescriptionKey: "audio playback failed",
            ])
        }
        if !result.finished, let interruptedAt = result.interruptedAt, self.phase == .speaking {
            if self.interruptOnSpeech {
                self.lastInterruptedAtSeconds = interruptedAt
            }
        }
    }

    private func playRemoteStream(
        client: ElevenLabsTTSClient,
        voiceId: String,
        outputFormat: String?,
        makeRequest: (String?) -> ElevenLabsTTSRequest,
        stream: AsyncThrowingStream<Data, Error>) async -> StreamingPlaybackResult
    {
        let sampleRate = TalkTTSValidation.pcmSampleRate(from: outputFormat)
        if let sampleRate {
            self.lastPlaybackWasPCM = true
            let result = await self.playPCM(stream: stream, sampleRate: sampleRate)
            if result.finished || result.interruptedAt != nil {
                return result
            }
            let mp3Format = ElevenLabsTTSClient.validatedOutputFormat("mp3_44100")
            self.ttsLogger.warning("talk pcm playback failed; retrying mp3")
            self.lastPlaybackWasPCM = false
            let mp3Stream = client.streamSynthesize(
                voiceId: voiceId,
                request: makeRequest(mp3Format))
            return await self.playMP3(stream: mp3Stream)
        }
        self.lastPlaybackWasPCM = false
        return await self.playMP3(stream: stream)
    }

    private func playSystemVoice(input: TalkPlaybackInput) async throws {
        self.ttsLogger.info("talk system voice start chars=\(input.cleanedText.count, privacy: .public)")
        if self.interruptOnSpeech {
            guard await self.prepareForPlayback(generation: input.generation) else { return }
        }
        await MainActor.run { TalkModeController.shared.updatePhase(.speaking) }
        self.phase = .speaking
        await TalkSystemSpeechSynthesizer.shared.stop()
        try await TalkSystemSpeechSynthesizer.shared.speak(
            text: input.cleanedText,
            language: input.language)
        self.ttsLogger.info("talk system voice done")
    }

    private func prepareForPlayback(generation: Int) async -> Bool {
        await self.startRecognition()
        return self.isCurrent(generation)
    }

    private func resolveVoiceId(preferred: String?, apiKey: String) async -> String? {
        let trimmed = preferred?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if !trimmed.isEmpty {
            if let resolved = self.resolveVoiceAlias(trimmed) { return resolved }
            self.ttsLogger.warning("talk unknown voice alias \(trimmed, privacy: .public)")
        }
        if let fallbackVoiceId { return fallbackVoiceId }

        do {
            let voices = try await ElevenLabsTTSClient(apiKey: apiKey).listVoices()
            guard let first = voices.first else {
                self.ttsLogger.error("elevenlabs voices list empty")
                return nil
            }
            self.fallbackVoiceId = first.voiceId
            if self.defaultVoiceId == nil {
                self.defaultVoiceId = first.voiceId
            }
            if !self.voiceOverrideActive {
                self.currentVoiceId = first.voiceId
            }
            let name = first.name ?? "unknown"
            self.ttsLogger
                .info("talk default voice selected \(name, privacy: .public) (\(first.voiceId, privacy: .public))")
            return first.voiceId
        } catch {
            self.ttsLogger.error("elevenlabs list voices failed: \(error.localizedDescription, privacy: .public)")
            return nil
        }
    }

    private func resolveVoiceAlias(_ value: String?) -> String? {
        let trimmed = (value ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }
        let normalized = trimmed.lowercased()
        if let mapped = self.voiceAliases[normalized] { return mapped }
        if self.voiceAliases.values.contains(where: { $0.caseInsensitiveCompare(trimmed) == .orderedSame }) {
            return trimmed
        }
        return Self.isLikelyVoiceId(trimmed) ? trimmed : nil
    }

    private static func isLikelyVoiceId(_ value: String) -> Bool {
        guard value.count >= 10 else { return false }
        return value.allSatisfy { $0.isLetter || $0.isNumber || $0 == "-" || $0 == "_" }
    }

    func stopSpeaking(reason: TalkStopReason) async {
        let usePCM = self.lastPlaybackWasPCM
        let interruptedAt = usePCM ? await self.stopPCM() : await self.stopMP3()
        _ = usePCM ? await self.stopMP3() : await self.stopPCM()
        await TalkSystemSpeechSynthesizer.shared.stop()
        await self.stopMiniMax()
        guard self.phase == .speaking else { return }
        if reason == .speech, let interruptedAt {
            self.lastInterruptedAtSeconds = interruptedAt
        }
        if reason == .manual {
            return
        }
        if reason == .speech || reason == .userTap {
            await self.startListening()
            return
        }
        self.phase = .thinking
        await MainActor.run { TalkModeController.shared.updatePhase(.thinking) }
    }
}

extension TalkModeRuntime {
    // MARK: - Audio playback (MainActor helpers)

    @MainActor
    private func playPCM(
        stream: AsyncThrowingStream<Data, Error>,
        sampleRate: Double) async -> StreamingPlaybackResult
    {
        await PCMStreamingAudioPlayer.shared.play(stream: stream, sampleRate: sampleRate)
    }

    @MainActor
    private func playMP3(stream: AsyncThrowingStream<Data, Error>) async -> StreamingPlaybackResult {
        await StreamingAudioPlayer.shared.play(stream: stream)
    }

    @MainActor
    private func stopPCM() -> Double? {
        PCMStreamingAudioPlayer.shared.stop()
    }

    @MainActor
    private func stopMP3() -> Double? {
        StreamingAudioPlayer.shared.stop()
    }

    // MARK: - Config

    private func reloadConfig() async {
        let cfg = await self.fetchTalkConfig()
        self.defaultVoiceId = cfg.voiceId
        self.voiceAliases = cfg.voiceAliases
        if !self.voiceOverrideActive {
            self.currentVoiceId = cfg.voiceId
        }
        self.defaultModelId = cfg.modelId
        if !self.modelOverrideActive {
            self.currentModelId = cfg.modelId
        }
        self.defaultOutputFormat = cfg.outputFormat
        self.interruptOnSpeech = cfg.interruptOnSpeech
        self.apiKey = cfg.apiKey
        
        // MiniMax TTS configuration
        self.useMiniMax = cfg.useMiniMax
        self.miniMaxApiKey = cfg.miniMaxApiKey
        self.miniMaxVoiceId = cfg.miniMaxVoiceId
        self.miniMaxModel = cfg.miniMaxModel
        
        let hasElevenLabsKey = (cfg.apiKey?.isEmpty == false)
        let hasMiniMaxKey = (cfg.miniMaxApiKey?.isEmpty == false)
        let voiceLabel = (cfg.voiceId?.isEmpty == false) ? cfg.voiceId! : "none"
        let modelLabel = (cfg.modelId?.isEmpty == false) ? cfg.modelId! : "none"
        let ttsProvider = (cfg.useMiniMax && hasMiniMaxKey) ? "minimax" : (hasElevenLabsKey ? "elevenlabs" : "system")
        self.logger
            .info(
                "talk config voiceId=\(voiceLabel, privacy: .public) " +
                    "modelId=\(modelLabel, privacy: .public) " +
                    "tts=\(ttsProvider, privacy: .public) " +
                    "interrupt=\(cfg.interruptOnSpeech, privacy: .public)")
    }

    private struct TalkRuntimeConfig {
        let voiceId: String?
        let voiceAliases: [String: String]
        let modelId: String?
        let outputFormat: String?
        let interruptOnSpeech: Bool
        let apiKey: String?
        // MiniMax TTS settings
        let useMiniMax: Bool
        let miniMaxApiKey: String?
        let miniMaxVoiceId: String
        let miniMaxModel: String
    }

    private func fetchTalkConfig() async -> TalkRuntimeConfig {
        let env = ProcessInfo.processInfo.environment
        let envVoice = env["ELEVENLABS_VOICE_ID"]?.trimmingCharacters(in: .whitespacesAndNewlines)
        let sagVoice = env["SAG_VOICE_ID"]?.trimmingCharacters(in: .whitespacesAndNewlines)
        let envApiKey = env["ELEVENLABS_API_KEY"]?.trimmingCharacters(in: .whitespacesAndNewlines)
        
        // MiniMax environment variables
        let envUseMiniMax = env["MINIMAX_TTS_ENABLED"]?.lowercased() == "true" ||
                            env["MINIMAX_TTS_ENABLED"] == "1" ||
                            env["MINIMAX_TTS_ENABLED"] == nil  // Default to enabled
        let envMiniMaxApiKey = env["MINIMAX_API_KEY"]?.trimmingCharacters(in: .whitespacesAndNewlines)
        let envMiniMaxVoiceId = env["MINIMAX_VOICE_ID"]?.trimmingCharacters(in: .whitespacesAndNewlines)
        let envMiniMaxModel = env["MINIMAX_MODEL"]?.trimmingCharacters(in: .whitespacesAndNewlines)

        do {
            let snap: ConfigSnapshot = try await GatewayConnection.shared.requestDecoded(
                method: .configGet,
                params: nil,
                timeoutMs: 8000)
            let talk = snap.config?["talk"]?.dictionaryValue
            let ui = snap.config?["ui"]?.dictionaryValue
            let rawSeam = ui?["seamColor"]?.stringValue?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            await MainActor.run {
                AppStateStore.shared.seamColorHex = rawSeam.isEmpty ? nil : rawSeam
            }
            let voice = talk?["voiceId"]?.stringValue
            let rawAliases = talk?["voiceAliases"]?.dictionaryValue
            let resolvedAliases: [String: String] =
                rawAliases?.reduce(into: [:]) { acc, entry in
                    let key = entry.key.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
                    let value = entry.value.stringValue?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
                    guard !key.isEmpty, !value.isEmpty else { return }
                    acc[key] = value
                } ?? [:]
            let model = talk?["modelId"]?.stringValue?.trimmingCharacters(in: .whitespacesAndNewlines)
            let resolvedModel = (model?.isEmpty == false) ? model! : Self.defaultModelIdFallback
            let outputFormat = talk?["outputFormat"]?.stringValue
            let interrupt = talk?["interruptOnSpeech"]?.boolValue
            let apiKey = talk?["apiKey"]?.stringValue
            let resolvedVoice =
                (voice?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false ? voice : nil) ??
                (envVoice?.isEmpty == false ? envVoice : nil) ??
                (sagVoice?.isEmpty == false ? sagVoice : nil)
            let resolvedApiKey =
                (envApiKey?.isEmpty == false ? envApiKey : nil) ??
                (apiKey?.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty == false ? apiKey : nil)
            
            // MiniMax TTS config from talk section
            let minimax = talk?["minimax"]?.dictionaryValue
            let cfgUseMiniMax = minimax?["enabled"]?.boolValue ?? envUseMiniMax
            let cfgMiniMaxApiKey = minimax?["apiKey"]?.stringValue?
                .trimmingCharacters(in: .whitespacesAndNewlines)
            let cfgMiniMaxVoiceId = minimax?["voiceId"]?.stringValue?
                .trimmingCharacters(in: .whitespacesAndNewlines)
            let cfgMiniMaxModel = minimax?["model"]?.stringValue?
                .trimmingCharacters(in: .whitespacesAndNewlines)
            
            // Also check env section in config file for MINIMAX_API_KEY
            let cfgEnv = snap.config?["env"]?.dictionaryValue
            let cfgEnvMiniMaxApiKey = cfgEnv?["MINIMAX_API_KEY"]?.stringValue?
                .trimmingCharacters(in: .whitespacesAndNewlines)
            
            // Resolve MiniMax API key: process env > config.env > talk.minimax.apiKey
            let resolvedMiniMaxApiKey =
                (envMiniMaxApiKey?.isEmpty == false ? envMiniMaxApiKey : nil) ??
                (cfgEnvMiniMaxApiKey?.isEmpty == false ? cfgEnvMiniMaxApiKey : nil) ??
                (cfgMiniMaxApiKey?.isEmpty == false ? cfgMiniMaxApiKey : nil)
            
            return TalkRuntimeConfig(
                voiceId: resolvedVoice,
                voiceAliases: resolvedAliases,
                modelId: resolvedModel,
                outputFormat: outputFormat,
                interruptOnSpeech: interrupt ?? true,
                apiKey: resolvedApiKey,
                useMiniMax: cfgUseMiniMax,
                miniMaxApiKey: resolvedMiniMaxApiKey,
                miniMaxVoiceId: cfgMiniMaxVoiceId ?? envMiniMaxVoiceId ?? "male-qn-qingse",
                miniMaxModel: cfgMiniMaxModel ?? envMiniMaxModel ?? "speech-2.6-hd")
        } catch {
            let resolvedVoice =
                (envVoice?.isEmpty == false ? envVoice : nil) ??
                (sagVoice?.isEmpty == false ? sagVoice : nil)
            let resolvedApiKey = envApiKey?.isEmpty == false ? envApiKey : nil
            
            return TalkRuntimeConfig(
                voiceId: resolvedVoice,
                voiceAliases: [:],
                modelId: Self.defaultModelIdFallback,
                outputFormat: nil,
                interruptOnSpeech: true,
                apiKey: resolvedApiKey,
                useMiniMax: envUseMiniMax,
                miniMaxApiKey: envMiniMaxApiKey,
                miniMaxVoiceId: envMiniMaxVoiceId ?? "male-qn-qingse",
                miniMaxModel: envMiniMaxModel ?? "speech-2.6-hd")
        }
    }

    // MARK: - Audio level handling

    private func noteAudioLevel(rms: Double) async {
        if self.phase != .listening, self.phase != .speaking { return }
        let alpha: Double = rms < self.noiseFloorRMS ? 0.08 : 0.01
        self.noiseFloorRMS = max(1e-7, self.noiseFloorRMS + (rms - self.noiseFloorRMS) * alpha)

        let threshold = max(self.minSpeechRMS, self.noiseFloorRMS * self.speechBoostFactor)
        if rms >= threshold {
            let now = Date()
            self.lastHeard = now
            self.lastSpeechEnergyAt = now
        }

        if self.phase == .listening {
            let clamped = min(1.0, max(0.0, rms / max(self.minSpeechRMS, threshold)))
            await MainActor.run { TalkModeController.shared.updateLevel(clamped) }
        }
    }

    private static func rmsLevel(buffer: AVAudioPCMBuffer) -> Double? {
        guard let channelData = buffer.floatChannelData?.pointee else { return nil }
        let frameCount = Int(buffer.frameLength)
        guard frameCount > 0 else { return nil }
        var sum: Double = 0
        for i in 0..<frameCount {
            let sample = Double(channelData[i])
            sum += sample * sample
        }
        return sqrt(sum / Double(frameCount))
    }

    private func shouldInterrupt(transcript: String, hasConfidence: Bool) async -> Bool {
        let trimmed = transcript.trimmingCharacters(in: .whitespacesAndNewlines)
        
        // 调试日志
        self.logger.warning("🔊 shouldInterrupt检查: '\(trimmed.prefix(20), privacy: .public)' len=\(trimmed.count, privacy: .public)")
        
        // 至少需要 5 个字符才触发打断（避免误触发）
        guard trimmed.count >= 5 else {
            self.logger.warning("🔊 打断失败: 文字太短 (\(trimmed.count, privacy: .public) < 5)")
            return false
        }
        
        // 检查是否是回声（TTS 播放的内容被麦克风采集）
        if self.isLikelyEcho(of: trimmed) {
            self.logger.warning("🔊 打断失败: 检测到回声")
            return false
        }
        
        // 去掉置信度检查和语音能量检查（因为 TTS 播放时这些检测不准确）
        // 只要有足够长的非回声转录就打断
        
        self.logger.warning("🔊 打断成功! 将中断播放")
        return true
    }

    private func isLikelyEcho(of transcript: String) -> Bool {
        guard let spoken = self.lastSpokenText?.lowercased(), !spoken.isEmpty else { return false }
        let probe = transcript.lowercased()
        if probe.count < 6 {
            return spoken.contains(probe)
        }
        return spoken.contains(probe)
    }

    private static func resolveSpeed(speed: Double?, rateWPM: Int?, logger: Logger) -> Double? {
        if let rateWPM, rateWPM > 0 {
            let resolved = Double(rateWPM) / 175.0
            if resolved <= 0.5 || resolved >= 2.0 {
                logger.warning("talk rateWPM out of range: \(rateWPM, privacy: .public)")
                return nil
            }
            return resolved
        }
        if let speed {
            if speed <= 0.5 || speed >= 2.0 {
                logger.warning("talk speed out of range: \(speed, privacy: .public)")
                return nil
            }
            return speed
        }
        return nil
    }

    private static func validatedUnit(_ value: Double?, name: String, logger: Logger) -> Double? {
        guard let value else { return nil }
        if value < 0 || value > 1 {
            logger.warning("talk \(name, privacy: .public) out of range: \(value, privacy: .public)")
            return nil
        }
        return value
    }

    private static func validatedSeed(_ value: Int?, logger: Logger) -> UInt32? {
        guard let value else { return nil }
        if value < 0 || value > 4_294_967_295 {
            logger.warning("talk seed out of range: \(value, privacy: .public)")
            return nil
        }
        return UInt32(value)
    }

    private static func validatedNormalize(_ value: String?, logger: Logger) -> String? {
        guard let value else { return nil }
        let normalized = value.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard ["auto", "on", "off"].contains(normalized) else {
            logger.warning("talk normalize invalid: \(normalized, privacy: .public)")
            return nil
        }
        return normalized
    }
    
    // MARK: - MiniMax TTS Integration (WebSocket)
    
    /// Play audio using MiniMax cloud TTS via WebSocket
    private func playMiniMax(input: TalkPlaybackInput) async throws {
        guard let apiKey = self.miniMaxApiKey, !apiKey.isEmpty else {
            throw MiniMaxTTSError.apiError(0, "MiniMax API key not configured")
        }
        
        self.ttsLogger.info(
            "talk MiniMax WebSocket start chars=\(input.cleanedText.count, privacy: .public) " +
            "voice=\(self.miniMaxVoiceId, privacy: .public) model=\(self.miniMaxModel, privacy: .public)")
        
        // Create MiniMax WebSocket client
        let client = MiniMaxTTSClient(
            apiKey: apiKey,
            model: self.miniMaxModel,
            voiceId: self.miniMaxVoiceId
        )
        self.miniMaxClient = client
        
        // Ensure cleanup on exit
        defer {
            Task {
                await client.disconnect()
            }
            self.miniMaxClient = nil
        }
        
        if self.interruptOnSpeech {
            guard await self.prepareForPlayback(generation: input.generation) else { return }
        }
        
        await MainActor.run { TalkModeController.shared.updatePhase(.speaking) }
        self.phase = .speaking
        
        // Get audio stream from MiniMax WebSocket (returns MP3 data)
        let stream = await client.streamSynthesize(
            text: input.cleanedText,
            speed: 1.0,
            volume: 1.0,
            pitch: 0
        )
        
        // MiniMax returns MP3 format
        self.lastPlaybackWasPCM = false
        
        // Play MP3 audio stream
        let result = await self.playMP3(stream: stream)
        
        self.ttsLogger.info(
            "talk MiniMax result finished=\(result.finished, privacy: .public) " +
            "interruptedAt=\(String(describing: result.interruptedAt), privacy: .public)")
        
        // Do not throw when stream ended without "finished" - we may have already played most of it.
        // Throwing would trigger fallback and replay the same text (causing duplicate speech).
        if !result.finished, result.interruptedAt == nil {
            self.ttsLogger.warning("MiniMax stream ended without finished flag (partial playback)")
        }
        
        if !result.finished, let interruptedAt = result.interruptedAt, self.phase == .speaking {
            if self.interruptOnSpeech {
                self.lastInterruptedAtSeconds = interruptedAt
            }
        }
    }
    
    /// Stop MiniMax playback and disconnect WebSocket
    private func stopMiniMax() async {
        if let client = self.miniMaxClient {
            await client.disconnect()
        }
        self.miniMaxClient = nil
    }
}
