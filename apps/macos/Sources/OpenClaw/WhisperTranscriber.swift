import AVFoundation
import Foundation
import OSLog

/// Transcription backend using local whisper.cpp CLI.
actor WhisperTranscriber {
    static let shared = WhisperTranscriber()

    private let logger = Logger(subsystem: "ai.openclaw", category: "whisper")

    /// Available whisper models in order of quality (worst to best).
    enum Model: String, CaseIterable, Identifiable {
        case tiny
        case base
        case small
        case medium
        case largeV3Turbo = "large-v3-turbo"

        var id: String { self.rawValue }

        var displayName: String {
            switch self {
            case .tiny: return "Tiny (fastest)"
            case .base: return "Base"
            case .small: return "Small"
            case .medium: return "Medium"
            case .largeV3Turbo: return "Large v3 Turbo (best)"
            }
        }

        var modelFileName: String {
            "ggml-\(self.rawValue).bin"
        }
    }

    /// Default model directory.
    static var defaultModelDir: URL {
        FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent(".local/share/whisper-cpp")
    }

    /// Check if whisper-cpp CLI is available.
    static func isAvailable() -> Bool {
        let task = Process()
        task.executableURL = URL(fileURLWithPath: "/usr/bin/which")
        task.arguments = ["whisper-cpp"]
        task.standardOutput = FileHandle.nullDevice
        task.standardError = FileHandle.nullDevice
        do {
            try task.run()
            task.waitUntilExit()
            return task.terminationStatus == 0
        } catch {
            return false
        }
    }

    /// Check if a specific model is downloaded.
    static func modelExists(_ model: Model, in directory: URL? = nil) -> Bool {
        let dir = directory ?? Self.defaultModelDir
        let path = dir.appendingPathComponent(model.modelFileName)
        return FileManager.default.fileExists(atPath: path.path)
    }

    /// Get path to model file.
    static func modelPath(_ model: Model, in directory: URL? = nil) -> URL {
        let dir = directory ?? Self.defaultModelDir
        return dir.appendingPathComponent(model.modelFileName)
    }

    /// List available (downloaded) models.
    static func availableModels(in directory: URL? = nil) -> [Model] {
        Model.allCases.filter { Self.modelExists($0, in: directory) }
    }

    /// Transcribe an audio file using whisper-cpp.
    /// - Parameters:
    ///   - audioURL: Path to WAV file (16kHz mono recommended)
    ///   - model: Which model to use
    ///   - modelDir: Directory containing model files
    /// - Returns: Transcribed text
    func transcribe(
        audioURL: URL,
        model: Model = .base,
        modelDir: URL? = nil
    ) async throws -> String {
        let modelPath = Self.modelPath(model, in: modelDir)

        guard FileManager.default.fileExists(atPath: modelPath.path) else {
            throw TranscriptionError.modelNotFound(model.rawValue)
        }

        self.logger.info("whisper transcribe model=\(model.rawValue, privacy: .public)")

        let task = Process()
        task.executableURL = URL(fileURLWithPath: "/opt/homebrew/bin/whisper-cpp")
        task.arguments = [
            "-m", modelPath.path,
            "-f", audioURL.path,
            "--no-timestamps",
            "-otxt",
        ]

        let pipe = Pipe()
        task.standardOutput = pipe
        task.standardError = FileHandle.nullDevice

        return try await withCheckedThrowingContinuation { continuation in
            do {
                try task.run()
            } catch {
                continuation.resume(throwing: TranscriptionError.processLaunchFailed(error))
                return
            }

            Task.detached {
                task.waitUntilExit()
                let data = pipe.fileHandleForReading.readDataToEndOfFile()
                let output = String(data: data, encoding: .utf8)?
                    .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""

                if task.terminationStatus != 0 {
                    continuation.resume(throwing: TranscriptionError.processFailed(Int(task.terminationStatus)))
                } else {
                    continuation.resume(returning: output)
                }
            }
        }
    }

    /// Record audio from microphone to a temporary WAV file.
    /// - Parameters:
    ///   - duration: Maximum recording duration
    ///   - micID: Optional specific microphone device ID
    /// - Returns: URL to the recorded WAV file
    func recordToFile(duration: TimeInterval, micID: String? = nil) async throws -> URL {
        let tempURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("whisper-ptt-\(UUID().uuidString).wav")

        // Use sox/rec for simple recording
        let task = Process()
        task.executableURL = URL(fileURLWithPath: "/opt/homebrew/bin/rec")
        task.arguments = [
            "-r", "16000", // 16kHz sample rate (whisper expects this)
            "-c", "1", // mono
            "-b", "16", // 16-bit
            tempURL.path,
            "trim", "0", String(format: "%.1f", duration),
        ]
        task.standardOutput = FileHandle.nullDevice
        task.standardError = FileHandle.nullDevice

        return try await withCheckedThrowingContinuation { continuation in
            do {
                try task.run()
            } catch {
                continuation.resume(throwing: TranscriptionError.recordingFailed(error))
                return
            }

            Task.detached {
                task.waitUntilExit()
                if task.terminationStatus != 0 {
                    continuation.resume(throwing: TranscriptionError.recordingFailed(nil))
                } else {
                    continuation.resume(returning: tempURL)
                }
            }
        }
    }

    enum TranscriptionError: LocalizedError {
        case modelNotFound(String)
        case processLaunchFailed(Error)
        case processFailed(Int)
        case recordingFailed(Error?)

        var errorDescription: String? {
            switch self {
            case let .modelNotFound(model):
                return "Whisper model '\(model)' not found. Run: brew install whisper-cpp && download models."
            case let .processLaunchFailed(error):
                return "Failed to launch whisper-cpp: \(error.localizedDescription)"
            case let .processFailed(code):
                return "whisper-cpp exited with code \(code)"
            case let .recordingFailed(error):
                return "Recording failed: \(error?.localizedDescription ?? "unknown error")"
            }
        }
    }
}
