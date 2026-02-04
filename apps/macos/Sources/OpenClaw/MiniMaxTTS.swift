import Foundation
import OSLog

// MARK: - MiniMax TTS Client using WebSocket

/// MiniMax TTS client using WebSocket for low-latency streaming synthesis.
/// Protocol: wss://api.minimaxi.com/ws/v1/t2a_v2
/// Audio format: MP3 (hex encoded in JSON responses)
actor MiniMaxTTSClient {
    
    // MARK: - Properties
    
    private let logger = Logger(subsystem: "ai.openclaw", category: "minimax.tts")
    private let apiKey: String
    private let model: String
    private let voiceId: String
    private let urlSession: URLSession
    
    private var webSocket: URLSessionWebSocketTask?
    
    /// WebSocket endpoint
    private static let wsURL = "wss://api.minimaxi.com/ws/v1/t2a_v2"
    
    /// Connection state
    private(set) var isConnected = false
    private var sessionId: String?
    
    /// Audio settings
    private(set) var sampleRate: Int = 32000
    
    // MARK: - Initialization
    
    init(
        apiKey: String,
        model: String = "speech-2.6-hd",
        voiceId: String = "male-qn-qingse"
    ) {
        self.apiKey = apiKey
        self.model = model
        self.voiceId = voiceId
        self.urlSession = URLSession.shared
    }
    
    // MARK: - Connection Management
    
    /// Connect to MiniMax WebSocket server
    func connect() async throws {
        guard !isConnected else {
            logger.info("MiniMax already connected")
            return
        }
        
        guard let url = URL(string: Self.wsURL) else {
            throw MiniMaxTTSError.invalidURL
        }
        
        logger.info("MiniMax connecting to \(Self.wsURL)")
        
        var request = URLRequest(url: url)
        request.timeoutInterval = 30
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        
        webSocket = urlSession.webSocketTask(with: request)
        webSocket?.resume()
        
        // Wait for connected_success message
        let message = try await receiveMessage()
        guard case .string(let text) = message,
              let data = text.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              json["event"] as? String == "connected_success" else {
            throw MiniMaxTTSError.connectionFailed("Invalid welcome message")
        }
        
        if let sid = json["session_id"] as? String {
            sessionId = sid
        }
        
        isConnected = true
        logger.info("MiniMax WebSocket connected, session=\(self.sessionId ?? "unknown")")
    }
    
    /// Disconnect from WebSocket server
    func disconnect() {
        webSocket?.cancel(with: .goingAway, reason: nil)
        webSocket = nil
        isConnected = false
        sessionId = nil
        logger.info("MiniMax disconnected")
    }
    
    // MARK: - Streaming Synthesis
    
    /// Synthesize text and return streaming audio data.
    /// Returns AsyncThrowingStream of MP3 audio chunks.
    func streamSynthesize(
        text: String,
        speed: Double = 1.0,
        volume: Double = 1.0,
        pitch: Int = 0
    ) -> AsyncThrowingStream<Data, Error> {
        AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    try await self.performSynthesis(
                        text: text,
                        speed: speed,
                        volume: volume,
                        pitch: pitch,
                        continuation: continuation
                    )
                } catch {
                    continuation.finish(throwing: error)
                }
            }
            
            continuation.onTermination = { @Sendable _ in
                task.cancel()
            }
        }
    }
    
    private func performSynthesis(
        text: String,
        speed: Double,
        volume: Double,
        pitch: Int,
        continuation: AsyncThrowingStream<Data, Error>.Continuation
    ) async throws {
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw MiniMaxTTSError.emptyText
        }
        
        // Connect if not connected
        if !isConnected {
            try await connect()
        }
        
        guard isConnected else {
            throw MiniMaxTTSError.notConnected
        }
        
        logger.info("MiniMax TTS request: model=\(self.model) voice=\(self.voiceId) chars=\(text.count)")
        
        // Step 1: Send task_start
        let taskStart: [String: Any] = [
            "event": "task_start",
            "model": model,
            "language_boost": "auto",
            "voice_setting": [
                "voice_id": voiceId,
                "speed": speed,
                "vol": volume,
                "pitch": pitch
            ],
            "audio_setting": [
                "sample_rate": 32000,
                "bitrate": 128000,
                "format": "mp3",
                "channel": 1
            ]
        ]
        try await sendJSON(taskStart)
        
        // Wait for task_started
        var taskStarted = false
        while !taskStarted {
            let msg = try await receiveMessage()
            if case .string(let jsonStr) = msg,
               let data = jsonStr.data(using: .utf8),
               let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                
                // Check for error
                if let baseResp = json["base_resp"] as? [String: Any],
                   let statusCode = baseResp["status_code"] as? Int,
                   statusCode != 0 {
                    let statusMsg = baseResp["status_msg"] as? String ?? "Unknown error"
                    throw MiniMaxTTSError.apiError(statusCode, statusMsg)
                }
                
                if json["event"] as? String == "task_started" {
                    taskStarted = true
                    logger.info("MiniMax task started")
                } else if json["event"] as? String == "task_failed" {
                    let errMsg = (json["base_resp"] as? [String: Any])?["status_msg"] as? String ?? "Task failed"
                    throw MiniMaxTTSError.apiError(0, errMsg)
                }
            }
        }
        
        // Step 2: Send task_continue with text
        let taskContinue: [String: Any] = [
            "event": "task_continue",
            "text": text
        ]
        try await sendJSON(taskContinue)
        
        // Step 3: Send task_finish
        let taskFinish: [String: Any] = [
            "event": "task_finish"
        ]
        try await sendJSON(taskFinish)
        
        // Step 4: Receive audio chunks until task_finished
        var totalChunks = 0
        var totalBytes = 0
        var finished = false
        
        while !finished {
            if Task.isCancelled {
                continuation.finish()
                return
            }
            
            let msg = try await receiveMessage()
            
            guard case .string(let jsonStr) = msg,
                  let data = jsonStr.data(using: .utf8),
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                continue
            }
            
            // Check for error
            if let baseResp = json["base_resp"] as? [String: Any],
               let statusCode = baseResp["status_code"] as? Int,
               statusCode != 0 {
                let statusMsg = baseResp["status_msg"] as? String ?? "Unknown error"
                logger.error("MiniMax error: \(statusMsg)")
                throw MiniMaxTTSError.apiError(statusCode, statusMsg)
            }
            
            // Check for task_finished
            if json["event"] as? String == "task_finished" {
                finished = true
                logger.info("MiniMax task finished: \(totalChunks) chunks, \(totalBytes) bytes")
                break
            }
            
            // Check for task_failed
            if json["event"] as? String == "task_failed" {
                let errMsg = (json["base_resp"] as? [String: Any])?["status_msg"] as? String ?? "Task failed"
                throw MiniMaxTTSError.apiError(0, errMsg)
            }
            
            // Extract audio data
            if let dataObj = json["data"] as? [String: Any],
               let audioHex = dataObj["audio"] as? String,
               !audioHex.isEmpty {
                
                let isFinal = json["is_final"] as? Bool ?? false
                
                if let audioData = Data(hexString: audioHex) {
                    totalChunks += 1
                    totalBytes += audioData.count
                    logger.debug("MiniMax audio chunk \(totalChunks): \(audioData.count) bytes, isFinal=\(isFinal)")
                    continuation.yield(audioData)
                }
                
                // Update sample rate if available
                if let extraInfo = json["extra_info"] as? [String: Any],
                   let sr = extraInfo["audio_sample_rate"] as? Int {
                    sampleRate = sr
                }
            }
        }
        
        continuation.finish()
    }
    
    // MARK: - WebSocket Helpers
    
    private func sendJSON(_ dict: [String: Any]) async throws {
        guard let ws = webSocket else {
            throw MiniMaxTTSError.notConnected
        }
        
        let jsonData = try JSONSerialization.data(withJSONObject: dict)
        guard let jsonString = String(data: jsonData, encoding: .utf8) else {
            throw MiniMaxTTSError.parseError("Failed to encode JSON")
        }
        
        try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
            ws.send(.string(jsonString)) { error in
                if let error = error {
                    cont.resume(throwing: error)
                } else {
                    cont.resume()
                }
            }
        }
    }
    
    private func receiveMessage() async throws -> URLSessionWebSocketTask.Message {
        guard let ws = webSocket else {
            throw MiniMaxTTSError.notConnected
        }
        
        return try await ws.receive()
    }
}

// MARK: - Error Types

enum MiniMaxTTSError: LocalizedError {
    case emptyText
    case invalidURL
    case invalidResponse
    case notConnected
    case connectionFailed(String)
    case httpError(Int, String)
    case apiError(Int, String)
    case parseError(String)
    
    var errorDescription: String? {
        switch self {
        case .emptyText:
            return "Text cannot be empty"
        case .invalidURL:
            return "Invalid API URL"
        case .invalidResponse:
            return "Invalid server response"
        case .notConnected:
            return "WebSocket not connected"
        case .connectionFailed(let reason):
            return "Connection failed: \(reason)"
        case .httpError(let code, let msg):
            return "HTTP error \(code): \(msg)"
        case .apiError(let code, let msg):
            return "API error \(code): \(msg)"
        case .parseError(let msg):
            return "Parse error: \(msg)"
        }
    }
}

// MARK: - Hex String Extension

extension Data {
    /// Initialize Data from a hex string
    init?(hexString: String) {
        let hex = hexString.trimmingCharacters(in: .whitespacesAndNewlines)
        guard hex.count % 2 == 0 else { return nil }
        
        var data = Data(capacity: hex.count / 2)
        var index = hex.startIndex
        
        while index < hex.endIndex {
            let nextIndex = hex.index(index, offsetBy: 2)
            guard let byte = UInt8(hex[index..<nextIndex], radix: 16) else {
                return nil
            }
            data.append(byte)
            index = nextIndex
        }
        
        self = data
    }
}
